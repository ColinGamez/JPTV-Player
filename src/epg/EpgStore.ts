/**
 * EPG Store - High-performance EPG data layer
 * 
 * Features:
 * - Indexed program storage by channel
 * - Fast time-based queries
 * - Search with token indexing
 * - Efficient range queries for virtualized rendering
 */

export interface EpgProgram {
  channelId: string;
  title: string;
  description?: string;
  category?: string;
  startMs: number;
  endMs: number;
  icon?: string;
}

export interface SearchResult {
  program: EpgProgram;
  channelName?: string;
  score: number;
}

interface ChannelPrograms {
  programs: EpgProgram[];
  sortedStarts: number[];
}

interface SearchToken {
  token: string;
  programRefs: Array<{ channelId: string; index: number }>;
}

export class EpgStore {
  private channelIndex: Map<string, ChannelPrograms> = new Map();
  private searchIndex: Map<string, SearchToken> = new Map();
  private channelNames: Map<string, string> = new Map();

  constructor() {}

  /**
   * Load programs for a channel (replaces existing)
   */
  setChannelPrograms(channelId: string, programs: EpgProgram[], channelName?: string): void {
    if (channelName) {
      this.channelNames.set(channelId, channelName);
    }

    // Sort by start time
    const sorted = [...programs].sort((a, b) => a.startMs - b.startMs);
    const sortedStarts = sorted.map(p => p.startMs);

    this.channelIndex.set(channelId, {
      programs: sorted,
      sortedStarts
    });

    // Build search index for this channel
    this.indexChannelForSearch(channelId, sorted);
  }

  /**
   * Get current program for a channel
   */
  getNow(channelId: string, nowMs: number): EpgProgram | null {
    const channel = this.channelIndex.get(channelId);
    if (!channel) return null;

    // Binary search for the program containing nowMs
    const idx = this.findProgramAtTime(channel, nowMs);
    return idx >= 0 ? channel.programs[idx] : null;
  }

  /**
   * Get next program after current
   */
  getNext(channelId: string, nowMs: number): EpgProgram | null {
    const channel = this.channelIndex.get(channelId);
    if (!channel) return null;

    const currentIdx = this.findProgramAtTime(channel, nowMs);
    if (currentIdx >= 0 && currentIdx + 1 < channel.programs.length) {
      return channel.programs[currentIdx + 1];
    }

    // If no current program, find next upcoming
    const nextIdx = this.findNextProgramAfter(channel, nowMs);
    return nextIdx >= 0 ? channel.programs[nextIdx] : null;
  }

  /**
   * Get programs in time range (for grid rendering)
   */
  getProgramsInRange(channelId: string, startMs: number, endMs: number): EpgProgram[] {
    const channel = this.channelIndex.get(channelId);
    if (!channel) return [];

    const result: EpgProgram[] = [];
    
    // Find first program that might overlap
    let idx = this.findProgramAtOrBefore(channel, startMs);
    if (idx < 0) idx = 0;

    // Collect all programs that overlap with range
    while (idx < channel.programs.length) {
      const prog = channel.programs[idx];
      
      // Program starts after range end - we're done
      if (prog.startMs >= endMs) break;
      
      // Program overlaps with range
      if (prog.endMs > startMs) {
        result.push(prog);
      }
      
      idx++;
    }

    return result;
  }

  /**
   * Search programs by query text
   */
  searchPrograms(
    query: string,
    timeRange?: { startMs: number; endMs: number },
    maxResults: number = 100
  ): SearchResult[] {
    if (!query.trim()) return [];

    const tokens = this.tokenize(query.toLowerCase());
    const results = new Map<string, SearchResult>();

    // For each token, find matching programs
    for (const token of tokens) {
      // Find all indexed tokens that start with this token
      for (const [indexedToken, searchToken] of this.searchIndex.entries()) {
        if (indexedToken.includes(token)) {
          for (const ref of searchToken.programRefs) {
            const channel = this.channelIndex.get(ref.channelId);
            if (!channel) continue;

            const program = channel.programs[ref.index];
            if (!program) continue;

            // Apply time filter
            if (timeRange) {
              if (program.endMs <= timeRange.startMs || program.startMs >= timeRange.endMs) {
                continue;
              }
            }

            const key = `${ref.channelId}-${ref.index}`;
            const existing = results.get(key);
            
            if (existing) {
              existing.score++;
            } else {
              results.set(key, {
                program,
                channelName: this.channelNames.get(ref.channelId),
                score: 1
              });
            }
          }
        }
      }
    }

    // Sort by score (descending) and limit
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Get all channel IDs
   */
  getChannelIds(): string[] {
    return Array.from(this.channelIndex.keys());
  }

  /**
   * Get channel name
   */
  getChannelName(channelId: string): string | undefined {
    return this.channelNames.get(channelId);
  }

  /**
   * Check if channel has data
   */
  hasChannel(channelId: string): boolean {
    return this.channelIndex.has(channelId);
  }

  /**
   * Get time range covered by a channel
   */
  getChannelTimeRange(channelId: string): { startMs: number; endMs: number } | null {
    const channel = this.channelIndex.get(channelId);
    if (!channel || channel.programs.length === 0) return null;

    return {
      startMs: channel.programs[0].startMs,
      endMs: channel.programs[channel.programs.length - 1].endMs
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.channelIndex.clear();
    this.searchIndex.clear();
    this.channelNames.clear();
  }

  // ========== Private Helpers ==========

  /**
   * Binary search: find program containing timeMs
   */
  private findProgramAtTime(channel: ChannelPrograms, timeMs: number): number {
    let left = 0;
    let right = channel.programs.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const prog = channel.programs[mid];

      if (prog.startMs <= timeMs && prog.endMs > timeMs) {
        return mid;
      } else if (prog.endMs <= timeMs) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return -1;
  }

  /**
   * Find next program starting after timeMs
   */
  private findNextProgramAfter(channel: ChannelPrograms, timeMs: number): number {
    for (let i = 0; i < channel.programs.length; i++) {
      if (channel.programs[i].startMs > timeMs) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Find last program starting at or before timeMs
   */
  private findProgramAtOrBefore(channel: ChannelPrograms, timeMs: number): number {
    let result = -1;
    for (let i = 0; i < channel.programs.length; i++) {
      if (channel.programs[i].startMs <= timeMs) {
        result = i;
      } else {
        break;
      }
    }
    return result;
  }

  /**
   * Build search index for channel programs
   */
  private indexChannelForSearch(channelId: string, programs: EpgProgram[]): void {
    programs.forEach((prog, index) => {
      const text = `${prog.title} ${prog.description || ''} ${prog.category || ''}`;
      const tokens = this.tokenize(text.toLowerCase());

      tokens.forEach(token => {
        let searchToken = this.searchIndex.get(token);
        if (!searchToken) {
          searchToken = { token, programRefs: [] };
          this.searchIndex.set(token, searchToken);
        }
        searchToken.programRefs.push({ channelId, index });
      });
    });
  }

  /**
   * Tokenize text for search (split by whitespace, remove short tokens)
   */
  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length >= 2);
  }
}

// Singleton instance
let epgStoreInstance: EpgStore | null = null;

export function getEpgStore(): EpgStore {
  if (!epgStoreInstance) {
    epgStoreInstance = new EpgStore();
  }
  return epgStoreInstance;
}

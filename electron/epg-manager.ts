/**
 * EPG Manager with caching and efficient lookups
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseXmltvFile } from './xmltv-parser';
import type { 
  EpgChannel, 
  EpgProgram, 
  EpgNowNext, 
  EpgGuideWindow,
  EpgCache,
  XmltvParseResult 
} from '../src/types/epg';
import { EPG_CACHE_VERSION, EPG_DEFAULT_TTL } from '../src/types/epg';

export class EpgManager {
  private channels: Map<string, EpgChannel> = new Map();
  private programs: Map<string, EpgProgram[]> = new Map();
  private cacheFilePath: string;
  private ttl: number;
  private isLoaded = false;

  constructor(userDataPath: string, ttl: number = EPG_DEFAULT_TTL) {
    this.cacheFilePath = path.join(userDataPath, 'epg-cache.json');
    this.ttl = ttl;
  }

  /**
   * Initialize EPG data (load from cache or file)
   */
  async initialize(): Promise<void> {
    // Try to load from cache first
    const cached = await this.loadFromCache();
    if (cached) {
      console.log('[EPG] Loaded from cache:', {
        channels: this.channels.size,
        totalPrograms: Array.from(this.programs.values()).reduce((sum, p) => sum + p.length, 0)
      });
      this.isLoaded = true;
      return;
    }

    console.log('[EPG] Cache invalid or not found, waiting for manual load');
  }

  /**
   * Load EPG data from XMLTV file
   */
  async loadFromXmltv(filePath: string): Promise<XmltvParseResult> {
    console.log('[EPG] Parsing XMLTV file:', filePath);
    
    const result = await parseXmltvFile(filePath);
    
    if (result.success) {
      this.channels = result.channels;
      this.programs = result.programs;
      this.isLoaded = true;

      console.log('[EPG] Loaded successfully:', {
        channels: result.channelCount,
        programs: result.programCount,
        parseTime: `${result.parseTime}ms`
      });

      // Save to cache
      await this.saveToCache();
    } else {
      console.error('[EPG] Failed to parse XMLTV:', result.error);
    }

    return result;
  }

  /**
   * Get current and next programs for a channel
   */
  getNowNext(channelId: string): EpgNowNext {
    const now = Date.now();
    const channelPrograms = this.programs.get(channelId);

    if (!channelPrograms || channelPrograms.length === 0) {
      return { now: null, next: null, progress: 0 };
    }

    // Binary search for current program
    let currentProgram: EpgProgram | null = null;
    let nextProgram: EpgProgram | null = null;

    for (let i = 0; i < channelPrograms.length; i++) {
      const program = channelPrograms[i];
      
      if (program.start <= now && now < program.stop) {
        // Found current program
        currentProgram = program;
        nextProgram = channelPrograms[i + 1] || null;
        break;
      } else if (program.start > now) {
        // Current time is between programs
        nextProgram = program;
        break;
      }
    }

    // Calculate progress
    let progress = 0;
    if (currentProgram) {
      const duration = currentProgram.stop - currentProgram.start;
      const elapsed = now - currentProgram.start;
      progress = Math.max(0, Math.min(1, elapsed / duration));
    }

    return {
      now: currentProgram,
      next: nextProgram,
      progress
    };
  }

  /**
   * Get programs for multiple channels within a time window
   */
  getGuideWindow(channelIds: string[], startTime: number, endTime: number): EpgGuideWindow {
    const channels: EpgGuideWindow['channels'] = [];

    for (const channelId of channelIds) {
      const allPrograms = this.programs.get(channelId) || [];
      
      // Filter programs that overlap with time window
      const programs = allPrograms.filter(program => 
        program.start < endTime && program.stop > startTime
      );

      channels.push({
        channelId,
        programs
      });
    }

    return {
      startTime,
      endTime,
      channels
    };
  }

  /**
   * Get all programs for a channel on a specific date
   */
  getProgramsForDate(channelId: string, date: Date): EpgProgram[] {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const allPrograms = this.programs.get(channelId) || [];
    
    return allPrograms.filter(program =>
      program.start < endOfDay.getTime() && program.stop > startOfDay.getTime()
    );
  }

  /**
   * Get channel info
   */
  getChannel(channelId: string): EpgChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get all channels
   */
  getAllChannels(): EpgChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Check if EPG data is loaded
   */
  isDataLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalPrograms = Array.from(this.programs.values())
      .reduce((sum, programs) => sum + programs.length, 0);

    return {
      channels: this.channels.size,
      totalPrograms,
      isLoaded: this.isLoaded
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.channels.clear();
    this.programs.clear();
    this.isLoaded = false;
  }

  /**
   * Save EPG data to cache
   */
  private async saveToCache(): Promise<void> {
    try {
      const cache: EpgCache = {
        version: EPG_CACHE_VERSION,
        generatedAt: Date.now(),
        ttl: this.ttl,
        channels: this.channels,
        programs: this.programs
      };

      // Convert Maps to objects for JSON serialization
      const serializable = {
        version: cache.version,
        generatedAt: cache.generatedAt,
        ttl: cache.ttl,
        channels: Object.fromEntries(cache.channels),
        programs: Object.fromEntries(cache.programs)
      };

      await fs.promises.writeFile(
        this.cacheFilePath,
        JSON.stringify(serializable),
        'utf-8'
      );

      console.log('[EPG] Cache saved to:', this.cacheFilePath);
    } catch (error) {
      console.error('[EPG] Failed to save cache:', error);
    }
  }

  /**
   * Load EPG data from cache
   */
  private async loadFromCache(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        return false;
      }

      const content = await fs.promises.readFile(this.cacheFilePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate cache version
      if (data.version !== EPG_CACHE_VERSION) {
        console.log('[EPG] Cache version mismatch, ignoring');
        return false;
      }

      // Check TTL
      const age = Date.now() - data.generatedAt;
      if (age > data.ttl) {
        console.log('[EPG] Cache expired, ignoring');
        return false;
      }

      // Restore Maps
      this.channels = new Map(Object.entries(data.channels));
      this.programs = new Map(Object.entries(data.programs));

      return true;
    } catch (error) {
      console.error('[EPG] Failed to load cache:', error);
      return false;
    }
  }
}

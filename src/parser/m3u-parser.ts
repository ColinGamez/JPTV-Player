import type { Channel, ParsedPlaylist, ParserResult, SkipReason } from '../types/channel';
import * as crypto from 'crypto';

/**
 * Parse M3U/M3U8 playlist content into structured channel data
 */
export function parseM3U(content: string, debug = false): ParserResult {
  try {
    const lines = content.split(/\r?\n/).map(line => line.trim());
    
    if (lines.length === 0 || !lines[0].startsWith('#EXTM3U')) {
      return {
        success: false,
        error: 'Invalid M3U file: Missing #EXTM3U header'
      };
    }

    const channels: Channel[] = [];
    const skippedReasons: SkipReason[] = [];
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('#EXTINF:')) {
        const nextLine = lines[i + 1];
        
        // Check if next line is a valid URL (not empty, not a comment)
        if (!nextLine || nextLine.startsWith('#') || nextLine.trim() === '') {
          skippedCount++;
          skippedReasons.push({
            line: i + 1,
            reason: 'Missing or invalid URL after EXTINF',
            content: line.substring(0, 60)
          });
          continue;
        }

        const channel = parseExtinf(line, nextLine);
        if (channel) {
          channels.push(channel);
        } else {
          skippedCount++;
          skippedReasons.push({
            line: i + 1,
            reason: 'Failed to extract channel name',
            content: line.substring(0, 60)
          });
        }
        
        i++; // Skip the URL line as we've already processed it
      }
    }

    if (debug && skippedReasons.length > 0) {
      console.log(`[M3U Parser] Skipped ${skippedCount} entries:`);
      skippedReasons.forEach(({ line, reason, content }) => {
        console.log(`  Line ${line}: ${reason}`);
        if (content) console.log(`    Content: ${content}...`);
      });
    }

    const categories = buildCategories(channels);

    return {
      success: true,
      data: { channels, categories },
      skippedCount,
      skipped: skippedReasons.length > 0 ? skippedReasons : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Parse a single EXTINF line into a Channel object
 * Handles multiple formats:
 * - Full: #EXTINF:-1 tvg-id="123" tvg-name="Name" tvg-logo="url" group-title="Group",Display Name
 * - Minimal: #EXTINF:-1,Channel Name
 * - No attributes: #EXTINF:123,Channel Name
 */
function parseExtinf(extinfLine: string, urlLine: string): Channel | null {
  try {
    const url = urlLine.trim();
    if (!url || url.startsWith('#')) {
      return null;
    }

    // Extract content after #EXTINF:
    // Format: #EXTINF:duration [attributes],name
    const match = extinfLine.match(/#EXTINF:([^,]*),(.*)$/);
    if (!match) {
      return null;
    }

    const beforeComma = match[1]; // duration and attributes
    const afterComma = match[2].trim(); // display name

    // Parse attributes (may be empty)
    const attributes = parseAttributes(beforeComma);
    
    // Determine channel name: prefer text after comma, fallback to tvg-name
    const name = afterComma || attributes['tvg-name'] || 'Unknown Channel';
    if (!name || name === 'Unknown Channel') {
      return null; // Can't determine channel name
    }

    // Extract optional attributes with sensible defaults
    const tvgId = attributes['tvg-id'] || '';
    const id = tvgId || generateId(name, url);
    const group = attributes['group-title'] || 'Uncategorized';
    const logo = attributes['tvg-logo'] || '';
    const tvgName = attributes['tvg-name'];

    return {
      id,
      name,
      group,
      logo,
      url,
      urls: [url], // Initialize with single URL
      tvgName,
      metadata: attributes
    };
  } catch (error) {
    // Silent fail - invalid entry
    return null;
  }
}

/**
 * Parse attribute string into key-value pairs
 * Handles: tvg-id="123" tvg-name="Name" group-title="Group"
 * Also handles: no attributes at all
 */
function parseAttributes(attrStr: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  
  if (!attrStr || !attrStr.trim()) {
    return attributes;
  }
  
  // Match key="value" or key='value' patterns
  const attrRegex = /(\S+?)=["']([^"']*?)["']/g;
  let match: RegExpExecArray | null;
  
  while ((match = attrRegex.exec(attrStr)) !== null) {
    const key = match[1];
    const value = match[2];
    attributes[key] = value;
  }
  
  return attributes;
}

/**
 * Generate a unique ID from channel name and URL
 */
function generateId(name: string, url: string): string {
  const hash = crypto.createHash('md5');
  hash.update(`${name}:${url}`);
  return hash.digest('hex').substring(0, 8);
}

/**
 * Build category map from channels
 */
function buildCategories(channels: Channel[]): Map<string, Channel[]> {
  const categories = new Map<string, Channel[]>();
  
  for (const channel of channels) {
    const group = channel.group || 'Uncategorized';
    
    if (!categories.has(group)) {
      categories.set(group, []);
    }
    
    categories.get(group)!.push(channel);
  }
  
  // Sort channels within each category by name
  for (const [_, channelList] of categories) {
    channelList.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }
  
  return categories;
}

/**
 * Get all unique categories from channels
 */
export function getCategories(channels: Channel[]): string[] {
  const categories = new Set<string>();
  
  for (const channel of channels) {
    categories.add(channel.group);
  }
  
  return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ja'));
}

/**
 * Filter channels by category
 */
export function filterByCategory(channels: Channel[], category: string): Channel[] {
  if (!category || category === 'すべて' || category === 'All') {
    return channels;
  }
  
  return channels.filter(c => c.group === category);
}

/**
 * Validate M3U content
 */
export function isValidM3U(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }
  
  const lines = content.trim().split(/\r?\n/);
  return lines.length > 0 && lines[0].trim().startsWith('#EXTM3U');
}

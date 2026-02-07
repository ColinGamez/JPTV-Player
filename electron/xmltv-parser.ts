/**
 * XMLTV Parser for EPG data
 * Handles timezone conversion and malformed entries gracefully
 */

import * as fs from 'fs';
import { parseStringPromise } from 'xml2js';
import type { EpgChannel, EpgProgram, XmltvParseResult } from '../src/types/epg';

interface XmltvRoot {
  tv?: {
    $?: { [key: string]: string };
    channel?: Array<{
      $: { id: string };
      'display-name'?: Array<string | { _: string }>;
      icon?: Array<{ $: { src: string } }>;
    }>;
    programme?: Array<{
      $: {
        channel: string;
        start: string;
        stop: string;
      };
      title?: Array<string | { _: string; $?: { lang?: string } }>;
      desc?: Array<string | { _: string; $?: { lang?: string } }>;
      category?: Array<string | { _: string }>;
      'episode-num'?: Array<string | { _: string }>;
      rating?: Array<{
        value?: Array<string>;
      }>;
      credits?: Array<{
        director?: Array<string>;
        actor?: Array<string>;
        writer?: Array<string>;
      }>;
    }>;
  };
}

/**
 * Parse XMLTV timestamp to Unix timestamp (ms)
 * Format: YYYYMMDDHHmmss +ZZZZ
 * Example: 20240204120000 +0900
 */
function parseXmltvTime(timeStr: string): number {
  try {
    // Extract date/time and timezone
    const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }

    const [, year, month, day, hour, minute, second, timezone] = match;
    
    // Create date in UTC
    const utcDate = Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );

    // Apply timezone offset if present
    if (timezone) {
      const sign = timezone[0] === '+' ? 1 : -1;
      const tzHours = parseInt(timezone.substring(1, 3));
      const tzMinutes = parseInt(timezone.substring(3, 5));
      const tzOffsetMs = sign * (tzHours * 60 + tzMinutes) * 60 * 1000;
      
      // Subtract timezone offset to get actual UTC time
      return utcDate - tzOffsetMs;
    }

    return utcDate;
  } catch (error) {
    console.error(`Failed to parse XMLTV time: ${timeStr}`, error);
    return 0;
  }
}

/**
 * Extract text from XMLTV element (handles both string and object forms)
 */
function extractText(value: string | { _: string } | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._;
}

/**
 * Extract array of texts from XMLTV elements
 */
function extractTextArray(arr: Array<string | { _: string }> | undefined): string[] {
  if (!arr) return [];
  return arr.map(item => extractText(item)).filter((t): t is string => !!t);
}

/**
 * Parse XMLTV file and return structured EPG data
 */
export async function parseXmltvFile(filePath: string): Promise<XmltvParseResult> {
  const startTime = Date.now();
  const channels = new Map<string, EpgChannel>();
  const programs = new Map<string, EpgProgram[]>();
  
  try {
    // Guard against files large enough to OOM the main process
    const fileStat = await fs.promises.stat(filePath);
    const MAX_XMLTV_SIZE = 200 * 1024 * 1024; // 200 MB
    if (fileStat.size > MAX_XMLTV_SIZE) {
      throw new Error(
        `XMLTV file too large (${Math.round(fileStat.size / 1024 / 1024)}MB). ` +
        `Maximum supported size is ${MAX_XMLTV_SIZE / 1024 / 1024}MB to prevent memory exhaustion.`
      );
    }

    // Read file
    const xmlContent = await fs.promises.readFile(filePath, 'utf-8');
    
    // Parse XML
    const result: XmltvRoot = await parseStringPromise(xmlContent, {
      trim: true,
      explicitArray: true,
      mergeAttrs: false
    });

    if (!result.tv) {
      throw new Error('Invalid XMLTV format: missing <tv> root element');
    }

    // Parse channels
    let channelCount = 0;
    if (result.tv.channel) {
      for (const chan of result.tv.channel) {
        try {
          const id = chan.$.id;
          if (!id) continue;

          const displayNames = chan['display-name'] || [];
          const displayName = extractText(displayNames[0]) || id;
          const icon = chan.icon?.[0]?.$?.src;

          channels.set(id, {
            id,
            displayName,
            icon
          });
          channelCount++;
        } catch (error) {
          // Skip malformed channel entry
          console.warn('Skipping malformed channel entry:', error);
        }
      }
    }

    // Parse programs
    let programCount = 0;
    if (result.tv.programme) {
      for (const prog of result.tv.programme) {
        try {
          const channelId = prog.$.channel;
          if (!channelId) continue;

          const start = parseXmltvTime(prog.$.start);
          const stop = parseXmltvTime(prog.$.stop);
          
          if (start === 0 || stop === 0 || start >= stop) {
            continue; // Skip invalid times
          }

          const titles = prog.title || [];
          const title = extractText(titles[0]) || 'Unknown Program';
          
          const descriptions = prog.desc || [];
          const description = extractText(descriptions[0]);
          
          const categories = extractTextArray(prog.category || []);
          
          const episodeNums = prog['episode-num'] || [];
          const episodeNum = extractText(episodeNums[0]);
          
          const rating = prog.rating?.[0]?.value?.[0];
          
          let credits: EpgProgram['credits'] | undefined;
          if (prog.credits?.[0]) {
            const creditsData = prog.credits[0];
            credits = {
              directors: creditsData.director,
              actors: creditsData.actor,
              writers: creditsData.writer
            };
          }

          const program: EpgProgram = {
            channelId,
            title,
            description,
            start,
            stop,
            categories,
            episodeNum,
            rating,
            credits
          };

          // Add to programs map
          if (!programs.has(channelId)) {
            programs.set(channelId, []);
          }
          programs.get(channelId)!.push(program);
          programCount++;
        } catch (error) {
          // Skip malformed program entry
          console.warn('Skipping malformed program entry:', error);
        }
      }
    }

    // Sort programs by start time for each channel
    for (const [channelId, channelPrograms] of programs.entries()) {
      channelPrograms.sort((a, b) => a.start - b.start);
    }

    const parseTime = Date.now() - startTime;

    return {
      success: true,
      channels,
      programs,
      channelCount,
      programCount,
      parseTime
    };
  } catch (error) {
    const parseTime = Date.now() - startTime;
    return {
      success: false,
      channels,
      programs,
      channelCount: 0,
      programCount: 0,
      parseTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

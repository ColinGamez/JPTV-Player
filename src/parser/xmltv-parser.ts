/**
 * XMLTV Parser
 * 
 * Parses XMLTV format EPG data and provides efficient lookups by channel ID.
 * Handles JST (Japan Standard Time, UTC+9) timezone conversions.
 */

export interface XmltvProgramme {
  channelId: string;        // tvg-id from channel
  start: Date;              // Start time (converted to local time)
  stop: Date;               // End time (converted to local time)
  title: string;            // Program title
  description?: string;     // Program description
  category?: string;        // Genre/category
  episode?: string;         // Episode number
}

export interface XmltvChannel {
  id: string;
  displayName: string;
  icon?: string;
}

export interface XmltvData {
  channels: Map<string, XmltvChannel>;
  programmes: Map<string, XmltvProgramme[]>; // Indexed by channel ID
}

/**
 * Parse XMLTV timestamp to Date object
 * Format: "20240204120000 +0900" or "20240204120000"
 */
function parseXmltvTime(timeStr: string): Date {
  // Extract the date/time portion (YYYYMMDDHHmmss)
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  
  if (!match) {
    throw new Error(`Invalid XMLTV time format: ${timeStr}`);
  }

  const [, year, month, day, hour, minute, second, timezone] = match;
  
  // Create date string in ISO format
  const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
  if (timezone) {
    // Parse timezone offset (+0900 -> +09:00)
    const tzHours = timezone.slice(0, 3);
    const tzMinutes = timezone.slice(3);
    return new Date(`${dateStr}${tzHours}:${tzMinutes}`);
  } else {
    // Assume JST (UTC+9) if no timezone specified
    return new Date(`${dateStr}+09:00`);
  }
}

/**
 * Extract text content from XML element
 */
function getElementText(element: Element, tagName: string): string | undefined {
  const el = element.querySelector(tagName);
  return el?.textContent?.trim() || undefined;
}

/**
 * Parse XMLTV XML string
 */
export function parseXmltv(xmlString: string): XmltvData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  // Check for parse errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML parsing error: ${parserError.textContent}`);
  }

  const channels = new Map<string, XmltvChannel>();
  const programmes = new Map<string, XmltvProgramme[]>();

  // Parse channels
  const channelElements = doc.querySelectorAll('channel');
  channelElements.forEach(channelEl => {
    const id = channelEl.getAttribute('id');
    if (!id) return;

    const displayName = getElementText(channelEl, 'display-name') || id;
    const iconEl = channelEl.querySelector('icon');
    const icon = iconEl?.getAttribute('src') || undefined;

    channels.set(id, { id, displayName, icon });
  });

  // Parse programmes
  const programmeElements = doc.querySelectorAll('programme');
  programmeElements.forEach(progEl => {
    const channelId = progEl.getAttribute('channel');
    const startStr = progEl.getAttribute('start');
    const stopStr = progEl.getAttribute('stop');

    if (!channelId || !startStr || !stopStr) return;

    try {
      const start = parseXmltvTime(startStr);
      const stop = parseXmltvTime(stopStr);
      const title = getElementText(progEl, 'title') || 'Unknown';
      const description = getElementText(progEl, 'desc');
      const category = getElementText(progEl, 'category');
      
      // Parse episode number if present
      const episodeEl = progEl.querySelector('episode-num');
      const episode = episodeEl?.textContent?.trim() || undefined;

      const programme: XmltvProgramme = {
        channelId,
        start,
        stop,
        title,
        description,
        category,
        episode,
      };

      // Add to programmes map
      if (!programmes.has(channelId)) {
        programmes.set(channelId, []);
      }
      programmes.get(channelId)!.push(programme);
    } catch (error) {
      console.warn(`[XMLTV] Failed to parse programme:`, error);
    }
  });

  // Sort programmes by start time for each channel
  programmes.forEach(progs => {
    progs.sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  return { channels, programmes };
}

/**
 * Get current and next programme for a channel
 */
export function getCurrentAndNext(
  programmes: XmltvProgramme[],
  now: Date = new Date()
): { current?: XmltvProgramme; next?: XmltvProgramme } {
  const nowTime = now.getTime();
  
  let current: XmltvProgramme | undefined;
  let next: XmltvProgramme | undefined;

  for (let i = 0; i < programmes.length; i++) {
    const prog = programmes[i];
    const startTime = prog.start.getTime();
    const stopTime = prog.stop.getTime();

    // Current programme: start <= now < stop
    if (startTime <= nowTime && nowTime < stopTime) {
      current = prog;
      next = programmes[i + 1]; // Next programme is the one after
      break;
    }

    // If this programme starts in the future, it's the next one
    if (startTime > nowTime) {
      next = prog;
      break;
    }
  }

  return { current, next };
}

/**
 * Format time for display (HH:MM)
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format duration in minutes
 */
export function getDurationMinutes(start: Date, stop: Date): number {
  return Math.round((stop.getTime() - start.getTime()) / 1000 / 60);
}

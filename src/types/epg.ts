/**
 * Electronic Program Guide (EPG) types
 */

export interface EpgChannel {
  id: string;
  displayName: string;
  icon?: string;
}

export interface EpgProgram {
  channelId: string;
  title: string;
  description?: string;
  start: number; // Unix timestamp (ms)
  stop: number;  // Unix timestamp (ms)
  categories?: string[];
  episodeNum?: string;
  rating?: string;
  credits?: {
    directors?: string[];
    actors?: string[];
    writers?: string[];
  };
}

export interface EpgNowNext {
  now: EpgProgram | null;
  next: EpgProgram | null;
  progress: number; // 0-1 for current program
}

export interface EpgGuideWindow {
  startTime: number;
  endTime: number;
  channels: Array<{
    channelId: string;
    programs: EpgProgram[];
  }>;
}

export interface EpgCache {
  version: string;
  generatedAt: number;
  ttl: number; // milliseconds
  channels: Map<string, EpgChannel>;
  programs: Map<string, EpgProgram[]>; // channelId -> programs[]
}

export interface XmltvParseResult {
  success: boolean;
  channels: Map<string, EpgChannel>;
  programs: Map<string, EpgProgram[]>;
  channelCount: number;
  programCount: number;
  parseTime: number;
  error?: string;
}

export const EPG_CACHE_VERSION = '1.0';
export const EPG_DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 hours

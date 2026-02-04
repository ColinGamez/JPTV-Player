export interface Channel {
  id: string;
  name: string;
  group: string;
  logo: string;
  url: string;              // Primary URL (for backwards compatibility)
  urls: string[];           // All available URLs (fallback support)
  lastSuccessfulUrl?: string; // Last URL that worked
  tvgName?: string;
  metadata?: Record<string, string>;
}

export interface ParsedPlaylist {
  channels: Channel[];
  categories: Map<string, Channel[]>;
}

export interface SkipReason {
  line: number;
  reason: string;
  content?: string;
}

export interface ParserResult {
  success: boolean;
  data?: ParsedPlaylist;
  error?: string;
  skippedCount?: number;
  skipped?: SkipReason[];
}

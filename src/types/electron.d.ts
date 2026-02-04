import type { EpgNowNext, EpgGuideWindow, EpgProgram, EpgChannel, XmltvParseResult } from './epg';
import type { Profile, ProfileSession, CreateProfileRequest, LoginRequest, ProfileData } from './profile';

export interface AppSettings {
  lastPlaylist?: string;
  lastChannelId?: string; // Changed to string to support parsed channel IDs
  lastChannelIndex?: number; // Store the array index for quick access
  channelHistory: string[]; // Stack of channel IDs (max 50)
  favorites: number[];
  volume: number;
}

export interface PlaylistFile {
  path: string;
  content: string;
  parseResult?: {
    success: boolean;
    data?: {
      channels: any[];
      categories: Record<string, any[]>;
    };
    error?: string;
    skippedCount?: number;
  };
}

export interface PlayerResult {
  success: boolean;
  error?: string;
}

export interface PlayerVolumeResult {
  volume: number;
}

export interface PlayerStateResult {
  state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'error';
}

export interface PlayerPlayingResult {
  playing: boolean;
}

export interface ChannelHealth {
  channelId: string;
  score: number;
  samples: number;
  lastUpdate: number;
  stats: {
    avgBitrate: number;
    dropRate: number;
    bufferIssues: number;
  };
}

export interface RecordingInfo {
  channelId: string;
  channelName: string;
  filePath: string;
  startTime: number;
}

export interface ElectronAPI {
  openPlaylist: () => Promise<PlaylistFile | null>;
  readFile: (filePath: string) => Promise<string>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  getSetting: <K extends keyof AppSettings>(key: K) => Promise<AppSettings[K]>;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<boolean>;
  
  shell: {
    openExternal: (url: string) => Promise<void>;
  };

  window: {
    toggleFullscreen: () => Promise<boolean>;
    setFullscreen: (fullscreen: boolean) => Promise<void>;
    isFullscreen: () => Promise<boolean>;
  };

  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
  };
  
  player: {
    play: (url: string) => Promise<PlayerResult>;
    stop: () => Promise<PlayerResult>;
    pause: () => Promise<PlayerResult>;
    resume: () => Promise<PlayerResult>;
    setVolume: (volume: number) => Promise<PlayerResult>;
    getVolume: () => Promise<PlayerVolumeResult>;
    getState: () => Promise<PlayerStateResult>;
    isPlaying: () => Promise<PlayerPlayingResult>;
    playWithFallback: (channelId: string, urls: string[], lastSuccessfulUrl?: string) => Promise<PlayerResult & { url?: string }>;
    retryFallback: (channelId: string) => Promise<PlayerResult & { url?: string }>;
    getLastSuccessfulUrl: (channelId: string) => Promise<string | null>;
    setAudioOnly: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    getAudioOnly: () => Promise<boolean>;
  };
  
  vlc: {
    getAudioLevel: () => Promise<number>;
    setAudioGain: (gainDb: number) => Promise<void>;
  };
  
  health: {
    getScore: (channelId: string) => Promise<ChannelHealth | null>;
    getAllScores: () => Promise<ChannelHealth[]>;
    clear: (channelId?: string) => Promise<void>;
  };
  
  recording: {
    start: (channelId: string, channelName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    stop: (channelId: string) => Promise<{ success: boolean; error?: string }>;
    isRecording: (channelId?: string) => Promise<boolean>;
    getInfo: (channelId: string) => Promise<RecordingInfo | null>;
    getActive: () => Promise<RecordingInfo[]>;
    getPath: () => Promise<string>;
  };

  epg: {
    loadXmltv: (filePath: string) => Promise<XmltvParseResult>;
    openXmltvFile: () => Promise<{ filePath: string; parseResult: XmltvParseResult } | null>;
    getNowNext: (channelId: string) => Promise<EpgNowNext>;
    getGuideWindow: (channelIds: string[], startTime: number, endTime: number) => Promise<EpgGuideWindow>;
    getProgramsForDate: (channelId: string, dateStr: string) => Promise<EpgProgram[]>;
    getChannel: (channelId: string) => Promise<EpgChannel | null>;
    getAllChannels: () => Promise<EpgChannel[]>;
    getStats: () => Promise<{ channels: number; totalPrograms: number; isLoaded: boolean }>;
    clear: () => Promise<void>;
  };

  profile: {
    list: () => Promise<Profile[]>;
    create: (request: CreateProfileRequest) => Promise<Profile>;
    delete: (profileId: string) => Promise<void>;
    login: (request: LoginRequest) => Promise<ProfileSession>;
    logout: () => Promise<void>;
    getActive: () => Promise<ProfileSession | null>;
    getLastActive: () => Promise<string | null>;
    updateData: (data: Partial<ProfileData>) => Promise<void>;
    save: () => Promise<void>;
    verifyPin: (profileId: string, pin: string) => Promise<boolean>;
  };

  shell: {
    openExternal: (url: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: ElectronAPI;
  }
}

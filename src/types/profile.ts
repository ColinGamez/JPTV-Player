/**
 * Profile System Types
 * 
 * Local user profiles with optional PIN security for offline IPTV app.
 */

export interface Profile {
  id: string;                 // Unique profile ID (UUID)
  name: string;               // Display name
  avatar?: string;            // Optional avatar emoji/icon
  hasPin: boolean;            // Whether profile requires PIN
  pinHash?: string;           // PBKDF2 hash of PIN (never plaintext)
  createdAt: number;          // Unix timestamp
  lastLogin?: number;         // Unix timestamp of last login
}

export interface ProfileData {
  // Profile-specific settings and state
  favorites: number[];
  channelHistory?: string[];      // Last viewed channels (most recent first)
  lastChannelId?: string;
  lastChannelIndex?: number;
  lastCategory?: string;
  volume?: number;                // Volume level (0-100)
  playlistPath?: string;          // Path to loaded M3U playlist file
  audioNormalizationSettings?: {
    enabled: boolean;
    targetLevel: number;          // Target audio level in dB (LUFS)
    maxGainAdjustment: number;    // Maximum gain correction in dB
    samplingInterval: number;     // Sampling interval in ms
    adaptationSpeed: number;      // Adaptation speed (0-1)
  };
  audioProfiles?: Record<string, {
    channelId: string;
    avgLevel: number;
    sampleCount: number;
    appliedGain: number;
    manualGain?: number;
  }>;
  // Parental lock settings
  parentalLockEnabled?: boolean;
  lockedCategories?: string[];    // Category names that require unlock
  lockedChannels?: string[];      // Channel IDs that require unlock
  unlockDurationMinutes?: number; // How long unlock lasts (default 10)
  // EPG preferences
  epgEnabled?: boolean;           // Default true
  epgTimeSpanHours?: number;      // 24, 48, or 72 (default 48)
  epgTimeBlockMinutes?: number;   // 15, 30, or 60 (default 30)
  epgChannelOrder?: 'playlist' | 'alphabetical' | 'favorites-first'; // Default 'playlist'
  epgHiddenCategories?: string[]; // Categories to hide in EPG
  epgHiddenChannels?: string[];   // Channels to hide in EPG
  epgFavoritesOnly?: boolean;     // Show only favorite channels
  lastEpgViewState?: {
    scrollX?: number;
    scrollY?: number;
    focusedChannelId?: string;
    focusedTimeMs?: number;
  };
  // TV Box mode preferences
  isFullscreen?: boolean;         // Fullscreen state
  audioOnlyMode?: boolean;        // Audio-only playback mode
  autoLoginEnabled?: boolean;     // Auto-login on startup (default true for TV mode)
}

export interface ProfilesIndex {
  version: string;            // Index format version
  profiles: Profile[];        // All profiles
  lastActiveProfileId?: string; // Last used profile for auto-login
}

export interface CreateProfileRequest {
  name: string;
  pin?: string;               // Optional 4-6 digit PIN
  avatar?: string;
}

export interface LoginRequest {
  profileId: string;
  pin?: string;
}

export interface ProfileSession {
  profile: Profile;
  data: ProfileData;
  loggedInAt: number;
}

export const PROFILES_INDEX_VERSION = '1.0';
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 6;

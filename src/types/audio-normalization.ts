/**
 * Audio normalization types
 */

export interface ChannelAudioProfile {
  channelId: string | number;
  averageLevel: number; // Average audio level in dB
  sampleCount: number;
  lastUpdated: number;
  userGainOverride?: number; // User-specified gain adjustment in dB
}

export interface AudioNormalizationSettings {
  enabled: boolean;
  targetLevel: number; // Target audio level in dB (default: -23 LUFS)
  maxGainAdjustment: number; // Maximum gain correction in dB (default: 12)
  samplingInterval: number; // How often to sample audio level in ms (default: 1000)
  adaptationSpeed: number; // How quickly to adapt to new levels (0-1, default: 0.1)
}

export interface AudioLevelSample {
  timestamp: number;
  level: number; // Current audio level in dB
  channelId: string | number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioNormalizationSettings = {
  enabled: true,
  targetLevel: -23, // Standard LUFS target
  maxGainAdjustment: 12,
  samplingInterval: 1000,
  adaptationSpeed: 0.1
};

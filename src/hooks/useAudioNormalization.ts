import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  ChannelAudioProfile, 
  AudioNormalizationSettings, 
  AudioLevelSample 
} from '../types/audio-normalization';
import { DEFAULT_AUDIO_SETTINGS } from '../types/audio-normalization';

const STORAGE_KEY_PROFILES = 'jptv-audio-profiles';
const STORAGE_KEY_SETTINGS = 'jptv-audio-settings';

/**
 * Hook for per-channel audio normalization
 */
export function useAudioNormalization() {
  const [profiles, setProfiles] = useState<Map<string | number, ChannelAudioProfile>>(new Map());
  const [settings, setSettings] = useState<AudioNormalizationSettings>(DEFAULT_AUDIO_SETTINGS);
  const [currentChannelId, setCurrentChannelId] = useState<string | number | null>(null);
  const samplingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  // Load persisted data on mount
  useEffect(() => {
    loadPersistedData();
  }, []);

  // Persist data when profiles or settings change
  useEffect(() => {
    persistData();
  }, [profiles, settings]);

  /**
   * Load persisted audio profiles and settings from localStorage
   */
  const loadPersistedData = useCallback(() => {
    try {
      // Load profiles
      const storedProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles);
        const profileMap = new Map<string | number, ChannelAudioProfile>();
        Object.entries(parsed).forEach(([key, value]) => {
          profileMap.set(key, value as ChannelAudioProfile);
        });
        setProfiles(profileMap);
      }

      // Load settings
      const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error('Failed to load audio normalization data:', error);
    }
  }, []);

  /**
   * Persist audio profiles and settings to localStorage
   */
  const persistData = useCallback(() => {
    try {
      // Convert Map to object for storage
      const profilesObj = Object.fromEntries(profiles);
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profilesObj));
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to persist audio normalization data:', error);
    }
  }, [profiles, settings]);

  /**
   * Get current audio level from VLC player
   */
  const getCurrentAudioLevel = useCallback(async (): Promise<number | null> => {
    try {
      if (!window.electron?.vlc) return null;
      const level = await window.electron.vlc.getAudioLevel();
      return level;
    } catch (error) {
      console.error('Failed to get audio level:', error);
      return null;
    }
  }, []);

  /**
   * Calculate required gain adjustment for a channel
   */
  const calculateGainAdjustment = useCallback((profile: ChannelAudioProfile): number => {
    if (!settings.enabled) return 0;
    
    // Apply user override if set
    if (profile.userGainOverride !== undefined) {
      return profile.userGainOverride;
    }

    // Calculate gain needed to reach target level
    const currentLevel = profile.averageLevel;
    let gainAdjustment = settings.targetLevel - currentLevel;

    // Clamp to max adjustment
    gainAdjustment = Math.max(
      -settings.maxGainAdjustment,
      Math.min(settings.maxGainAdjustment, gainAdjustment)
    );

    return gainAdjustment;
  }, [settings]);

  /**
   * Apply gain correction to VLC player
   */
  const applyGainCorrection = useCallback(async (gainDb: number): Promise<boolean> => {
    try {
      if (!window.electron?.vlc) return false;
      await window.electron.vlc.setAudioGain(gainDb);
      return true;
    } catch (error) {
      console.error('Failed to apply gain correction:', error);
      return false;
    }
  }, []);

  /**
   * Update audio profile with new sample
   */
  const updateProfile = useCallback((sample: AudioLevelSample) => {
    setProfiles(prevProfiles => {
      const newProfiles = new Map(prevProfiles);
      const existing = newProfiles.get(sample.channelId);

      if (existing) {
        // Use exponential moving average for smooth adaptation
        const alpha = settings.adaptationSpeed;
        const newAverage = (1 - alpha) * existing.averageLevel + alpha * sample.level;
        
        newProfiles.set(sample.channelId, {
          ...existing,
          averageLevel: newAverage,
          sampleCount: existing.sampleCount + 1,
          lastUpdated: sample.timestamp
        });
      } else {
        // Create new profile
        newProfiles.set(sample.channelId, {
          channelId: sample.channelId,
          averageLevel: sample.level,
          sampleCount: 1,
          lastUpdated: sample.timestamp
        });
      }

      return newProfiles;
    });
  }, [settings.adaptationSpeed]);

  /**
   * Start monitoring audio levels for current channel
   */
  const startMonitoring = useCallback((channelId: string | number) => {
    // Stop existing monitoring
    if (samplingIntervalRef.current) {
      clearInterval(samplingIntervalRef.current);
    }

    setCurrentChannelId(channelId);
    isMonitoringRef.current = true;

    // Start sampling at configured interval
    samplingIntervalRef.current = setInterval(async () => {
      if (!isMonitoringRef.current) return;

      const level = await getCurrentAudioLevel();
      if (level !== null) {
        const sample: AudioLevelSample = {
          timestamp: Date.now(),
          level,
          channelId
        };
        updateProfile(sample);
      }
    }, settings.samplingInterval);
  }, [getCurrentAudioLevel, updateProfile, settings.samplingInterval]);

  /**
   * Stop monitoring audio levels
   */
  const stopMonitoring = useCallback(() => {
    if (samplingIntervalRef.current) {
      clearInterval(samplingIntervalRef.current);
      samplingIntervalRef.current = null;
    }
    isMonitoringRef.current = false;
    setCurrentChannelId(null);
  }, []);

  /**
   * Switch to a channel and apply appropriate gain correction
   */
  const switchChannel = useCallback(async (channelId: string | number): Promise<void> => {
    // Stop monitoring previous channel
    stopMonitoring();

    // Get profile for new channel
    const profile = profiles.get(channelId);
    
    if (profile && settings.enabled) {
      // Calculate and apply gain correction
      const gain = calculateGainAdjustment(profile);
      await applyGainCorrection(gain);
    } else {
      // Reset to neutral gain
      await applyGainCorrection(0);
    }

    // Start monitoring new channel
    startMonitoring(channelId);
  }, [profiles, settings.enabled, calculateGainAdjustment, applyGainCorrection, startMonitoring, stopMonitoring]);

  /**
   * Set user gain override for a channel
   */
  const setUserGainOverride = useCallback((channelId: string | number, gainDb: number | undefined) => {
    setProfiles(prevProfiles => {
      const newProfiles = new Map(prevProfiles);
      const existing = newProfiles.get(channelId);

      if (existing) {
        newProfiles.set(channelId, {
          ...existing,
          userGainOverride: gainDb,
          lastUpdated: Date.now()
        });
      } else {
        // Create new profile with override
        newProfiles.set(channelId, {
          channelId,
          averageLevel: 0,
          sampleCount: 0,
          lastUpdated: Date.now(),
          userGainOverride: gainDb
        });
      }

      return newProfiles;
    });

    // If this is the current channel, apply the change immediately
    if (channelId === currentChannelId) {
      applyGainCorrection(gainDb ?? 0);
    }
  }, [currentChannelId, applyGainCorrection]);

  /**
   * Reset profile for a channel
   */
  const resetChannelProfile = useCallback((channelId: string | number) => {
    setProfiles(prevProfiles => {
      const newProfiles = new Map(prevProfiles);
      newProfiles.delete(channelId);
      return newProfiles;
    });

    // Reset gain if this is the current channel
    if (channelId === currentChannelId) {
      applyGainCorrection(0);
    }
  }, [currentChannelId, applyGainCorrection]);

  /**
   * Update normalization settings
   */
  const updateSettings = useCallback((newSettings: Partial<AudioNormalizationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));

    // If monitoring, restart with new interval
    if (isMonitoringRef.current && currentChannelId !== null) {
      stopMonitoring();
      startMonitoring(currentChannelId);
    }
  }, [currentChannelId, startMonitoring, stopMonitoring]);

  /**
   * Get profile for a channel
   */
  const getChannelProfile = useCallback((channelId: string | number): ChannelAudioProfile | undefined => {
    return profiles.get(channelId);
  }, [profiles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    profiles: Array.from(profiles.values()),
    settings,
    currentChannelId,
    isMonitoring: isMonitoringRef.current,

    // Actions
    switchChannel,
    setUserGainOverride,
    resetChannelProfile,
    updateSettings,
    getChannelProfile,
    startMonitoring,
    stopMonitoring
  };
}

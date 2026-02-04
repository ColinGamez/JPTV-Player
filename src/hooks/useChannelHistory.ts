import { useCallback } from 'react';
import type { Channel } from '../types/channel';
import type { AppSettings } from '../types/electron';
import type { ProfileData } from '../types/profile';

const MAX_HISTORY_SIZE = 50;

// Generic type that accepts both AppSettings and ProfileData
type SettingsWithHistory = AppSettings | ProfileData;

export function useChannelHistory<T extends SettingsWithHistory>(
  settings: T,
  updateSetting: <K extends keyof T>(key: K, value: T[K]) => Promise<void>
) {
  /**
   * Add channel to history stack
   */
  const addToHistory = useCallback(async (channelId: string) => {
    const history = settings.channelHistory || [];
    
    // Remove if already in history (move to top)
    const filtered = history.filter(id => id !== channelId);
    
    // Add to front
    const newHistory = [channelId, ...filtered];
    
    // Limit size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.length = MAX_HISTORY_SIZE;
    }
    
    await updateSetting('channelHistory', newHistory);
  }, [settings.channelHistory, updateSetting]);

  /**
   * Get previous channel from history
   */
  const getPreviousChannel = useCallback((): string | null => {
    const history = settings.channelHistory || [];
    // Index 0 is current, index 1 is previous
    return history.length > 1 ? history[1] : null;
  }, [settings.channelHistory]);

  /**
   * Get channel history
   */
  const getHistory = useCallback((): string[] => {
    return settings.channelHistory || [];
  }, [settings.channelHistory]);

  /**
   * Clear history
   */
  const clearHistory = useCallback(async () => {
    await updateSetting('channelHistory', []);
  }, [updateSetting]);

  return {
    addToHistory,
    getPreviousChannel,
    getHistory,
    clearHistory
  };
}

/**
 * Save last played channel
 */
export async function saveLastChannel(
  channel: { id: string | number; [key: string]: any },  // Accept any object with id
  channelIndex: number,
  updateSetting: (key: string, value: any) => Promise<void>
) {
  const channelId = String(channel.id);
  await updateSetting('lastChannelId', channelId);
  await updateSetting('lastChannelIndex', channelIndex);
}

/**
 * Find channel by ID in channel list
 */
export function findChannelById(channels: any[], channelId: string): { channel: any; index: number } | null {
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const id = String(ch.id);
    if (id === channelId) {
      return { channel: ch, index: i };
    }
  }
  return null;
}

/**
 * Find channel by index (1-based for user input)
 */
export function findChannelByNumber(channels: any[], number: number): { channel: any; index: number } | null {
  const index = number - 1; // Convert to 0-based
  if (index >= 0 && index < channels.length) {
    return { channel: channels[index], index };
  }
  return null;
}

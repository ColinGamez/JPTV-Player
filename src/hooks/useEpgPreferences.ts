/**
 * EPG Preferences Hook
 * 
 * Manages profile-scoped EPG preferences with persistence
 */

import { useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import type { ProfileSession } from '../types/profile';

export interface EpgPreferences {
  enabled: boolean;
  timeSpanHours: number;
  timeBlockMinutes: number;
  channelOrder: 'playlist' | 'alphabetical' | 'favorites-first';
  hiddenCategories: string[];
  hiddenChannels: string[];
  favoritesOnly: boolean;
  lastViewState: {
    scrollX?: number;
    scrollY?: number;
    focusedChannelId?: string;
    focusedTimeMs?: number;
  };
}

export interface EpgPreferencesHook {
  prefs: EpgPreferences;
  updatePrefs: (partial: Partial<EpgPreferences>) => Promise<void>;
  saveViewState: (state: EpgPreferences['lastViewState']) => Promise<void>;
  resetPrefs: () => Promise<void>;
}

const DEFAULT_PREFS: EpgPreferences = {
  enabled: true,
  timeSpanHours: 48,
  timeBlockMinutes: 30,
  channelOrder: 'playlist',
  hiddenCategories: [],
  hiddenChannels: [],
  favoritesOnly: false,
  lastViewState: {}
};

export function useEpgPreferences(profileSession: ProfileSession): EpgPreferencesHook {
  const { updateProfileData } = useProfile();

  // Extract current prefs from profile data
  const prefs: EpgPreferences = {
    enabled: profileSession.data.epgEnabled ?? DEFAULT_PREFS.enabled,
    timeSpanHours: profileSession.data.epgTimeSpanHours ?? DEFAULT_PREFS.timeSpanHours,
    timeBlockMinutes: profileSession.data.epgTimeBlockMinutes ?? DEFAULT_PREFS.timeBlockMinutes,
    channelOrder: profileSession.data.epgChannelOrder ?? DEFAULT_PREFS.channelOrder,
    hiddenCategories: profileSession.data.epgHiddenCategories ?? DEFAULT_PREFS.hiddenCategories,
    hiddenChannels: profileSession.data.epgHiddenChannels ?? DEFAULT_PREFS.hiddenChannels,
    favoritesOnly: profileSession.data.epgFavoritesOnly ?? DEFAULT_PREFS.favoritesOnly,
    lastViewState: profileSession.data.lastEpgViewState ?? DEFAULT_PREFS.lastViewState
  };

  const updatePrefs = useCallback(async (partial: Partial<EpgPreferences>) => {
    const updates: Partial<ProfileSession['data']> = {};

    if (partial.enabled !== undefined) updates.epgEnabled = partial.enabled;
    if (partial.timeSpanHours !== undefined) updates.epgTimeSpanHours = partial.timeSpanHours;
    if (partial.timeBlockMinutes !== undefined) updates.epgTimeBlockMinutes = partial.timeBlockMinutes;
    if (partial.channelOrder !== undefined) updates.epgChannelOrder = partial.channelOrder;
    if (partial.hiddenCategories !== undefined) updates.epgHiddenCategories = partial.hiddenCategories;
    if (partial.hiddenChannels !== undefined) updates.epgHiddenChannels = partial.hiddenChannels;
    if (partial.favoritesOnly !== undefined) updates.epgFavoritesOnly = partial.favoritesOnly;
    if (partial.lastViewState !== undefined) updates.lastEpgViewState = partial.lastViewState;

    await updateProfileData(updates);
  }, [updateProfileData]);

  const saveViewState = useCallback(async (state: EpgPreferences['lastViewState']) => {
    await updateProfileData({ lastEpgViewState: state });
  }, [updateProfileData]);

  const resetPrefs = useCallback(async () => {
    await updateProfileData({
      epgEnabled: DEFAULT_PREFS.enabled,
      epgTimeSpanHours: DEFAULT_PREFS.timeSpanHours,
      epgTimeBlockMinutes: DEFAULT_PREFS.timeBlockMinutes,
      epgChannelOrder: DEFAULT_PREFS.channelOrder,
      epgHiddenCategories: DEFAULT_PREFS.hiddenCategories,
      epgHiddenChannels: DEFAULT_PREFS.hiddenChannels,
      epgFavoritesOnly: DEFAULT_PREFS.favoritesOnly,
      lastEpgViewState: DEFAULT_PREFS.lastViewState
    });
  }, [updateProfileData]);

  return {
    prefs,
    updatePrefs,
    saveViewState,
    resetPrefs
  };
}

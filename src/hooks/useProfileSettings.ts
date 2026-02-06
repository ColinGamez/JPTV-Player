import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProfileSession, ProfileData } from '../types/profile';

/**
 * Profile-aware settings hook that reads/writes to active profile data
 * instead of global settings.json
 */
export function useProfileSettings(profileSession: ProfileSession) {
  const [profileData, setProfileData] = useState<ProfileData>(profileSession.data);
  const [isElectron] = useState(() => typeof window !== 'undefined' && window.electron?.profile !== undefined);

  // Sync local state with profile session data
  useEffect(() => {
    setProfileData(profileSession.data);
  }, [profileSession]);

  const updateProfileData = useCallback(async (updates: Partial<ProfileData>) => {
    if (!isElectron) {
      // For non-Electron environments (dev), just update local state
      setProfileData(prev => ({ ...prev, ...updates }));
      return;
    }

    // Capture previous state before optimistic update (for revert on error)
    let previousData: ProfileData | null = null;
    setProfileData(prev => {
      previousData = prev;
      return { ...prev, ...updates };
    });

    try {
      // Persist to backend (saves to disk immediately)
      await window.electron.profile.updateData(updates);
    } catch (error) {
      console.error('Failed to update profile data:', error);
      // Revert to the actual previous state captured above, not stale closure
      if (previousData) {
        setProfileData(previousData);
      }
    }
  }, [isElectron]);

  const updateSetting = useCallback(async (key: string, value: any) => {
    await updateProfileData({ [key]: value });
  }, [updateProfileData]);

  const toggleFavorite = useCallback(async (channelId: number) => {
    const favorites = profileData.favorites.includes(channelId)
      ? profileData.favorites.filter(id => id !== channelId)
      : [...profileData.favorites, channelId];
    await updateSetting('favorites', favorites);
  }, [profileData.favorites, updateSetting]);

  return {
    settings: profileData,
    updateSetting,
    toggleFavorite,
    updateProfileData,
    isElectron
  };
}

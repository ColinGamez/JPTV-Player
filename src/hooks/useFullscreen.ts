import { useState, useEffect, useCallback } from 'react';
import type { ProfileSession } from '../types/profile';

interface UseFullscreenOptions {
  profileSession: ProfileSession;
  updateProfileData: (data: Partial<ProfileSession['data']>) => Promise<void>;
  isElectron: boolean;
}

/**
 * Hook to manage fullscreen state with profile persistence
 */
export function useFullscreen({ profileSession, updateProfileData, isElectron }: UseFullscreenOptions) {
  const [isFullscreen, setIsFullscreen] = useState(
    profileSession.data.isFullscreen ?? true // Default to fullscreen for TV mode
  );

  // Sync fullscreen state on mount and profile change
  useEffect(() => {
    if (!isElectron) return;

    const syncFullscreen = async () => {
      try {
        const currentFullscreen = await window.electron.window.isFullscreen();
        const desiredFullscreen = profileSession.data.isFullscreen ?? true;

        if (currentFullscreen !== desiredFullscreen) {
          await window.electron.window.setFullscreen(desiredFullscreen);
        }
        
        setIsFullscreen(desiredFullscreen);
      } catch (err) {
        console.error('[Fullscreen] Failed to sync state:', err);
      }
    };

    syncFullscreen();
  }, [profileSession.id, isElectron]);

  const toggleFullscreen = useCallback(async () => {
    if (!isElectron) return;

    try {
      const newFullscreen = await window.electron.window.toggleFullscreen();
      setIsFullscreen(newFullscreen);

      // Persist to profile
      await updateProfileData({ isFullscreen: newFullscreen });
    } catch (err) {
      console.error('[Fullscreen] Toggle failed:', err);
    }
  }, [isElectron, updateProfileData]);

  const setFullscreenState = useCallback(async (fullscreen: boolean) => {
    if (!isElectron) return;

    try {
      await window.electron.window.setFullscreen(fullscreen);
      setIsFullscreen(fullscreen);

      // Persist to profile
      await updateProfileData({ isFullscreen: fullscreen });
    } catch (err) {
      console.error('[Fullscreen] Set failed:', err);
    }
  }, [isElectron, updateProfileData]);

  return {
    isFullscreen,
    toggleFullscreen,
    setFullscreen: setFullscreenState
  };
}

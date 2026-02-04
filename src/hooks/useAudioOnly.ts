import { useState, useCallback, useEffect } from 'react';

interface UseAudioOnlyResult {
  audioOnlyMode: boolean;
  toggleAudioOnly: () => Promise<void>;
  setAudioOnly: (enabled: boolean) => Promise<void>;
}

export function useAudioOnly(): UseAudioOnlyResult {
  const [audioOnlyMode, setAudioOnlyModeState] = useState(false);

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      try {
        const isAudioOnly = await window.electronAPI.player.getAudioOnly();
        setAudioOnlyModeState(isAudioOnly);
      } catch (error) {
        console.error('Failed to load audio-only state:', error);
      }
    };

    loadState();
  }, []);

  const setAudioOnly = useCallback(async (enabled: boolean) => {
    try {
      const result = await window.electronAPI.player.setAudioOnly(enabled);
      
      if (result.success) {
        setAudioOnlyModeState(enabled);
      } else {
        console.error('Failed to set audio-only mode:', result.error);
      }
    } catch (error) {
      console.error('Failed to set audio-only mode:', error);
    }
  }, []);

  const toggleAudioOnly = useCallback(async () => {
    await setAudioOnly(!audioOnlyMode);
  }, [audioOnlyMode, setAudioOnly]);

  return {
    audioOnlyMode,
    toggleAudioOnly,
    setAudioOnly
  };
}

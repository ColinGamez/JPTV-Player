import { useState, useCallback } from 'react';

export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'buffering' | 'error';

export interface PlaybackInfo {
  state: PlaybackState;
  currentChannel: string;
  error?: string;
}

export function usePlaybackState() {
  const [playbackInfo, setPlaybackInfo] = useState<PlaybackInfo>({
    state: 'stopped',
    currentChannel: ''
  });

  const updateState = useCallback((state: PlaybackState, channelName?: string, error?: string) => {
    setPlaybackInfo(prev => ({
      state,
      currentChannel: channelName || prev.currentChannel,
      error
    }));
  }, []);

  const clearError = useCallback(() => {
    setPlaybackInfo(prev => ({
      ...prev,
      error: undefined
    }));
  }, []);

  return {
    playbackInfo,
    updateState,
    clearError
  };
}

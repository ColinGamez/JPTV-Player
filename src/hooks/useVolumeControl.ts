/**
 * Volume Control Hook
 * Manages audio volume with visual feedback
 */

import { useState, useCallback, useEffect, useRef } from 'react';

const VOLUME_STORAGE_KEY = 'playerVolume';
const DEFAULT_VOLUME = 100;
const VOLUME_STEP = 5;
const VOLUME_PERSIST_DELAY = 500; // Debounce localStorage writes

export function useVolumeControl() {
  const [volume, setVolume] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
      return stored ? parseInt(stored, 10) : DEFAULT_VOLUME;
    } catch {
      return DEFAULT_VOLUME;
    }
  });
  
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(DEFAULT_VOLUME);
  const [isVolumeVisible, setIsVolumeVisible] = useState(false);
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save volume to localStorage (prevents thrashing on hold-down)
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
      } catch (err) {
        console.error('Failed to save volume:', err);
      }
    }, VOLUME_PERSIST_DELAY);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [volume]);

  // Auto-hide volume indicator after 2 seconds
  useEffect(() => {
    if (isVolumeVisible) {
      const timer = setTimeout(() => {
        setIsVolumeVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVolumeVisible]);

  // Set volume (0-100)
  const setVolumeLevel = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolume(clampedVolume);
    setIsVolumeVisible(true);
    
    // Auto-unmute if setting volume while muted
    if (isMuted && clampedVolume > 0) {
      setIsMuted(false);
    }
  }, [isMuted]);

  // Increase volume
  const increaseVolume = useCallback(() => {
    setVolumeLevel(volume + VOLUME_STEP);
  }, [volume, setVolumeLevel]);

  // Decrease volume
  const decreaseVolume = useCallback(() => {
    setVolumeLevel(volume - VOLUME_STEP);
  }, [volume, setVolumeLevel]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (isMuted) {
      // Unmute: restore previous volume
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      // Mute: save current volume and set to 0
      setPreviousVolume(volume);
      setIsMuted(true);
    }
    setIsVolumeVisible(true);
  }, [isMuted, volume, previousVolume]);

  // Get effective volume (0 if muted)
  const effectiveVolume = isMuted ? 0 : volume;

  // Get volume percentage for display
  const volumePercent = Math.round(effectiveVolume);

  // Get volume icon based on level
  const getVolumeIcon = useCallback(() => {
    if (isMuted || effectiveVolume === 0) return '🔇';
    if (effectiveVolume < 33) return '🔈';
    if (effectiveVolume < 66) return '🔉';
    return '🔊';
  }, [isMuted, effectiveVolume]);

  return {
    volume: effectiveVolume,
    volumePercent,
    isMuted,
    isVolumeVisible,
    setVolume: setVolumeLevel,
    increaseVolume,
    decreaseVolume,
    toggleMute,
    getVolumeIcon,
    showVolume: () => setIsVolumeVisible(true),
  };
}

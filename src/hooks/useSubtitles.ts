/**
 * Subtitle/Closed Captions Support
 * Manages subtitle tracks, display, and user preferences
 */

import { useState, useCallback, useEffect } from 'react';

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  isDefault: boolean;
  src?: string;
}

export interface SubtitleSettings {
  enabled: boolean;
  fontSize: number;     // 0.5 to 3.0, default 1.0
  fontColor: string;
  bgColor: string;
  bgOpacity: number;    // 0 to 1
  position: 'bottom' | 'top';
}

const STORAGE_KEY = 'subtitleSettings';
const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: false,
  fontSize: 1.0,
  fontColor: '#ffffff',
  bgColor: '#000000',
  bgOpacity: 0.7,
  position: 'bottom',
};

function loadSettings(): SubtitleSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: SubtitleSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* storage full */ }
}

export function useSubtitles() {
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SubtitleSettings>(loadSettings);
  const [currentText, setCurrentText] = useState<string>('');

  // Persist settings
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const addTrack = useCallback((track: SubtitleTrack) => {
    setTracks(prev => {
      if (prev.find(t => t.id === track.id)) return prev;
      return [...prev, track];
    });
    if (track.isDefault && !activeTrackId) {
      setActiveTrackId(track.id);
    }
  }, [activeTrackId]);

  const removeTrack = useCallback((trackId: string) => {
    setTracks(prev => prev.filter(t => t.id !== trackId));
    if (activeTrackId === trackId) {
      setActiveTrackId(null);
    }
  }, [activeTrackId]);

  const selectTrack = useCallback((trackId: string | null) => {
    setActiveTrackId(trackId);
    if (trackId) {
      setSettings(prev => ({ ...prev, enabled: true }));
    }
  }, []);

  const toggleSubtitles = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const updateSetting = useCallback(<K extends keyof SubtitleSettings>(
    key: K,
    value: SubtitleSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const increaseFontSize = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      fontSize: Math.min(3.0, prev.fontSize + 0.1),
    }));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      fontSize: Math.max(0.5, prev.fontSize - 0.1),
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const setSubtitleText = useCallback((text: string) => {
    setCurrentText(text);
  }, []);

  const clearTracks = useCallback(() => {
    setTracks([]);
    setActiveTrackId(null);
    setCurrentText('');
  }, []);

  const activeTrack = tracks.find(t => t.id === activeTrackId) || null;

  return {
    tracks,
    activeTrack,
    activeTrackId,
    settings,
    currentText,
    addTrack,
    removeTrack,
    selectTrack,
    toggleSubtitles,
    updateSetting,
    increaseFontSize,
    decreaseFontSize,
    resetSettings,
    setSubtitleText,
    clearTracks,
  };
}

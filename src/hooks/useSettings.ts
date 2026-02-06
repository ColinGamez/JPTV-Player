import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppSettings } from '../types/electron';

const defaultSettings: AppSettings = {
  channelHistory: [],
  favorites: [],
  volume: 50
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isElectron] = useState(() => typeof window !== 'undefined' && window.electronAPI !== undefined);
  // Ref tracks latest settings to avoid stale closures in rapid updateSetting calls
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!isElectron) return;
    (async () => {
      try {
        const loaded = await window.electronAPI.loadSettings();
        setSettings(loaded);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    })();
  }, [isElectron]);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    settingsRef.current = newSettings;
    if (isElectron) {
      try {
        await window.electronAPI.saveSettings(newSettings);
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }
  }, [isElectron]);

  const updateSetting = useCallback(async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    // Read from ref to prevent stale closure on rapid sequential calls
    const newSettings = { ...settingsRef.current, [key]: value };
    await saveSettings(newSettings);
  }, [saveSettings]);

  const toggleFavorite = useCallback(async (channelId: string) => {
    const current = settingsRef.current;
    const favorites = current.favorites.includes(channelId)
      ? current.favorites.filter(id => id !== channelId)
      : [...current.favorites, channelId];
    await updateSetting('favorites', favorites);
  }, [updateSetting]);

  return {
    settings,
    saveSettings,
    updateSetting,
    toggleFavorite,
    isElectron
  };
}

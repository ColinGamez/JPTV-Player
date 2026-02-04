import { useState, useEffect } from 'react';
import type { AppSettings } from '../types/electron';

const defaultSettings: AppSettings = {
  channelHistory: [],
  favorites: [],
  volume: 50
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isElectron] = useState(() => typeof window !== 'undefined' && window.electronAPI !== undefined);

  useEffect(() => {
    if (isElectron) {
      loadSettings();
    }
  }, [isElectron]);

  const loadSettings = async () => {
    if (!isElectron) return;
    try {
      const loaded = await window.electronAPI.loadSettings();
      setSettings(loaded);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (isElectron) {
      try {
        await window.electronAPI.saveSettings(newSettings);
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  const toggleFavorite = async (channelId: number) => {
    const favorites = settings.favorites.includes(channelId)
      ? settings.favorites.filter(id => id !== channelId)
      : [...settings.favorites, channelId];
    await updateSetting('favorites', favorites);
  };

  return {
    settings,
    saveSettings,
    updateSetting,
    toggleFavorite,
    isElectron
  };
}

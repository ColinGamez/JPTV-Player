/**
 * Theme System
 * Provides light/dark/custom theme support with CSS custom properties
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface Theme {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    // Backgrounds
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgOverlay: string;
    
    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    
    // Accent
    accentPrimary: string;
    accentHover: string;
    accentActive: string;
    
    // Status
    success: string;
    warning: string;
    error: string;
    info: string;
    
    // Borders
    borderPrimary: string;
    borderSecondary: string;
    
    // Player
    playerBg: string;
    playerControls: string;
  };
}

const THEMES: Record<string, Theme> = {
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    isDark: true,
    colors: {
      bgPrimary: '#0a0a0f',
      bgSecondary: '#14141f',
      bgTertiary: '#1e1e2e',
      bgOverlay: 'rgba(0, 0, 0, 0.85)',
      textPrimary: '#ffffff',
      textSecondary: '#a0a0b0',
      textMuted: '#606070',
      accentPrimary: '#0066ff',
      accentHover: '#0055dd',
      accentActive: '#0044bb',
      success: '#00cc66',
      warning: '#ffaa00',
      error: '#ff3355',
      info: '#00aaff',
      borderPrimary: 'rgba(255, 255, 255, 0.12)',
      borderSecondary: 'rgba(255, 255, 255, 0.06)',
      playerBg: '#000000',
      playerControls: 'rgba(255, 255, 255, 0.9)',
    },
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo Night',
    isDark: true,
    colors: {
      bgPrimary: '#1a1b26',
      bgSecondary: '#24283b',
      bgTertiary: '#2f3349',
      bgOverlay: 'rgba(26, 27, 38, 0.9)',
      textPrimary: '#c0caf5',
      textSecondary: '#9aa5ce',
      textMuted: '#565f89',
      accentPrimary: '#7aa2f7',
      accentHover: '#6690e0',
      accentActive: '#5580d0',
      success: '#9ece6a',
      warning: '#e0af68',
      error: '#f7768e',
      info: '#7dcfff',
      borderPrimary: 'rgba(192, 202, 245, 0.12)',
      borderSecondary: 'rgba(192, 202, 245, 0.06)',
      playerBg: '#16161e',
      playerControls: 'rgba(192, 202, 245, 0.9)',
    },
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    isDark: false,
    colors: {
      bgPrimary: '#fef2f4',
      bgSecondary: '#ffffff',
      bgTertiary: '#fff5f7',
      bgOverlay: 'rgba(255, 255, 255, 0.92)',
      textPrimary: '#2d1f2d',
      textSecondary: '#6b4c6b',
      textMuted: '#a088a0',
      accentPrimary: '#e84393',
      accentHover: '#d63384',
      accentActive: '#c42575',
      success: '#00b894',
      warning: '#fdcb6e',
      error: '#d63031',
      info: '#0984e3',
      borderPrimary: 'rgba(45, 31, 45, 0.12)',
      borderSecondary: 'rgba(45, 31, 45, 0.06)',
      playerBg: '#1a1a1a',
      playerControls: 'rgba(255, 255, 255, 0.9)',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Deep Ocean',
    isDark: true,
    colors: {
      bgPrimary: '#0d1b2a',
      bgSecondary: '#1b2838',
      bgTertiary: '#243447',
      bgOverlay: 'rgba(13, 27, 42, 0.9)',
      textPrimary: '#e0e8f0',
      textSecondary: '#8899aa',
      textMuted: '#556677',
      accentPrimary: '#00b4d8',
      accentHover: '#0096b7',
      accentActive: '#007a99',
      success: '#06d6a0',
      warning: '#ffd166',
      error: '#ef476f',
      info: '#118ab2',
      borderPrimary: 'rgba(224, 232, 240, 0.12)',
      borderSecondary: 'rgba(224, 232, 240, 0.06)',
      playerBg: '#060f1a',
      playerControls: 'rgba(224, 232, 240, 0.9)',
    },
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix',
    isDark: true,
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#0a0a0a',
      bgTertiary: '#141414',
      bgOverlay: 'rgba(0, 0, 0, 0.92)',
      textPrimary: '#00ff41',
      textSecondary: '#00cc33',
      textMuted: '#006622',
      accentPrimary: '#00ff41',
      accentHover: '#00dd38',
      accentActive: '#00bb2f',
      success: '#00ff41',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff',
      borderPrimary: 'rgba(0, 255, 65, 0.2)',
      borderSecondary: 'rgba(0, 255, 65, 0.1)',
      playerBg: '#000000',
      playerControls: 'rgba(0, 255, 65, 0.9)',
    },
  },
};

const STORAGE_KEY = 'themeId';

export function useTheme() {
  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'midnight';
    } catch {
      return 'midnight';
    }
  });

  const theme = useMemo(() => THEMES[themeId] || THEMES.midnight, [themeId]);

  // Apply CSS custom properties to document root
  useEffect(() => {
    const root = document.documentElement;
    const { colors } = theme;

    root.style.setProperty('--theme-bg-primary', colors.bgPrimary);
    root.style.setProperty('--theme-bg-secondary', colors.bgSecondary);
    root.style.setProperty('--theme-bg-tertiary', colors.bgTertiary);
    root.style.setProperty('--theme-bg-overlay', colors.bgOverlay);
    root.style.setProperty('--theme-text-primary', colors.textPrimary);
    root.style.setProperty('--theme-text-secondary', colors.textSecondary);
    root.style.setProperty('--theme-text-muted', colors.textMuted);
    root.style.setProperty('--theme-accent-primary', colors.accentPrimary);
    root.style.setProperty('--theme-accent-hover', colors.accentHover);
    root.style.setProperty('--theme-accent-active', colors.accentActive);
    root.style.setProperty('--theme-success', colors.success);
    root.style.setProperty('--theme-warning', colors.warning);
    root.style.setProperty('--theme-error', colors.error);
    root.style.setProperty('--theme-info', colors.info);
    root.style.setProperty('--theme-border-primary', colors.borderPrimary);
    root.style.setProperty('--theme-border-secondary', colors.borderSecondary);
    root.style.setProperty('--theme-player-bg', colors.playerBg);
    root.style.setProperty('--theme-player-controls', colors.playerControls);

    // Set color-scheme for native elements
    root.style.colorScheme = theme.isDark ? 'dark' : 'light';
  }, [theme]);

  const setTheme = useCallback((id: string) => {
    if (THEMES[id]) {
      setThemeId(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch { /* storage full */ }
    }
  }, []);

  const cycleTheme = useCallback(() => {
    const themeIds = Object.keys(THEMES);
    const currentIndex = themeIds.indexOf(themeId);
    const nextIndex = (currentIndex + 1) % themeIds.length;
    setTheme(themeIds[nextIndex]);
  }, [themeId, setTheme]);

  const availableThemes = useMemo(() => 
    Object.values(THEMES).map(t => ({
      id: t.id,
      name: t.name,
      isDark: t.isDark,
    })),
    []
  );

  return {
    theme,
    themeId,
    setTheme,
    cycleTheme,
    availableThemes,
  };
}

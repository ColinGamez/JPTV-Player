/**
 * Theme Selector Component
 * Visual theme picker with preview swatches
 */

import React from 'react';
import './ThemeSelector.css';

interface ThemeOption {
  id: string;
  name: string;
  isDark: boolean;
}

interface ThemeSelectorProps {
  currentThemeId: string;
  themes: ThemeOption[];
  onSelectTheme: (id: string) => void;
  isVisible: boolean;
  onClose: () => void;
}

const THEME_PREVIEWS: Record<string, { bg: string; accent: string; text: string }> = {
  midnight: { bg: '#0a0a0f', accent: '#0066ff', text: '#ffffff' },
  tokyo: { bg: '#1a1b26', accent: '#7aa2f7', text: '#c0caf5' },
  sakura: { bg: '#fef2f4', accent: '#e84393', text: '#2d1f2d' },
  ocean: { bg: '#0d1b2a', accent: '#00b4d8', text: '#e0e8f0' },
  matrix: { bg: '#000000', accent: '#00ff41', text: '#00ff41' },
};

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentThemeId,
  themes,
  onSelectTheme,
  isVisible,
  onClose,
}) => {
  if (!isVisible) return null;

  return (
    <div className="theme-selector-overlay" onClick={onClose}>
      <div className="theme-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="theme-selector-header">
          <h3>🎨 Theme</h3>
          <button className="theme-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="theme-options">
          {themes.map((theme) => {
            const preview = THEME_PREVIEWS[theme.id] || { bg: '#000', accent: '#fff', text: '#fff' };
            const isActive = theme.id === currentThemeId;
            
            return (
              <button
                key={theme.id}
                className={`theme-option ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTheme(theme.id);
                  onClose();
                }}
              >
                <div
                  className="theme-preview"
                  style={{ background: preview.bg }}
                >
                  <div className="preview-accent" style={{ background: preview.accent }} />
                  <div className="preview-text" style={{ color: preview.text }}>
                    Aa
                  </div>
                </div>
                <span className="theme-name">{theme.name}</span>
                {theme.isDark ? (
                  <span className="theme-badge dark">Dark</span>
                ) : (
                  <span className="theme-badge light">Light</span>
                )}
                {isActive && <span className="theme-check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Subtitle Display Component
 * Renders subtitle text with customizable appearance
 */

import React from 'react';
import type { SubtitleSettings } from '../hooks/useSubtitles';
import './SubtitleDisplay.css';

interface SubtitleDisplayProps {
  text: string;
  settings: SubtitleSettings;
}

export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({ text, settings }) => {
  if (!settings.enabled || !text) return null;

  const bgColorWithOpacity = (() => {
    const hex = settings.bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${settings.bgOpacity})`;
  })();

  return (
    <div className={`subtitle-container subtitle-${settings.position}`}>
      <div
        className="subtitle-text"
        style={{
          fontSize: `${settings.fontSize}em`,
          color: settings.fontColor,
          backgroundColor: bgColorWithOpacity,
        }}
      >
        {text}
      </div>
    </div>
  );
};

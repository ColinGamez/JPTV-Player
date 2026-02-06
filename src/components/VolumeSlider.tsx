/**
 * Volume Slider Component
 * Visual volume control with automatic hide
 */

import React from 'react';
import './VolumeSlider.css';

interface VolumeSliderProps {
  volume: number;
  isMuted: boolean;
  isVisible: boolean;
  onVolumeChange: (volume: number) => void;
  getVolumeIcon: () => string;
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  volume,
  isMuted,
  isVisible,
  onVolumeChange,
  getVolumeIcon,
}) => {
  if (!isVisible) return null;

  return (
    <div className="volume-slider-container">
      <div className="volume-slider">
        <div className="volume-icon">{getVolumeIcon()}</div>
        <div className="volume-bar">
          <div 
            className="volume-fill"
            style={{ width: `${volume}%` }}
          />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
            className="volume-input"
          />
        </div>
        <div className="volume-label">
          {isMuted ? 'MUTED' : `${Math.round(volume)}%`}
        </div>
      </div>
    </div>
  );
};

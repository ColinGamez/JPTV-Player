/**
 * Sleep Timer Overlay
 * Shows timer presets and countdown
 */

import React from 'react';
import './SleepTimer.css';

interface SleepTimerOverlayProps {
  isVisible: boolean;
  isActive: boolean;
  remainingFormatted: string;
  progress: number;
  presetMinutes: number;
  presets: number[];
  onStartTimer: (minutes: number) => void;
  onCancelTimer: () => void;
  onExtendTimer: (minutes: number) => void;
  onClose: () => void;
}

export const SleepTimerOverlay: React.FC<SleepTimerOverlayProps> = ({
  isVisible,
  isActive,
  remainingFormatted,
  progress,
  presetMinutes,
  presets,
  onStartTimer,
  onCancelTimer,
  onExtendTimer,
  onClose,
}) => {
  if (!isVisible) return null;

  return (
    <div className="sleep-timer-overlay" onClick={onClose}>
      <div className="sleep-timer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sleep-timer-header">
          <h3>🌙 Sleep Timer</h3>
          <button className="sleep-timer-close" onClick={onClose} aria-label="Close sleep timer">✕</button>
        </div>

        {isActive ? (
          <div className="sleep-timer-active">
            <div className="timer-countdown">
              <div className="timer-ring">
                <svg viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="var(--theme-accent-primary, #0066ff)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                    transform="rotate(-90 50 50)"
                    className="timer-progress-ring"
                  />
                </svg>
                <div className="timer-time">{remainingFormatted}</div>
              </div>
              <p className="timer-label">
                {presetMinutes} min timer active
              </p>
            </div>
            <div className="timer-actions">
              <button className="timer-extend" onClick={() => onExtendTimer(15)}>
                +15 min
              </button>
              <button className="timer-extend" onClick={() => onExtendTimer(30)}>
                +30 min
              </button>
              <button className="timer-cancel" onClick={onCancelTimer}>
                Cancel Timer
              </button>
            </div>
          </div>
        ) : (
          <div className="sleep-timer-presets">
            <p className="presets-label">Auto-stop playback after:</p>
            <div className="presets-grid">
              {presets.map((minutes) => (
                <button
                  key={minutes}
                  className="preset-btn"
                  onClick={() => {
                    onStartTimer(minutes);
                    onClose();
                  }}
                >
                  <span className="preset-value">{minutes}</span>
                  <span className="preset-unit">min</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact badge shown when timer is active
export const SleepTimerBadge: React.FC<{
  isActive: boolean;
  remainingFormatted: string;
  onClick: () => void;
}> = ({ isActive, remainingFormatted, onClick }) => {
  if (!isActive) return null;

  return (
    <button className="sleep-timer-badge" onClick={onClick} aria-label={`Sleep timer: ${remainingFormatted} remaining`}>
      <span className="badge-icon">🌙</span>
      <span className="badge-time">{remainingFormatted}</span>
    </button>
  );
};

/**
 * Channel Info Panel Component
 * Quick reference panel showing current channel, EPG, and quick actions
 */

import React, { useEffect, useState } from 'react';
import type { Channel } from '../types/channel';
import './ChannelInfoPanel.css';

interface EpgProgram {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
}

interface ChannelInfoPanelProps {
  channel: Channel | null;
  currentProgram?: EpgProgram | null;
  nextProgram?: EpgProgram | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onRecord?: () => void;
  onShare?: () => void;
  isRecording?: boolean;
  autoHideDelay?: number;
}

export const ChannelInfoPanel: React.FC<ChannelInfoPanelProps> = ({
  channel,
  currentProgram,
  nextProgram,
  isFavorite = false,
  onToggleFavorite,
  onRecord,
  onShare,
  isRecording = false,
  autoHideDelay = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  // Auto-hide after delay
  useEffect(() => {
    if (autoHideDelay <= 0) return;

    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, autoHideDelay);

    return () => clearTimeout(timer);
  }, [channel, autoHideDelay]);

  // Calculate program progress
  useEffect(() => {
    if (!currentProgram) return;

    const updateProgress = () => {
      const now = Date.now();
      const start = currentProgram.startTime.getTime();
      const end = currentProgram.endTime.getTime();
      const duration = end - start;
      if (duration <= 0) {
        setProgress(0);
        return;
      }
      const elapsed = now - start;
      const progressPercent = Math.max(0, Math.min(100, (elapsed / duration) * 100));
      setProgress(progressPercent);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);

    return () => clearInterval(interval);
  }, [currentProgram]);

  // Show panel temporarily
  const showPanel = () => {
    setIsVisible(true);
  };

  if (!channel) return null;

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRemainingTime = (): string => {
    if (!currentProgram) return '';
    const remaining = currentProgram.endTime.getTime() - Date.now();
    const minutes = Math.floor(remaining / 60000);
    if (minutes < 1) return 'Ending soon';
    return `${minutes} min remaining`;
  };

  return (
    <>
      {/* Trigger area to show panel */}
      <div className="info-panel-trigger" onMouseEnter={showPanel} />

      {/* Info panel */}
      <div className={`channel-info-panel ${isVisible ? 'visible' : ''}`}>
        <div className="info-panel-content">
          {/* Channel Header */}
          <div className="channel-header">
            {channel.logo && (
              <img
                src={channel.logo}
                alt={channel.name}
                className="channel-logo"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="channel-details">
              <div className="channel-name">{channel.name}</div>
              <div className="channel-group">{channel.group}</div>
            </div>
            <div className="channel-actions">
              {onToggleFavorite && (
                <button
                  className={`action-btn ${isFavorite ? 'active' : ''}`}
                  onClick={onToggleFavorite}
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite ? '★' : '☆'}
                </button>
              )}
              {onRecord && (
                <button
                  className={`action-btn ${isRecording ? 'active recording' : ''}`}
                  onClick={onRecord}
                  title={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  ⏺
                </button>
              )}
              {onShare && (
                <button
                  className="action-btn"
                  onClick={onShare}
                  title="Share channel"
                >
                  ↗
                </button>
              )}
            </div>
          </div>

          {/* Current Program */}
          {currentProgram && (
            <div className="program-section current-program">
              <div className="program-header">
                <span className="program-label">Now Playing</span>
                <span className="program-time">
                  {formatTime(currentProgram.startTime)} - {formatTime(currentProgram.endTime)}
                </span>
              </div>
              <div className="program-title">{currentProgram.title}</div>
              {currentProgram.description && (
                <div className="program-description">{currentProgram.description}</div>
              )}
              <div className="program-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ transform: `scaleX(${(progress ?? 0) / 100})` }}
                  />
                </div>
                <div className="progress-text">{getRemainingTime()}</div>
              </div>
            </div>
          )}

          {/* Next Program */}
          {nextProgram && (
            <div className="program-section next-program">
              <div className="program-header">
                <span className="program-label">Up Next</span>
                <span className="program-time">
                  {formatTime(nextProgram.startTime)}
                </span>
              </div>
              <div className="program-title">{nextProgram.title}</div>
            </div>
          )}

          {/* No EPG Data */}
          {!currentProgram && !nextProgram && (
            <div className="no-epg">
              <div className="no-epg-icon">📺</div>
              <div className="no-epg-text">No program guide available</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

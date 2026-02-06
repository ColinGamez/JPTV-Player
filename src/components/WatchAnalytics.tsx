/**
 * Watch Analytics Dashboard
 * Visual analytics of viewing habits
 */

import React from 'react';
import type { WatchStats } from '../hooks/useWatchAnalytics';
import './WatchAnalytics.css';

interface WatchAnalyticsProps {
  stats: WatchStats;
  formatDuration: (ms: number) => string;
  isVisible: boolean;
  onClose: () => void;
  onClearHistory: () => void;
}

export const WatchAnalytics: React.FC<WatchAnalyticsProps> = ({
  stats,
  formatDuration,
  isVisible,
  onClose,
  onClearHistory,
}) => {
  if (!isVisible) return null;

  const maxChannelTime = stats.channelBreakdown.length > 0
    ? stats.channelBreakdown[0].totalTimeMs
    : 1;

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="analytics-header">
          <h2>📊 Watch Analytics</h2>
          <button className="analytics-close" onClick={onClose}>✕</button>
        </div>

        {/* Summary Cards */}
        <div className="analytics-summary">
          <div className="stat-card">
            <span className="stat-icon">⏱️</span>
            <span className="stat-value">{formatDuration(stats.totalWatchTimeMs)}</span>
            <span className="stat-label">Total Watch Time</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📺</span>
            <span className="stat-value">{stats.totalSessions}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⭐</span>
            <span className="stat-value">{stats.favoriteChannel?.name || 'N/A'}</span>
            <span className="stat-label">Favorite Channel</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🕐</span>
            <span className="stat-value">{stats.peakHour}:00</span>
            <span className="stat-label">Peak Hour</span>
          </div>
        </div>

        {/* Channel Breakdown */}
        {stats.channelBreakdown.length > 0 && (
          <div className="analytics-section">
            <h3>Top Channels</h3>
            <div className="channel-bars">
              {stats.channelBreakdown.map((ch, i) => (
                <div key={ch.channelId} className="channel-bar-row">
                  <span className="bar-rank">#{i + 1}</span>
                  <span className="bar-name">{ch.channelName}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(ch.totalTimeMs / maxChannelTime) * 100}%` }}
                    />
                  </div>
                  <span className="bar-time">{formatDuration(ch.totalTimeMs)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Usage */}
        {stats.dailyUsage.length > 0 && (
          <div className="analytics-section">
            <h3>Recent Activity</h3>
            <div className="daily-bars">
              {stats.dailyUsage.map((day) => {
                const maxDaily = Math.max(...stats.dailyUsage.map(d => d.totalTimeMs), 1);
                return (
                  <div key={day.date} className="daily-bar">
                    <div
                      className="daily-fill"
                      style={{ height: `${(day.totalTimeMs / maxDaily) * 100}%` }}
                    />
                    <span className="daily-label">
                      {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="analytics-footer">
          <button className="clear-history-btn" onClick={onClearHistory}>
            🗑️ Clear History
          </button>
        </div>
      </div>
    </div>
  );
};

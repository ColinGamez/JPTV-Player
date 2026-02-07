/**
 * Status Indicator Component
 * Shows connection status, stream health, and recording status
 */

import React from 'react';
import './StatusIndicator.css';

export interface StatusIndicatorProps {
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  streamHealth?: {
    bitrate?: number;
    bufferLevel?: number;
    droppedFrames?: number;
  };
  isRecording?: boolean;
  isLive?: boolean;
  viewerCount?: number;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = React.memo(({
  connectionStatus,
  streamHealth,
  isRecording = false,
  isLive = false,
  viewerCount,
}) => {
  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'connected';
      case 'connecting': return 'connecting';
      case 'disconnected': return 'disconnected';
      case 'error': return 'error';
      default: return 'disconnected';
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  };

  const formatBitrate = (bitrate: number): string => {
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    } else if (bitrate >= 1000) {
      return `${(bitrate / 1000).toFixed(0)} Kbps`;
    }
    return `${bitrate} bps`;
  };

  const getHealthStatus = (): 'excellent' | 'good' | 'fair' | 'poor' | null => {
    if (!streamHealth) return null;

    const { bufferLevel = 0, droppedFrames = 0 } = streamHealth;
    
    if (bufferLevel > 5 && droppedFrames < 10) return 'excellent';
    if (bufferLevel > 3 && droppedFrames < 50) return 'good';
    if (bufferLevel > 1 && droppedFrames < 100) return 'fair';
    return 'poor';
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="status-indicator">
      <div className="status-items">
        {/* Connection Status */}
        <div className={`status-item status-connection status-${getConnectionColor()}`}>
          <span className="status-dot" aria-hidden="true"></span>
          <span className="status-text">{getConnectionText()}</span>
        </div>

        {/* Live Indicator */}
        {isLive && (
          <div className="status-item status-live">
            <span className="live-pulse"></span>
            <span className="status-text">LIVE</span>
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="status-item status-recording">
            <span className="recording-dot"></span>
            <span className="status-text">REC</span>
          </div>
        )}

        {/* Stream Health */}
        {healthStatus && (
          <div className={`status-item status-health status-health-${healthStatus}`}>
            <span className="status-text">{healthStatus.toUpperCase()}</span>
          </div>
        )}

        {/* Bitrate */}
        {streamHealth?.bitrate && (
          <div className="status-item status-bitrate">
            <span className="status-icon">📊</span>
            <span className="status-text">{formatBitrate(streamHealth.bitrate)}</span>
          </div>
        )}

        {/* Buffer Level */}
        {streamHealth?.bufferLevel !== undefined && (
          <div className="status-item status-buffer">
            <span className="status-icon">💾</span>
            <span className="status-text">{streamHealth.bufferLevel.toFixed(1)}s</span>
          </div>
        )}

        {/* Viewer Count */}
        {viewerCount !== undefined && viewerCount > 0 && (
          <div className="status-item status-viewers">
            <span className="status-icon">👥</span>
            <span className="status-text">{viewerCount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Performance Monitor Component
 * Shows real-time performance metrics (dev mode)
 */

import React from 'react';
import './PerformanceMonitor.css';

interface PerformanceMonitorProps {
  metrics: {
    fps: number;
    memoryUsage: number;
    cpuUsage: number;
    latency: number;
    droppedFrames: number;
  };
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  isVisible?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  metrics,
  grade,
  isVisible = true,
}) => {
  if (!isVisible) return null;

  const getGradeColor = () => {
    switch (grade) {
      case 'excellent': return '#00ff88';
      case 'good': return '#88ff00';
      case 'fair': return '#ffaa00';
      case 'poor': return '#ff4444';
      default: return '#888';
    }
  };

  return (
    <div className="performance-monitor">
      <div className="perf-header">
        <span className="perf-title">Performance</span>
        <span 
          className="perf-grade"
          style={{ color: getGradeColor() }}
        >
          {grade.toUpperCase()}
        </span>
      </div>
      <div className="perf-metrics">
        <div className="perf-metric">
          <span className="perf-label">FPS</span>
          <span 
            className="perf-value"
            style={{ color: metrics.fps >= 50 ? '#00ff88' : metrics.fps >= 30 ? '#ffaa00' : '#ff4444' }}
          >
            {metrics.fps}
          </span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">Memory</span>
          <span className="perf-value">{metrics.memoryUsage} MB</span>
        </div>
        {metrics.droppedFrames > 0 && (
          <div className="perf-metric">
            <span className="perf-label">Dropped</span>
            <span className="perf-value perf-warning">{metrics.droppedFrames}</span>
          </div>
        )}
      </div>
    </div>
  );
};

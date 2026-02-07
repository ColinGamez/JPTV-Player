/**
 * Channel Number Overlay
 * Shows channel number input with timeout
 */

import React, { useEffect, useState, useRef } from 'react';
import './ChannelNumberOverlay.css';

interface ChannelNumberOverlayProps {
  channelNumber: string;
  isVisible: boolean;
  onTimeout?: () => void;
  timeout?: number;
}

export const ChannelNumberOverlay: React.FC<ChannelNumberOverlayProps> = ({
  channelNumber,
  isVisible,
  onTimeout,
  timeout = 2000,
}) => {
  const [progress, setProgress] = useState(100);

  // Use ref for onTimeout to prevent interval restart when parent doesn't memoize
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!isVisible) {
      setProgress(100);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / timeout) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        onTimeoutRef.current?.();
      }
    }, 16); // 60fps

    return () => clearInterval(interval);
  }, [isVisible, timeout]);

  if (!isVisible) return null;

  return (
    <div className="channel-number-overlay">
      <div className="channel-number-display">
        <div className="channel-number-label">Channel</div>
        <div className="channel-number-digits">
          {channelNumber || '_'}
        </div>
        <div className="channel-number-progress">
          <div 
            className="channel-number-progress-fill"
            style={{ transform: `scaleX(${(progress ?? 0) / 100})` }}
          />
        </div>
      </div>
    </div>
  );
};

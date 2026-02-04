import React, { useEffect, useState } from 'react';
import type { EpgNowNext } from '../types/epg';
import styles from './NowNextOverlay.module.css';

interface NowNextOverlayProps {
  channelId: string;
  channelName: string;
  nowNext: EpgNowNext | null;
  visible: boolean;
  onHide: () => void;
}

export const NowNextOverlay: React.FC<NowNextOverlayProps> = ({
  channelId,
  channelName,
  nowNext,
  visible,
  onHide
}) => {
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-hide after 5 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onHide();
      }, 5000);
      
      setAutoHideTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDuration = (start: number, stop: number) => {
    const minutes = Math.floor((stop - start) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}分`;
  };

  return (
    <div className={styles.overlay} onClick={onHide}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.channelName}>{channelName}</h3>
          <span className={styles.channelId}>{channelId}</span>
        </div>

        {nowNext?.currentProgram ? (
          <>
            <div className={styles.section}>
              <div className={styles.label}>Now Playing</div>
              <div className={styles.programTitle}>{nowNext.currentProgram.title}</div>
              <div className={styles.programTime}>
                {formatTime(nowNext.currentProgram.start)} - {formatTime(nowNext.currentProgram.stop)}
                <span className={styles.duration}>
                  ({formatDuration(nowNext.currentProgram.start, nowNext.currentProgram.stop)})
                </span>
              </div>
              
              {nowNext.currentProgram.description && (
                <div className={styles.description}>
                  {nowNext.currentProgram.description}
                </div>
              )}

              {/* Progress bar */}
              <div className={styles.progressContainer}>
                <div 
                  className={styles.progressBar}
                  style={{ width: `${nowNext.progress * 100}%` }}
                />
              </div>
              <div className={styles.progressText}>
                {Math.round(nowNext.progress * 100)}% complete
              </div>
            </div>

            {nowNext.nextProgram && (
              <div className={styles.section}>
                <div className={styles.label}>Up Next</div>
                <div className={styles.programTitle}>{nowNext.nextProgram.title}</div>
                <div className={styles.programTime}>
                  {formatTime(nowNext.nextProgram.start)} - {formatTime(nowNext.nextProgram.stop)}
                  <span className={styles.duration}>
                    ({formatDuration(nowNext.nextProgram.start, nowNext.nextProgram.stop)})
                  </span>
                </div>
                
                {nowNext.nextProgram.description && (
                  <div className={styles.description}>
                    {nowNext.nextProgram.description}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={styles.noData}>
            <p>No EPG data available for this channel</p>
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={onHide}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

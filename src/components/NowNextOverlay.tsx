import React, { useEffect, useRef } from 'react';
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
  // Use ref for onHide to avoid effect restart when parent doesn't memoize
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  // Auto-hide after 5 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onHideRef.current();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

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

        {nowNext?.now ? (
          <>
            <div className={styles.section}>
              <div className={styles.label}>Now Playing</div>
              <div className={styles.programTitle}>{nowNext.now.title}</div>
              <div className={styles.programTime}>
                {formatTime(nowNext.now.start)} - {formatTime(nowNext.now.stop)}
                <span className={styles.duration}>
                  ({formatDuration(nowNext.now.start, nowNext.now.stop)})
                </span>
              </div>
              
              {nowNext.now.description && (
                <div className={styles.description}>
                  {nowNext.now.description}
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

            {nowNext.next && (
              <div className={styles.section}>
                <div className={styles.label}>Up Next</div>
                <div className={styles.programTitle}>{nowNext.next.title}</div>
                <div className={styles.programTime}>
                  {formatTime(nowNext.next.start)} - {formatTime(nowNext.next.stop)}
                  <span className={styles.duration}>
                    ({formatDuration(nowNext.next.start, nowNext.next.stop)})
                  </span>
                </div>
                
                {nowNext.next.description && (
                  <div className={styles.description}>
                    {nowNext.next.description}
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

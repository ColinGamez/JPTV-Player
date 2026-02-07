/**
 * EpgDetailsPanel - Program details and actions
 */

import React from 'react';
import { EpgProgram } from '../epg/EpgStore';
import styles from './EpgDetailsPanel.module.css';

interface EpgDetailsPanelProps {
  program: EpgProgram | null;
  channelName?: string;
  onWatch?: () => void;
  onReminder?: () => void;
  onClose: () => void;
}

export const EpgDetailsPanel: React.FC<EpgDetailsPanelProps> = ({
  program,
  channelName,
  onWatch,
  onReminder,
  onClose
}) => {
  if (!program) return null;

  const nowMs = Date.now();
  const isCurrentlyAiring = nowMs >= program.startMs && nowMs < program.endMs;
  const isUpcoming = program.startMs > nowMs;
  const isPast = program.endMs <= nowMs;

  const formatDate = (ms: number) => {
    const date = new Date(ms);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const getDuration = () => {
    const durationMs = program.endMs - program.startMs;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}時間${mins}分`;
    }
    return `${mins}分`;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{program.title}</h2>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close details panel">
          ×
        </button>
      </div>

      <div className={styles.content}>
        {/* Channel */}
        {channelName && (
          <div className={styles.section}>
            <div className={styles.label}>チャンネル</div>
            <div className={styles.value}>{channelName}</div>
          </div>
        )}

        {/* Time */}
        <div className={styles.section}>
          <div className={styles.label}>放送時間</div>
          <div className={styles.value}>
            {formatDate(program.startMs)} - {formatDate(program.endMs)}
            <span className={styles.duration}> ({getDuration()})</span>
          </div>
        </div>

        {/* Status */}
        <div className={styles.section}>
          <div className={styles.label}>状態</div>
          <div className={styles.value}>
            {isCurrentlyAiring && <span className={styles.statusLive}>放送中</span>}
            {isUpcoming && <span className={styles.statusUpcoming}>放送予定</span>}
            {isPast && <span className={styles.statusPast}>放送終了</span>}
          </div>
        </div>

        {/* Category */}
        {program.category && (
          <div className={styles.section}>
            <div className={styles.label}>カテゴリ</div>
            <div className={styles.value}>
              <span className={styles.categoryBadge}>{program.category}</span>
            </div>
          </div>
        )}

        {/* Description */}
        {program.description && (
          <div className={styles.section}>
            <div className={styles.label}>番組内容</div>
            <div className={styles.description}>{program.description}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {isCurrentlyAiring && onWatch && (
          <button className={styles.watchButton} onClick={onWatch}>
            ▶ 視聴する
          </button>
        )}
        {isUpcoming && onReminder && (
          <button className={styles.reminderButton} onClick={onReminder}>
            🔔 リマインダー設定
          </button>
        )}
        {isPast && (
          <div className={styles.pastMessage}>この番組は放送終了しました</div>
        )}
      </div>

      <div className={styles.hint}>
        ESC: 閉じる
      </div>
    </div>
  );
};

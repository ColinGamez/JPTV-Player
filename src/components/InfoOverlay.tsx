import type { Channel } from '../types/channel';
import type { Channel as MockChannel } from '../data/mockData';
import styles from './InfoOverlay.module.css';

interface InfoOverlayProps {
  channel: Channel | MockChannel;
  isFavorite: boolean;
  playlistPath: string | null;
}

function InfoOverlay({ channel, isFavorite, playlistPath }: InfoOverlayProps) {
  // Get the group/category name
  const categoryName = 'group' in channel ? channel.group : (channel as MockChannel).category;
  
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.logo}>
          {channel.logo ? (
            <img src={channel.logo} alt={channel.name} />
          ) : (
            <div className={styles.placeholder}>{channel.name[0]}</div>
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>
            {channel.name}
            {isFavorite && <span className={styles.star}>★</span>}
          </div>
          <div className={styles.category}>{categoryName}</div>
          {playlistPath && (
            <div className={styles.playlist}>{playlistPath}</div>
          )}
        </div>
      </div>
      <div className={styles.controls}>
        <span>ESC: 戻る</span>
        <span>I: 情報</span>
        <span>F: お気に入り</span>
        <span>O: プレイリスト</span>
        <span>↑↓: 音量</span>
        <span>Space: 一時停止</span>
      </div>
    </div>
  );
}

export default InfoOverlay;

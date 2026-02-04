import type { Channel } from '../types/channel';
import type { Channel as MockChannel } from '../data/mockData';
import styles from './Player.module.css';

interface PlayerProps {
  channel: Channel | MockChannel | null;
}

function Player({ channel }: PlayerProps) {
  return (
    <div className={styles.player}>
      {channel ? (
        <div className={styles.placeholder}>
          <div className={styles.icon}>▶</div>
          <div className={styles.info}>
            <div className={styles.channelName}>{channel.name}</div>
            <div className={styles.status}>準備中 - VLC統合待ち</div>
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.message}>チャンネルを選択してください</div>
          <div className={styles.hint}>Enter キーで再生</div>
        </div>
      )}
    </div>
  );
}

export default Player;

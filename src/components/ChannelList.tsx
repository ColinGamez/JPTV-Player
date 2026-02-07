import type { Channel } from '../types/channel';
import type { Channel as MockChannel } from '../data/mockData';
import { useStreamHealth, formatHealthStars, getHealthColor } from '../hooks/useStreamHealth';
import styles from './ChannelList.module.css';

interface ChannelListProps {
  channels: (Channel | MockChannel)[];
  selectedIndex: number;
  focused: boolean;
  favorites: string[];
}

function ChannelList({ channels, selectedIndex, focused, favorites }: ChannelListProps) {
  const { getHealthForChannel, isDevMode } = useStreamHealth();
  
  return (
    <div className={`${styles.list} ${focused ? styles.focused : ''}`}>
      <div className={styles.header}>チャンネル</div>
      <div className={styles.grid}>
        {channels.map((channel, index) => {
          const channelId = String(channel.id);
          const isFavorite = favorites.includes(channelId);
          const channelKey = channelId;
          
          // Get health score (dev mode only)
          const health = isDevMode ? getHealthForChannel(channel.url) : null;
          
          return (
            <div
              key={channelKey}
              className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
            >
              {isFavorite && <div className={styles.favorite}>★</div>}
              <div className={styles.logo}>
                {channel.logo ? (
                  <img src={channel.logo} alt={channel.name} />
                ) : (
                  <div className={styles.placeholder}>{channel.name[0]}</div>
                )}
              </div>
              <div className={styles.name}>{channel.name}</div>
              {health && health.samples >= 5 && (
                <div 
                  className={styles.health}
                  style={{ color: getHealthColor(health.score) }}
                  title={`Score: ${health.score}/100 | Bitrate: ${health.stats.avgBitrate} KB/s | Drop: ${health.stats.dropRate}%`}
                >
                  {health.score}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChannelList;

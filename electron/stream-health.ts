/**
 * Stream Health Scoring System
 * 
 * Collects VLC statistics and computes a 0-100 health score per channel.
 * Does not affect playback behavior.
 */

export interface StreamStats {
  inputBitrate: number;      // KB/s
  demuxBitrate: number;      // KB/s
  lostBuffers: number;
  displayedPictures: number;
  lostPictures: number;
  timestamp: number;         // When collected
}

export interface ChannelHealth {
  channelId: string;
  score: number;             // 0-100
  samples: number;           // Number of samples collected
  lastUpdate: number;        // Timestamp
  stats: {
    avgBitrate: number;      // Average bitrate (KB/s)
    dropRate: number;        // Percentage of dropped frames
    bufferIssues: number;    // Buffer loss events
  };
}

interface RollingStats {
  bitrates: number[];        // Last N bitrate samples
  lostPictures: number[];    // Last N lost picture counts
  displayedPictures: number[]; // Last N displayed picture counts
  lostBuffers: number[];     // Last N buffer loss counts
  lastStats: StreamStats | null;
}

const MAX_SAMPLES = 20;      // Keep last 20 samples (~ 1 minute at 3s intervals)
const MIN_SAMPLES = 5;       // Need at least 5 samples for scoring

export class StreamHealthScorer {
  private channelStats: Map<string, RollingStats> = new Map();
  private currentChannelId: string | null = null;

  /**
   * Update stats for the currently playing channel
   */
  updateStats(channelId: string, stats: StreamStats): void {
    this.currentChannelId = channelId;

    if (!this.channelStats.has(channelId)) {
      this.channelStats.set(channelId, {
        bitrates: [],
        lostPictures: [],
        displayedPictures: [],
        lostBuffers: [],
        lastStats: null
      });
    }

    const rolling = this.channelStats.get(channelId)!;

    // Calculate deltas from last sample
    if (rolling.lastStats) {
      const lostPicturesDelta = Math.max(0, stats.lostPictures - rolling.lastStats.lostPictures);
      const displayedPicturesDelta = Math.max(0, stats.displayedPictures - rolling.lastStats.displayedPictures);
      const lostBuffersDelta = Math.max(0, stats.lostBuffers - rolling.lastStats.lostBuffers);

      // Add to rolling windows
      rolling.lostPictures.push(lostPicturesDelta);
      rolling.displayedPictures.push(displayedPicturesDelta);
      rolling.lostBuffers.push(lostBuffersDelta);
    }

    // Always track bitrate
    rolling.bitrates.push(stats.inputBitrate);

    // Keep only last N samples
    if (rolling.bitrates.length > MAX_SAMPLES) {
      rolling.bitrates.shift();
      rolling.lostPictures.shift();
      rolling.displayedPictures.shift();
      rolling.lostBuffers.shift();
    }

    rolling.lastStats = stats;
  }

  /**
   * Compute health score (0-100) for a channel
   */
  getHealthScore(channelId: string): ChannelHealth | null {
    const rolling = this.channelStats.get(channelId);
    if (!rolling || rolling.bitrates.length < MIN_SAMPLES) {
      return null;
    }

    // Calculate average bitrate
    const avgBitrate = rolling.bitrates.reduce((sum, br) => sum + br, 0) / rolling.bitrates.length;

    // Calculate drop rate
    const totalDisplayed = rolling.displayedPictures.reduce((sum, n) => sum + n, 0);
    const totalLost = rolling.lostPictures.reduce((sum, n) => sum + n, 0);
    const dropRate = totalDisplayed > 0 ? (totalLost / (totalDisplayed + totalLost)) * 100 : 0;

    // Calculate buffer issues
    const bufferIssues = rolling.lostBuffers.reduce((sum, n) => sum + n, 0);

    // Compute score (0-100)
    let score = 100;

    // Penalize for low bitrate (< 500 KB/s is suspicious)
    if (avgBitrate < 500) {
      score -= 20;
    } else if (avgBitrate < 1000) {
      score -= 10;
    }

    // Penalize for frame drops
    if (dropRate > 5) {
      score -= 30;
    } else if (dropRate > 2) {
      score -= 15;
    } else if (dropRate > 0.5) {
      score -= 5;
    }

    // Penalize for buffer issues
    if (bufferIssues > 10) {
      score -= 30;
    } else if (bufferIssues > 5) {
      score -= 20;
    } else if (bufferIssues > 0) {
      score -= 10;
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      channelId,
      score,
      samples: rolling.bitrates.length,
      lastUpdate: Date.now(),
      stats: {
        avgBitrate: Math.round(avgBitrate),
        dropRate: Math.round(dropRate * 100) / 100,
        bufferIssues
      }
    };
  }

  /**
   * Get health for all channels
   */
  getAllHealth(): ChannelHealth[] {
    const results: ChannelHealth[] = [];
    
    for (const channelId of this.channelStats.keys()) {
      const health = this.getHealthScore(channelId);
      if (health) {
        results.push(health);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Clear stats for a channel
   */
  clearChannel(channelId: string): void {
    this.channelStats.delete(channelId);
  }

  /**
   * Clear all stats
   */
  clearAll(): void {
    this.channelStats.clear();
    this.currentChannelId = null;
  }

  /**
   * Get current channel ID
   */
  getCurrentChannel(): string | null {
    return this.currentChannelId;
  }
}

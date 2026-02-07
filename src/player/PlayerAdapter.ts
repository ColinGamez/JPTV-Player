export interface PlayerStats {
  currentTime: number;
  duration: number;
  buffering: boolean;
  error?: string;
}

export interface PlayerAdapter {
  play(url: string): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getVolume(): Promise<number>;
  getStats(): Promise<PlayerStats>;
  isPlaying(): boolean;
  onStateChange(callback: (state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'error') => void): void;
}

/**
 * Stub implementation - ready for VLC integration
 */
export class StubPlayerAdapter implements PlayerAdapter {
  private volume = 50;
  private playing = false;
  private currentUrl = '';
  private stateCallback?: (state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'error') => void;

  async play(url: string): Promise<void> {
    this.currentUrl = url;
    this.playing = true;
    this.stateCallback?.('playing');
  }

  async stop(): Promise<void> {
    this.playing = false;
    this.currentUrl = '';
    this.stateCallback?.('stopped');
  }

  async pause(): Promise<void> {
    this.playing = false;
    this.stateCallback?.('paused');
  }

  async resume(): Promise<void> {
    this.playing = true;
    this.stateCallback?.('playing');
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(100, volume));
  }

  async getVolume(): Promise<number> {
    return this.volume;
  }

  async getStats(): Promise<PlayerStats> {
    return {
      currentTime: 0,
      duration: 0,
      buffering: false
    };
  }

  isPlaying(): boolean {
    return this.playing;
  }

  onStateChange(callback: (state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'error') => void): void {
    this.stateCallback = callback;
  }
}

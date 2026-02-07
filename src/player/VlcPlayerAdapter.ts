import type { PlayerAdapter, PlayerStats } from './PlayerAdapter';

type PlayerState = 'playing' | 'paused' | 'stopped' | 'buffering' | 'error';

/**
 * VLC-based player adapter using native addon + IPC
 * Communicates with main process which controls the native VLC addon
 */
export class VlcPlayerAdapter implements PlayerAdapter {
  private stateCallback?: (state: PlayerState) => void;
  private currentState: PlayerState = 'stopped';
  private lastUrl = '';
  private playDebounceTimer: NodeJS.Timeout | null = null;
  private playAbortReject: ((reason: Error) => void) | null = null;
  private readonly DEBOUNCE_MS = 300;

  async play(url: string): Promise<void> {
    // Cancel any pending debounced play — reject its promise so callers aren't left hanging
    if (this.playDebounceTimer) {
      clearTimeout(this.playDebounceTimer);
      this.playDebounceTimer = null;
      if (this.playAbortReject) {
        this.playAbortReject(new Error('Play cancelled by newer request'));
        this.playAbortReject = null;
      }
    }

    return new Promise((resolve, reject) => {
      this.playAbortReject = reject;
      this.playDebounceTimer = setTimeout(async () => {
        this.playAbortReject = null;
        try {
          // Stop current playback first
          if (this.currentState === 'playing' || this.currentState === 'buffering') {
            await this.stop();
            // Small delay to ensure clean transition
            await new Promise(r => setTimeout(r, 100));
          }

          this.lastUrl = url;
          this.updateState('buffering');

          const result = await window.electronAPI.player.play(url);
          
          if (result.success) {
            this.updateState('playing');
            resolve();
          } else {
            this.updateState('error');
            reject(new Error(result.error || 'Failed to play stream'));
          }
        } catch (error) {
          this.updateState('error');
          reject(error);
        }
      }, this.DEBOUNCE_MS);
    });
  }

  async stop(): Promise<void> {
    if (this.playDebounceTimer) {
      clearTimeout(this.playDebounceTimer);
      this.playDebounceTimer = null;
    }

    // Reject any pending play() promise so callers aren't left hanging
    if (this.playAbortReject) {
      this.playAbortReject(new Error('Play cancelled by stop'));
      this.playAbortReject = null;
    }

    try {
      const result = await window.electronAPI.player.stop();
      if (result.success) {
        this.updateState('stopped');
        this.lastUrl = '';
      }
    } catch (error) {
      console.error('[VlcPlayerAdapter] Stop failed:', error);
    }
  }

  async pause(): Promise<void> {
    try {
      const result = await window.electronAPI.player.pause();
      if (result.success) {
        this.updateState('paused');
      }
    } catch (error) {
      console.error('[VlcPlayerAdapter] Pause failed:', error);
    }
  }

  async resume(): Promise<void> {
    try {
      const result = await window.electronAPI.player.resume();
      if (result.success) {
        this.updateState('playing');
      }
    } catch (error) {
      console.error('[VlcPlayerAdapter] Resume failed:', error);
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      await window.electronAPI.player.setVolume(volume);
    } catch (error) {
      console.error('[VlcPlayerAdapter] SetVolume failed:', error);
    }
  }

  async getVolume(): Promise<number> {
    try {
      const result = await window.electronAPI.player.getVolume();
      return result.volume;
    } catch (error) {
      console.error('[VlcPlayerAdapter] GetVolume failed:', error);
      return 50;
    }
  }

  async getStats(): Promise<PlayerStats> {
    try {
      const result = await window.electronAPI.player.getState();
      return {
        currentTime: 0,
        duration: 0,
        buffering: result.state === 'buffering',
        error: result.state === 'error' ? 'Playback error' : undefined
      };
    } catch (error) {
      return {
        currentTime: 0,
        duration: 0,
        buffering: false,
        error: 'Failed to get player state'
      };
    }
  }

  isPlaying(): boolean {
    return this.currentState === 'playing' || this.currentState === 'buffering';
  }

  onStateChange(callback: (state: PlayerState) => void): void {
    this.stateCallback = callback;
  }

  private updateState(state: PlayerState): void {
    if (this.currentState !== state) {
      this.currentState = state;
      this.stateCallback?.(state);
    }
  }

  getCurrentUrl(): string {
    return this.lastUrl;
  }

  getState(): PlayerState {
    return this.currentState;
  }

  /**
   * Sync adapter state when playback is started externally (e.g. via useChannelFallback IPC).
   * This ensures isPlaying() returns the correct value for space bar toggle.
   */
  syncState(state: PlayerState, url?: string): void {
    if (url) {
      this.lastUrl = url;
    }
    this.updateState(state);
  }
}

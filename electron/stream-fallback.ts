/**
 * Stream Fallback Manager
 * 
 * Handles automatic URL fallback when streams fail.
 * Tries each URL in sequence and remembers successful ones.
 */

import { RotatingLogger } from './logger';

export interface FallbackState {
  channelId: string;
  urls: string[];
  currentIndex: number;
  lastSuccessfulUrl?: string;
  failedUrls: Set<string>;
  retryCount: number;
}

const MAX_TRACKED_CHANNELS = 200; // Evict oldest entries beyond this

export class StreamFallbackManager {
  private fallbackStates: Map<string, FallbackState> = new Map();
  private logger: RotatingLogger | null = null;
  private maxRetriesPerUrl = 1;

  constructor(logger?: RotatingLogger) {
    this.logger = logger || null;
  }

  /**
   * Initialize or update fallback state for a channel
   */
  initializeChannel(channelId: string, urls: string[], lastSuccessfulUrl?: string): void {
    if (urls.length === 0) {
      this.logger?.warn('No URLs provided for channel', { channelId });
      return;
    }

    // Evict oldest tracked channel if map is at capacity
    if (!this.fallbackStates.has(channelId) && this.fallbackStates.size >= MAX_TRACKED_CHANNELS) {
      const firstKey = this.fallbackStates.keys().next().value;
      if (firstKey !== undefined && firstKey !== channelId) {
        this.fallbackStates.delete(firstKey);
      }
    }

    // Find starting index
    let startIndex = 0;
    if (lastSuccessfulUrl && urls.includes(lastSuccessfulUrl)) {
      startIndex = urls.indexOf(lastSuccessfulUrl);
    }

    this.fallbackStates.set(channelId, {
      channelId,
      urls,
      currentIndex: startIndex,
      lastSuccessfulUrl,
      failedUrls: new Set(),
      retryCount: 0
    });

    this.logger?.info('Fallback initialized', { 
      channelId, 
      urlCount: urls.length, 
      startIndex 
    });
  }

  /**
   * Get the current URL to try for a channel
   */
  getCurrentUrl(channelId: string): string | null {
    const state = this.fallbackStates.get(channelId);
    if (!state || state.currentIndex >= state.urls.length) {
      return null;
    }

    return state.urls[state.currentIndex];
  }

  /**
   * Get all URLs for a channel
   */
  getUrls(channelId: string): string[] {
    const state = this.fallbackStates.get(channelId);
    return state ? [...state.urls] : [];
  }

  /**
   * Mark current URL as successful
   */
  markSuccess(channelId: string): void {
    const state = this.fallbackStates.get(channelId);
    if (!state) return;

    const successUrl = state.urls[state.currentIndex];
    state.lastSuccessfulUrl = successUrl;
    state.failedUrls.clear();
    state.retryCount = 0;

    this.logger?.info('URL marked successful', { 
      channelId, 
      url: successUrl,
      index: state.currentIndex
    });
  }

  /**
   * Mark current URL as failed and move to next
   * Returns next URL to try, or null if all failed
   */
  markFailureAndGetNext(channelId: string): string | null {
    const state = this.fallbackStates.get(channelId);
    if (!state) return null;

    const failedUrl = state.urls[state.currentIndex];
    state.failedUrls.add(failedUrl);

    this.logger?.warn('URL marked failed', { 
      channelId, 
      url: failedUrl,
      index: state.currentIndex,
      retryCount: state.retryCount
    });

    // Check if we should retry this URL (before incrementing)
    if (state.retryCount < this.maxRetriesPerUrl) {
      state.retryCount++;
      this.logger?.info('Retrying same URL', { channelId, url: failedUrl });
      return failedUrl;
    }

    // Move to next URL
    state.retryCount = 0;
    state.currentIndex++;

    // Check if all URLs have been tried
    if (state.currentIndex >= state.urls.length) {
      this.logger?.error('All URLs failed for channel', { 
        channelId, 
        totalUrls: state.urls.length,
        failedUrls: Array.from(state.failedUrls)
      });
      return null;
    }

    const nextUrl = state.urls[state.currentIndex];
    this.logger?.info('Trying next URL', { 
      channelId, 
      url: nextUrl,
      index: state.currentIndex
    });

    return nextUrl;
  }

  /**
   * Reset fallback state for a channel (start over)
   */
  reset(channelId: string): void {
    const state = this.fallbackStates.get(channelId);
    if (!state) return;

    // Prefer last successful URL if available
    if (state.lastSuccessfulUrl && state.urls.includes(state.lastSuccessfulUrl)) {
      state.currentIndex = state.urls.indexOf(state.lastSuccessfulUrl);
    } else {
      state.currentIndex = 0;
    }

    state.failedUrls.clear();
    state.retryCount = 0;

    this.logger?.info('Fallback state reset', { channelId });
  }

  /**
   * Get last successful URL for a channel
   */
  getLastSuccessfulUrl(channelId: string): string | null {
    const state = this.fallbackStates.get(channelId);
    return state?.lastSuccessfulUrl || null;
  }

  /**
   * Check if all URLs have been tried and failed
   */
  hasMoreUrls(channelId: string): boolean {
    const state = this.fallbackStates.get(channelId);
    if (!state) return false;

    return state.currentIndex < state.urls.length;
  }

  /**
   * Get fallback statistics
   */
  getStats(channelId: string): { 
    total: number; 
    current: number; 
    failed: number;
    hasMore: boolean;
  } | null {
    const state = this.fallbackStates.get(channelId);
    if (!state) return null;

    return {
      total: state.urls.length,
      current: state.currentIndex,
      failed: state.failedUrls.size,
      hasMore: state.currentIndex < state.urls.length
    };
  }

  /**
   * Clear state for a channel
   */
  clearChannel(channelId: string): void {
    this.fallbackStates.delete(channelId);
  }

  /**
   * Clear all states
   */
  clearAll(): void {
    this.fallbackStates.clear();
  }
}

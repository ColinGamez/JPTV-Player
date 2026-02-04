/**
 * Channel Fallback Hook
 * 
 * Manages automatic URL fallback for channel playback.
 */

import { useCallback } from 'react';
import type { Channel } from '../types/channel';
import type { Channel as MockChannel } from '../data/mockData';

export interface PlaybackResult {
  success: boolean;
  error?: string;
  url?: string;
}

export interface UseChannelFallbackReturn {
  playChannelWithFallback: (channel: Channel | MockChannel) => Promise<PlaybackResult>;
  retryCurrentChannel: (channelId: string) => Promise<PlaybackResult>;
  getLastSuccessfulUrl: (channelId: string) => Promise<string | null>;
}

/**
 * Hook for managing channel fallback URLs
 */
export function useChannelFallback(): UseChannelFallbackReturn {
  /**
   * Play channel with automatic fallback support
   */
  const playChannelWithFallback = useCallback(async (channel: Channel | MockChannel): Promise<PlaybackResult> => {
    if (!window.electronAPI?.player) {
      return { success: false, error: 'Player not available' };
    }

    try {
      // Check if channel has multiple URLs (parsed channels)
      const hasMultipleUrls = 'urls' in channel && Array.isArray(channel.urls) && channel.urls.length > 1;
      
      if (hasMultipleUrls) {
        // Use fallback mechanism
        const channelId = String(channel.id);
        const urls = (channel as Channel).urls;
        const lastSuccessfulUrl = (channel as Channel).lastSuccessfulUrl;

        console.log('[Fallback] Playing channel with fallback:', {
          channel: channel.name,
          urlCount: urls.length,
          lastSuccessful: lastSuccessfulUrl
        });

        const result = await window.electronAPI.player.playWithFallback(
          channelId,
          urls,
          lastSuccessfulUrl
        );

        if (result.success) {
          console.log('[Fallback] Playback successful:', result.url);
        } else {
          console.error('[Fallback] All URLs failed for channel:', channel.name);
        }

        return result;
      } else {
        // Single URL - use standard play
        const result = await window.electronAPI.player.play(channel.url);
        return { ...result, url: channel.url };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Fallback] Playback error:', error);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Retry current channel with next fallback URL
   */
  const retryCurrentChannel = useCallback(async (channelId: string): Promise<PlaybackResult> => {
    if (!window.electronAPI?.player) {
      return { success: false, error: 'Player not available' };
    }

    try {
      console.log('[Fallback] Retrying channel:', channelId);
      const result = await window.electronAPI.player.retryFallback(channelId);
      
      if (result.success) {
        console.log('[Fallback] Retry successful:', result.url);
      } else {
        console.error('[Fallback] Retry failed:', result.error);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Fallback] Retry error:', error);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Get last successful URL for a channel
   */
  const getLastSuccessfulUrl = useCallback(async (channelId: string): Promise<string | null> => {
    if (!window.electronAPI?.player) {
      return null;
    }

    try {
      return await window.electronAPI.player.getLastSuccessfulUrl(channelId);
    } catch (error) {
      console.error('[Fallback] Error getting last successful URL:', error);
      return null;
    }
  }, []);

  return {
    playChannelWithFallback,
    retryCurrentChannel,
    getLastSuccessfulUrl
  };
}

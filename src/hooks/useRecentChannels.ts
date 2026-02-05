/**
 * Recent Channels Hook
 * Tracks and provides quick access to recently watched channels
 */

import { useState, useCallback, useEffect } from 'react';
import type { Channel } from '../types/channel';

const MAX_RECENT_CHANNELS = 10;
const STORAGE_KEY = 'recentChannels';

interface RecentChannel {
  channel: Channel;
  timestamp: number;
  watchCount: number;
}

export function useRecentChannels() {
  const [recentChannels, setRecentChannels] = useState<RecentChannel[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentChannel[];
        setRecentChannels(parsed);
      }
    } catch (error) {
      console.error('Failed to load recent channels:', error);
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentChannels));
    } catch (error) {
      console.error('Failed to save recent channels:', error);
    }
  }, [recentChannels]);

  // Add or update a recent channel
  const addRecentChannel = useCallback((channel: Channel) => {
    setRecentChannels(prev => {
      // Check if channel already exists
      const existingIndex = prev.findIndex(rc => rc.channel.id === channel.id);
      
      if (existingIndex >= 0) {
        // Update existing: increment watch count and update timestamp
        const updated = [...prev];
        updated[existingIndex] = {
          channel,
          timestamp: Date.now(),
          watchCount: updated[existingIndex].watchCount + 1,
        };
        
        // Sort by most recent
        updated.sort((a, b) => b.timestamp - a.timestamp);
        
        return updated;
      } else {
        // Add new channel
        const newRecent: RecentChannel = {
          channel,
          timestamp: Date.now(),
          watchCount: 1,
        };
        
        // Add to front and limit to MAX_RECENT_CHANNELS
        return [newRecent, ...prev].slice(0, MAX_RECENT_CHANNELS);
      }
    });
  }, []);

  // Clear all recent channels
  const clearRecent = useCallback(() => {
    setRecentChannels([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Remove specific channel
  const removeRecentChannel = useCallback((channelId: string) => {
    setRecentChannels(prev => prev.filter(rc => rc.channel.id !== channelId));
  }, []);

  // Get most watched channels (sorted by watch count)
  const getMostWatched = useCallback((limit: number = 5) => {
    return [...recentChannels]
      .sort((a, b) => b.watchCount - a.watchCount)
      .slice(0, limit)
      .map(rc => rc.channel);
  }, [recentChannels]);

  return {
    recentChannels: recentChannels.map(rc => rc.channel),
    recentWithMetadata: recentChannels,
    addRecentChannel,
    clearRecent,
    removeRecentChannel,
    getMostWatched,
  };
}

/**
 * Recent Channels Hook
 * Tracks and provides quick access to recently watched channels
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
  const initializedRef = useRef(false);

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
    // Mark as initialized after first load
    initializedRef.current = true;
  }, []);

  // Save to localStorage when changed (skip initial mount write)
  useEffect(() => {
    if (!initializedRef.current) return;
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

  // Memoize channel list to avoid new array reference on every render
  const channelList = useMemo(() => recentChannels.map(rc => rc.channel), [recentChannels]);

  return {
    recentChannels: channelList,
    recentWithMetadata: recentChannels,
    addRecentChannel,
    clearRecent,
    removeRecentChannel,
    getMostWatched,
  };
}

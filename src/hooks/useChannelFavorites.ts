/**
 * Channel Favorites Hook
 * Manage favorite channels with persistence
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Channel } from '../types/channel';

const STORAGE_KEY = 'favoriteChannels';
const MAX_FAVORITES = 50;

export function useChannelFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setFavoriteIds(new Set(parsed));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
    initializedRef.current = true;
  }, []);

  // Save favorites to localStorage when changed (skip initial mount write)
  useEffect(() => {
    if (!initializedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favoriteIds)));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }, [favoriteIds]);

  // Check if channel is favorite
  const isFavorite = useCallback((channelId: string): boolean => {
    return favoriteIds.has(channelId);
  }, [favoriteIds]);

  // Add channel to favorites
  const addFavorite = useCallback((channelId: string): boolean => {
    if (favoriteIds.size >= MAX_FAVORITES) {
      console.warn(`Maximum ${MAX_FAVORITES} favorites reached`);
      return false;
    }

    setFavoriteIds(prev => {
      const newSet = new Set(prev);
      newSet.add(channelId);
      return newSet;
    });
    return true;
  }, [favoriteIds.size]);

  // Remove channel from favorites
  const removeFavorite = useCallback((channelId: string): void => {
    setFavoriteIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(channelId);
      return newSet;
    });
  }, []);

  // Toggle favorite status
  const toggleFavorite = useCallback((channelId: string): boolean => {
    if (favoriteIds.has(channelId)) {
      removeFavorite(channelId);
      return false;
    } else {
      return addFavorite(channelId);
    }
  }, [favoriteIds, addFavorite, removeFavorite]);

  // Clear all favorites
  const clearFavorites = useCallback((): void => {
    setFavoriteIds(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Get favorite channels from channel list
  const getFavoriteChannels = useCallback((channels: Channel[]): Channel[] => {
    return channels.filter(channel => favoriteIds.has(channel.id));
  }, [favoriteIds]);

  // Get favorite count
  const favoriteCount = favoriteIds.size;

  // Check if at max capacity
  const isMaxReached = favoriteCount >= MAX_FAVORITES;

  return {
    favoriteIds: Array.from(favoriteIds),
    favoriteCount,
    isMaxReached,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
    getFavoriteChannels,
  };
}

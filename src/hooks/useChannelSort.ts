/**
 * Channel Sorting
 * Provides multiple sorting options for channel lists
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { Channel } from '../types/channel';

export type SortOption = 
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'number-asc'
  | 'number-desc'
  | 'recently-watched'
  | 'most-watched'
  | 'favorites-first';

export interface SortConfig {
  id: SortOption;
  label: string;
  icon: string;
}

export const SORT_OPTIONS: SortConfig[] = [
  { id: 'default', label: 'Default', icon: '📋' },
  { id: 'name-asc', label: 'Name A→Z', icon: '🔤' },
  { id: 'name-desc', label: 'Name Z→A', icon: '🔠' },
  { id: 'number-asc', label: 'Number ↑', icon: '🔢' },
  { id: 'number-desc', label: 'Number ↓', icon: '🔢' },
  { id: 'recently-watched', label: 'Recently Watched', icon: '🕐' },
  { id: 'most-watched', label: 'Most Watched', icon: '📊' },
  { id: 'favorites-first', label: 'Favorites First', icon: '⭐' },
];

interface SortContext {
  recentChannelIds?: string[];
  watchCounts?: Record<string, number>;
  favoriteIds?: string[];
}

function getChannelSortKey(channel: Channel): string {
  return typeof channel.id === 'string' ? channel.id : String(channel.id);
}

function getChannelNumber(channel: Channel): number {
  if (typeof channel.id === 'number') return channel.id;
  // Try parsing as decimal number first, then fall back to hash-based ordering
  const parsed = parseInt(channel.id, 10);
  if (!isNaN(parsed)) return parsed;
  // For non-numeric IDs, generate a stable number from the string
  let hash = 0;
  for (let i = 0; i < channel.id.length; i++) {
    hash = ((hash << 5) - hash) + channel.id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function useChannelSort(context: SortContext = {}) {
  // Use ref to avoid context object identity causing sortChannels to rebuild
  const contextRef = useRef(context);
  contextRef.current = context;

  const [sortOption, setSortOption] = useState<SortOption>(() => {
    try {
      const stored = localStorage.getItem('channelSort');
      return (stored as SortOption) || 'default';
    } catch {
      return 'default';
    }
  });

  const setSort = useCallback((option: SortOption) => {
    setSortOption(option);
    try {
      localStorage.setItem('channelSort', option);
    } catch { /* storage full */ }
  }, []);

  const cycleSort = useCallback(() => {
    const currentIdx = SORT_OPTIONS.findIndex(o => o.id === sortOption);
    const nextIdx = (currentIdx + 1) % SORT_OPTIONS.length;
    setSort(SORT_OPTIONS[nextIdx].id);
  }, [sortOption, setSort]);

  const sortChannels = useCallback((channels: Channel[]): Channel[] => {
    if (sortOption === 'default') return channels;

    const sorted = [...channels];
    const ctx = contextRef.current;

    switch (sortOption) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name, 'ja'));

      case 'number-asc':
        return sorted.sort((a, b) => getChannelNumber(a) - getChannelNumber(b));

      case 'number-desc':
        return sorted.sort((a, b) => getChannelNumber(b) - getChannelNumber(a));

      case 'recently-watched': {
        const recentIds = ctx.recentChannelIds || [];
        return sorted.sort((a, b) => {
          const aIdx = recentIds.indexOf(getChannelSortKey(a));
          const bIdx = recentIds.indexOf(getChannelSortKey(b));
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      }

      case 'most-watched': {
        const counts = ctx.watchCounts || {};
        return sorted.sort((a, b) => {
          const aCount = counts[getChannelSortKey(a)] || 0;
          const bCount = counts[getChannelSortKey(b)] || 0;
          return bCount - aCount;
        });
      }

      case 'favorites-first': {
        const favIds = ctx.favoriteIds || [];
        return sorted.sort((a, b) => {
          const aFav = favIds.includes(getChannelSortKey(a)) ? 0 : 1;
          const bFav = favIds.includes(getChannelSortKey(b)) ? 0 : 1;
          return aFav - bFav;
        });
      }

      default:
        return sorted;
    }
  }, [sortOption]);

  const currentSort = useMemo(
    () => SORT_OPTIONS.find(o => o.id === sortOption) || SORT_OPTIONS[0],
    [sortOption]
  );

  return {
    sortOption,
    currentSort,
    sortOptions: SORT_OPTIONS,
    setSort,
    cycleSort,
    sortChannels,
  };
}

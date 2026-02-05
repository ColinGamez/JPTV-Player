/**
 * Channel Search Hook
 * Provides fast, fuzzy channel search with keyboard navigation
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Channel } from '../types/channel';

interface UseChannelSearchOptions {
  channels: Channel[];
  onSelectChannel?: (channel: Channel) => void;
}

export function useChannelSearch({ channels, onSelectChannel }: UseChannelSearchOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fuzzy search implementation
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const scored = channels
      .map(channel => {
        const name = channel.name.toLowerCase();
        const group = channel.group.toLowerCase();
        
        let score = 0;
        
        // Exact match = highest score
        if (name === query) score = 1000;
        // Starts with query = high score
        else if (name.startsWith(query)) score = 500;
        // Contains query = medium score
        else if (name.includes(query)) score = 250;
        // Group matches = lower score
        else if (group.includes(query)) score = 100;
        
        // Fuzzy match = lowest score
        if (score === 0) {
          let fuzzyScore = 0;
          let lastIndex = -1;
          for (const char of query) {
            const index = name.indexOf(char, lastIndex + 1);
            if (index > lastIndex) {
              fuzzyScore++;
              lastIndex = index;
            }
          }
          if (fuzzyScore === query.length) score = 50;
        }
        
        return { channel, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Limit to top 20 results

    return scored.map(item => item.channel);
  }, [channels, searchQuery]);

  // Open search modal
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  // Close search modal
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  // Update search query
  const updateQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
  }, []);

  // Navigate selection
  const moveSelection = useCallback((direction: 'up' | 'down') => {
    setSelectedIndex(prev => {
      if (searchResults.length === 0) return 0;
      if (direction === 'down') {
        return prev < searchResults.length - 1 ? prev + 1 : 0;
      } else {
        return prev > 0 ? prev - 1 : searchResults.length - 1;
      }
    });
  }, [searchResults.length]);

  // Select current result
  const selectCurrent = useCallback(() => {
    if (searchResults.length > 0 && searchResults[selectedIndex]) {
      const channel = searchResults[selectedIndex];
      onSelectChannel?.(channel);
      closeSearch();
    }
  }, [searchResults, selectedIndex, onSelectChannel, closeSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeSearch();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveSelection('down');
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveSelection('up');
          break;
        case 'Enter':
          e.preventDefault();
          selectCurrent();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, closeSearch, moveSelection, selectCurrent]);

  // Global keyboard shortcut (Ctrl+F or Cmd+F)
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [openSearch]);

  return {
    // State
    isSearchOpen,
    searchQuery,
    searchResults,
    selectedIndex,

    // Actions
    openSearch,
    closeSearch,
    updateQuery,
    moveSelection,
    selectCurrent,
  };
}

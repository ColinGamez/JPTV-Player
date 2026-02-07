/**
 * Channel Grid View
 * Grid layout for browsing channels visually
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Channel } from '../types/channel';
import './ChannelGrid.css';

interface ChannelGridProps {
  channels: Channel[];
  isVisible: boolean;
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
  favorites: string[];
}

export const ChannelGrid: React.FC<ChannelGridProps> = ({
  channels,
  isVisible,
  onClose,
  onSelectChannel,
  favorites,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const gridRef = useRef<HTMLDivElement>(null);

  // Filter channels (memoized to prevent keyboard effect re-registration)
  const filteredChannels = useMemo(() => 
    filter === 'favorites' 
      ? channels.filter(ch => {
          const channelId = String(ch.id);
          return favorites.includes(channelId);
        })
      : channels,
    [channels, favorites, filter]
  );

  // Reset selectedIndex when filter changes to avoid out-of-bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const cols = Math.floor((gridRef.current?.offsetWidth || 900) / 160);
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(filteredChannels.length - 1, prev + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - cols));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(filteredChannels.length - 1, prev + cols));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredChannels[selectedIndex]) {
            onSelectChannel(filteredChannels[selectedIndex]);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'f':
          e.preventDefault();
          setFilter(prev => prev === 'all' ? 'favorites' : 'all');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, selectedIndex, filteredChannels, onSelectChannel, onClose]);

  // Auto-scroll selected into view
  useEffect(() => {
    if (isVisible) {
      const selected = gridRef.current?.querySelector('.grid-item.selected');
      selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="channel-grid-overlay" onClick={onClose}>
      <div className="channel-grid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="grid-header">
          <h2>Channel Grid</h2>
          <div className="grid-controls">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({channels.length})
            </button>
            <button
              className={`filter-btn ${filter === 'favorites' ? 'active' : ''}`}
              onClick={() => setFilter('favorites')}
            >
              ★ Favorites ({favorites.length})
            </button>
          </div>
          <button className="grid-close-btn" onClick={onClose} aria-label="Close channel grid">✕</button>
        </div>

        <div className="grid-container" ref={gridRef}>
          {filteredChannels.map((channel, index) => {
            const channelId = String(channel.id);
            const isFavorite = favorites.includes(channelId);
            
            return (
              <div
                key={channel.id}
                className={`grid-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelectChannel(channel);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="grid-item-logo"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="grid-item-placeholder">📺</div>
                )}
                <div className="grid-item-name">{channel.name}</div>
                {isFavorite && <div className="grid-item-favorite">★</div>}
              </div>
            );
          })}
        </div>

        <div className="grid-footer">
          <span>↑↓←→ Navigate</span>
          <span>Enter Select</span>
          <span>F Filter</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};

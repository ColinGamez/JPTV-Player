/**
 * Channel Search Modal Component
 * Fast, keyboard-navigable channel search overlay
 */

import React, { useRef, useEffect } from 'react';
import type { Channel } from '../types/channel';
import './ChannelSearchModal.css';

interface ChannelSearchModalProps {
  isOpen: boolean;
  searchQuery: string;
  results: Channel[];
  selectedIndex: number;
  onQueryChange: (query: string) => void;
  onSelect: (channel: Channel) => void;
  onClose: () => void;
}

export const ChannelSearchModal: React.FC<ChannelSearchModalProps> = ({
  isOpen,
  searchQuery,
  results,
  selectedIndex,
  onQueryChange,
  onSelect,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="channel-search-overlay" onClick={onClose}>
      <div className="channel-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <div className="search-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search channels... (Type to search, ↑↓ to navigate, Enter to select)"
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              autoComplete="off"
            />
            <button className="search-close-btn" onClick={onClose} title="Close (Esc)">
              ✕
            </button>
          </div>
          {searchQuery && (
            <div className="search-info">
              {results.length} channel{results.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>

        <div className="search-results">
          {!searchQuery && (
            <div className="search-empty">
              <div className="search-empty-icon">🔍</div>
              <p>Type to search channels</p>
              <p className="search-hint">Search by name or category</p>
            </div>
          )}

          {searchQuery && results.length === 0 && (
            <div className="search-empty">
              <div className="search-empty-icon">📺</div>
              <p>No channels found</p>
              <p className="search-hint">Try a different search term</p>
            </div>
          )}

          {results.map((channel, index) => (
            <div
              key={channel.id}
              ref={index === selectedIndex ? selectedRef : null}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(channel)}
              onMouseEnter={() => {
                // Mouse hover updates selection (but keyboard nav still works)
              }}
            >
              {channel.logo && (
                <img
                  src={channel.logo}
                  alt={channel.name}
                  className="result-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="result-info">
                <div className="result-name">{channel.name}</div>
                <div className="result-group">{channel.group}</div>
              </div>
              {index === selectedIndex && (
                <div className="result-indicator">▶</div>
              )}
            </div>
          ))}
        </div>

        <div className="search-footer">
          <span className="shortcut-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> Navigate
          </span>
          <span className="shortcut-hint">
            <kbd>Enter</kbd> Select
          </span>
          <span className="shortcut-hint">
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
};

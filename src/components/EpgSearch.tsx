import React, { useState, useEffect, useRef } from 'react';
import { EpgStore, SearchResult } from '../epg/EpgStore';
import styles from './EpgSearch.module.css';

interface EpgSearchProps {
  epgStore: EpgStore;
  channels: Array<{ id: string; name: string }>;
  onSelectResult: (channelId: string, timeMs: number, programTitle: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const EpgSearch: React.FC<EpgSearchProps> = ({
  epgStore,
  channels,
  onSelectResult,
  onClose,
  isOpen,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Perform search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      const searchResults = epgStore.searchPrograms(query, undefined, 50);
      setResults(searchResults);
      setSelectedIndex(0);
      setIsSearching(false);
    }, 300); // Debounce 300ms

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [query, epgStore]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    onSelectResult(result.program.channelId, result.program.startMs, result.program.title);
    onClose();
  };

  // Get channel name from ID
  const getChannelName = (channelId: string): string => {
    const channel = channels.find((ch) => ch.id === channelId);
    return channel?.name || channelId;
  };

  // Format time display
  const formatTime = (timeMs: number): string => {
    const date = new Date(timeMs);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // Group results by date
  const groupedResults = React.useMemo(() => {
    const groups: { [key: string]: SearchResult[] } = {};
    results.forEach((result) => {
      const date = new Date(result.program.startMs);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(result);
    });
    return groups;
  }, [results]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.searchBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <div className={styles.searchInputWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="番組名、説明、カテゴリで検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button
                className={styles.clearButton}
                onClick={() => setQuery('')}
                title="クリア"
              >
                ×
              </button>
            )}
          </div>
          <button className={styles.closeButton} onClick={onClose} title="閉じる (ESC)">
            ×
          </button>
        </div>

        <div className={styles.searchResults}>
          {isSearching && (
            <div className={styles.searchStatus}>検索中...</div>
          )}
          {!isSearching && query && results.length === 0 && (
            <div className={styles.searchStatus}>結果が見つかりませんでした</div>
          )}
          {!isSearching && results.length > 0 && (
            <>
              <div className={styles.resultCount}>
                {results.length} 件の結果
              </div>
              {Object.entries(groupedResults).map(([dateKey, dateResults]) => {
                const [year, month, day] = dateKey.split('-');
                const dateLabel = `${month}月${day}日`;
                
                return (
                  <div key={dateKey} className={styles.resultGroup}>
                    <div className={styles.resultGroupDate}>{dateLabel}</div>
                    {dateResults.map((result, index) => {
                      const globalIndex = results.indexOf(result);
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <div
                          key={`${result.program.channelId}-${result.program.startMs}`}
                          className={`${styles.resultItem} ${isSelected ? styles.selected : ''}`}
                          onClick={() => handleSelectResult(result)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                        >
                          <div className={styles.resultTitle}>{result.program.title}</div>
                          <div className={styles.resultMeta}>
                            <span className={styles.resultChannel}>
                              📺 {getChannelName(result.program.channelId)}
                            </span>
                            <span className={styles.resultTime}>
                              🕒 {formatTime(result.program.startMs)}
                            </span>
                          </div>
                          {result.program.description && (
                            <div className={styles.resultDescription}>
                              {result.program.description.substring(0, 100)}
                              {result.program.description.length > 100 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
          {!query && (
            <div className={styles.searchHelp}>
              <p>💡 ヒント:</p>
              <ul>
                <li>番組名、説明文、カテゴリで検索できます</li>
                <li>↑↓ キーで結果を移動</li>
                <li>Enter で選択</li>
                <li>ESC で閉じる</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

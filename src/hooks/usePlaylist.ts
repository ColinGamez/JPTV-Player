import { useState, useCallback } from 'react';
import type { Channel } from '../types/channel';

export function usePlaylist() {
  const [playlistPath, setPlaylistPath] = useState<string | null>(null);
  const [playlistContent, setPlaylistContent] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Record<string, Channel[]>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [isElectron] = useState(() => typeof window !== 'undefined' && window.electronAPI !== undefined);

  const openPlaylist = useCallback(async () => {
    if (!isElectron) {
      console.warn('Playlist opening only works in Electron');
      return false;
    }

    try {
      const result = await window.electronAPI.openPlaylist();
      if (result) {
        setPlaylistPath(result.path);
        setPlaylistContent(result.content);

        if (result.parseResult) {
          if (result.parseResult.success && result.parseResult.data) {
            setChannels(result.parseResult.data.channels);
            setCategories(result.parseResult.data.categories);
            setParseError(null);
            console.log(`Loaded ${result.parseResult.data.channels.length} channels`);
            if (result.parseResult.skippedCount) {
              console.warn(`Skipped ${result.parseResult.skippedCount} malformed entries`);
            }
          } else {
            setParseError(result.parseResult.error || 'Failed to parse playlist');
            console.error('Parse error:', result.parseResult.error);
          }
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to open playlist:', error);
      setParseError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }, [isElectron]);

  return {
    playlistPath,
    playlistContent,
    channels,
    categories,
    parseError,
    openPlaylist,
    isElectron
  };
}

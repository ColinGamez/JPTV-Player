import { useState, useCallback, useEffect, useRef } from 'react';
import type { Channel } from '../types/channel';
import type { ProfileSession } from '../types/profile';

interface UsePlaylistOptions {
  profileSession?: ProfileSession;
  updateProfileData?: (data: any) => Promise<void>;
}

export function usePlaylist(options?: UsePlaylistOptions) {
  const { profileSession, updateProfileData } = options || {};
  const [playlistPath, setPlaylistPath] = useState<string | null>(null);
  const [playlistContent, setPlaylistContent] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Record<string, Channel[]>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [isElectron] = useState(() => typeof window !== 'undefined' && window.electronAPI !== undefined);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const lastLoadedPath = useRef<string | null>(null); // Track loaded path to prevent reloads
  const loadingRef = useRef(false); // Guard against concurrent loads

  // Load playlist from file path
  const loadPlaylistFromPath = useCallback(async (path: string) => {
    if (!isElectron) return false;
    if (loadingRef.current) return false; // Prevent concurrent loads
    
    // Mark path as attempted immediately to prevent re-triggering on failure
    lastLoadedPath.current = path;
    loadingRef.current = true;
    setIsLoadingPlaylist(true);
    try {
      console.log(`[Playlist] Loading from saved path: ${path}`);
      const result = await window.electronAPI.loadPlaylistFromPath(path);
      
      if (result && result.parseResult?.success && result.parseResult.data) {
        setPlaylistPath(path);
        setPlaylistContent(result.content);
        setChannels(result.parseResult.data.channels);
        setCategories(result.parseResult.data.categories);
        setParseError(null);
        console.log(`[Playlist] Restored ${result.parseResult.data.channels.length} channels from ${path}`);
        if (result.parseResult.skippedCount) {
          console.warn(`[Playlist] Skipped ${result.parseResult.skippedCount} malformed entries`);
        }
        return true;
      } else {
        const error = result?.parseResult?.error || 'Failed to parse playlist';
        console.error(`[Playlist] Failed to load: ${error}`);
        setParseError(error);
      }
    } catch (error) {
      console.error('[Playlist] Failed to load from path:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to load playlist');
    } finally {
      loadingRef.current = false;
      setIsLoadingPlaylist(false);
    }
    return false;
  }, [isElectron]);

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
            console.log(`[Playlist] Loaded ${result.parseResult.data.channels.length} channels`);
            
            // Save playlist path to profile
            if (updateProfileData && result.path) {
              await updateProfileData({ playlistPath: result.path });
              console.log(`[Playlist] Saved path to profile: ${result.path}`);
            }
            
            if (result.parseResult.skippedCount) {
              console.warn(`[Playlist] Skipped ${result.parseResult.skippedCount} malformed entries`);
            }
          } else {
            setParseError(result.parseResult.error || 'Failed to parse playlist');
            console.error('[Playlist] Parse error:', result.parseResult.error);
          }
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Playlist] Failed to open playlist:', error);
      setParseError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }, [isElectron, updateProfileData]);

  // Auto-load playlist from profile on mount
  useEffect(() => {
    const savedPath = profileSession?.data.playlistPath;
    
    // Skip if: no saved path, already loaded, currently loading, OR already have channels
    if (!savedPath || 
        lastLoadedPath.current === savedPath || 
        isLoadingPlaylist || 
        channels.length > 0) {
      return;
    }
    
    console.log(`[Playlist] Auto-loading saved playlist: ${savedPath}`);
    loadPlaylistFromPath(savedPath);
  }, [profileSession?.data.playlistPath, isLoadingPlaylist, channels.length, loadPlaylistFromPath]);

  return {
    playlistPath,
    playlistContent,
    channels,
    categories,
    parseError,
    openPlaylist,
    loadPlaylistFromPath,
    isElectron
  };
}

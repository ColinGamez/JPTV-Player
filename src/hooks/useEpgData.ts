import { useState, useEffect, useCallback, useRef } from 'react';
import type { EpgNowNext, EpgGuideWindow, EpgChannel } from '../types/epg';

interface EpgStats {
  loaded: boolean;
  channelCount: number;
  programCount: number;
}

interface UseEpgDataReturn {
  // Data
  nowNext: Map<string, EpgNowNext>;
  guideWindow: EpgGuideWindow | null;
  channels: EpgChannel[];
  stats: EpgStats;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  loadXmltvFile: () => Promise<void>;
  refreshNowNext: (channelIds: string[]) => Promise<void>;
  loadGuideWindow: (channelIds: string[], startTime: number, endTime: number) => Promise<void>;
  clearEpg: () => Promise<void>;
}

export function useEpgData(autoRefreshInterval: number = 60000): UseEpgDataReturn {
  const [nowNext, setNowNext] = useState<Map<string, EpgNowNext>>(new Map());
  const [guideWindow, setGuideWindow] = useState<EpgGuideWindow | null>(null);
  const [channels, setChannels] = useState<EpgChannel[]>([]);
  const [stats, setStats] = useState<EpgStats>({
    loaded: false,
    channelCount: 0,
    programCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load EPG stats on mount
  const loadStats = useCallback(async () => {
    try {
      const result = await window.electron?.epg?.getStats();
      if (!result) return;
      setStats({
        loaded: result.isLoaded,
        channelCount: result.channels,
        programCount: result.totalPrograms
      });
      
      if (result.isLoaded) {
        const channelList = await window.electron?.epg?.getAllChannels() ?? [];
        setChannels(channelList);
      }
    } catch (err) {
      console.error('Failed to load EPG stats:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Load XMLTV file via file picker
  const loadXmltvFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electron?.epg?.openXmltvFile();
      
      if (result) {
        await loadStats();
        console.log(`EPG loaded: ${result.parseResult.channelCount} channels, ${result.parseResult.programCount} programs in ${result.parseResult.parseTime}ms`);
      } else {
        setError('Failed to load XMLTV file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error loading XMLTV');
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  // Refresh now/next for specific channels
  const refreshNowNext = useCallback(async (channelIds: string[]) => {
    if (!stats.loaded || channelIds.length === 0) return;

    try {
      const updates = new Map<string, EpgNowNext>();
      
      await Promise.all(
        channelIds.map(async (channelId) => {
          const data = await window.electron?.epg?.getNowNext(channelId);
          if (data) {
            updates.set(channelId, data);
          }
        })
      );

      setNowNext(prev => {
        const newMap = new Map(prev);
        updates.forEach((value, key) => newMap.set(key, value));
        return newMap;
      });
    } catch (err) {
      console.error('Failed to refresh now/next:', err);
    }
  }, [stats.loaded]);

  // Load guide window for multiple channels
  const loadGuideWindow = useCallback(async (
    channelIds: string[],
    startTime: number,
    endTime: number
  ) => {
    if (!stats.loaded) return;

    setLoading(true);
    try {
      const guideWindow = await window.electron?.epg?.getGuideWindow(channelIds, startTime, endTime);
      setGuideWindow(guideWindow);
    } catch (err) {
      console.error('Failed to load guide window:', err);
      setError(err instanceof Error ? err.message : 'Failed to load guide window');
    } finally {
      setLoading(false);
    }
  }, [stats.loaded]);

  // Clear all EPG data
  const clearEpg = useCallback(async () => {
    try {
      await window.electron?.epg?.clear();
      setNowNext(new Map());
      setGuideWindow(null);
      setChannels([]);
      setStats({
        loaded: false,
        channelCount: 0,
        programCount: 0
      });
    } catch (err) {
      console.error('Failed to clear EPG:', err);
    }
  }, []);

  // Auto-refresh now/next data
  // Use ref to avoid recreating interval every time nowNext state changes
  const nowNextRef = useRef(nowNext);
  nowNextRef.current = nowNext;

  useEffect(() => {
    if (!stats.loaded || autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      const channelIds = Array.from(nowNextRef.current.keys());
      if (channelIds.length > 0) {
        refreshNowNext(channelIds);
      }
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [stats.loaded, autoRefreshInterval, refreshNowNext]);

  return {
    nowNext,
    guideWindow,
    channels,
    stats,
    loading,
    error,
    loadXmltvFile,
    refreshNowNext,
    loadGuideWindow,
    clearEpg
  };
}

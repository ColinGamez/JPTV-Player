/**
 * Watch History & Analytics
 * Tracks viewing habits and provides analytics
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

export interface WatchSession {
  channelId: string;
  channelName: string;
  startTime: number; // timestamp
  duration: number;  // ms
}

export interface WatchStats {
  totalWatchTimeMs: number;
  totalSessions: number;
  favoriteChannel: { name: string; timeMs: number } | null;
  averageSessionMs: number;
  channelBreakdown: Array<{
    channelId: string;
    channelName: string;
    totalTimeMs: number;
    sessionCount: number;
    lastWatched: number;
  }>;
  dailyUsage: Array<{
    date: string; // YYYY-MM-DD
    totalTimeMs: number;
    sessionCount: number;
  }>;
  peakHour: number; // 0-23
}

const STORAGE_KEY = 'watchHistory';
const MAX_SESSIONS = 500;

function loadHistory(): WatchSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SESSIONS) : [];
  } catch {
    return [];
  }
}

function saveHistory(sessions: WatchSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch { /* storage full */ }
}

export function useWatchAnalytics() {
  const [sessions, setSessions] = useState<WatchSession[]>(loadHistory);
  const [currentSession, setCurrentSession] = useState<{
    channelId: string;
    channelName: string;
    startTime: number;
  } | null>(null);
  // Ref to avoid stale closure in startWatching/stopWatching
  const currentSessionRef = useRef(currentSession);
  currentSessionRef.current = currentSession;

  // Save sessions whenever they change
  useEffect(() => {
    saveHistory(sessions);
  }, [sessions]);

  const startWatching = useCallback((channelId: string, channelName: string) => {
    // End any previous session first (read from ref to avoid stale closure)
    const prev = currentSessionRef.current;
    if (prev) {
      const duration = Date.now() - prev.startTime;
      if (duration > 5000) { // Only record if watched > 5 seconds
        setSessions(s => [{
          channelId: prev.channelId,
          channelName: prev.channelName,
          startTime: prev.startTime,
          duration,
        }, ...s].slice(0, MAX_SESSIONS));
      }
    }

    setCurrentSession({
      channelId,
      channelName,
      startTime: Date.now(),
    });
  }, []);

  const stopWatching = useCallback(() => {
    const prev = currentSessionRef.current;
    if (prev) {
      const duration = Date.now() - prev.startTime;
      if (duration > 5000) {
        setSessions(s => [{
          channelId: prev.channelId,
          channelName: prev.channelName,
          startTime: prev.startTime,
          duration,
        }, ...s].slice(0, MAX_SESSIONS));
      }
      setCurrentSession(null);
    }
  }, []);

  const stats = useMemo((): WatchStats => {
    const allSessions = [...sessions];

    // Total watch time
    const totalWatchTimeMs = allSessions.reduce((acc, s) => acc + s.duration, 0);
    const totalSessions = allSessions.length;
    const averageSessionMs = totalSessions > 0 ? totalWatchTimeMs / totalSessions : 0;

    // Channel breakdown
    const channelMap = new Map<string, {
      channelName: string;
      totalTimeMs: number;
      sessionCount: number;
      lastWatched: number;
    }>();

    for (const session of allSessions) {
      const existing = channelMap.get(session.channelId);
      if (existing) {
        existing.totalTimeMs += session.duration;
        existing.sessionCount += 1;
        existing.lastWatched = Math.max(existing.lastWatched, session.startTime);
      } else {
        channelMap.set(session.channelId, {
          channelName: session.channelName,
          totalTimeMs: session.duration,
          sessionCount: 1,
          lastWatched: session.startTime,
        });
      }
    }

    const channelBreakdown = Array.from(channelMap.entries())
      .map(([channelId, data]) => ({ channelId, ...data }))
      .sort((a, b) => b.totalTimeMs - a.totalTimeMs);

    // Favorite channel
    const favoriteChannel = channelBreakdown.length > 0
      ? { name: channelBreakdown[0].channelName, timeMs: channelBreakdown[0].totalTimeMs }
      : null;

    // Daily usage (last 7 days)
    const dailyMap = new Map<string, { totalTimeMs: number; sessionCount: number }>();
    for (const session of allSessions) {
      const date = new Date(session.startTime).toISOString().split('T')[0];
      const existing = dailyMap.get(date);
      if (existing) {
        existing.totalTimeMs += session.duration;
        existing.sessionCount += 1;
      } else {
        dailyMap.set(date, { totalTimeMs: session.duration, sessionCount: 1 });
      }
    }

    const dailyUsage = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);

    // Peak hour
    const hourCounts = new Array(24).fill(0);
    for (const session of allSessions) {
      const hour = new Date(session.startTime).getHours();
      hourCounts[hour] += session.duration;
    }
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      totalWatchTimeMs,
      totalSessions,
      favoriteChannel,
      averageSessionMs,
      channelBreakdown: channelBreakdown.slice(0, 10),
      dailyUsage,
      peakHour,
    };
  }, [sessions]);

  const formatDuration = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  const clearHistory = useCallback(() => {
    setSessions([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  return {
    sessions,
    currentSession,
    stats,
    startWatching,
    stopWatching,
    formatDuration,
    clearHistory,
  };
}

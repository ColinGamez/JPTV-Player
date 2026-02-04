/**
 * Stream Health Hook
 * 
 * Provides access to stream health scores in the renderer process.
 * Only displays in development mode.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ChannelHealth } from '../types/electron';

export interface UseStreamHealthReturn {
  healthScores: Map<string, ChannelHealth>;
  getHealthForChannel: (channelId: string) => ChannelHealth | null;
  refreshScores: () => Promise<void>;
  clearHealth: (channelId?: string) => Promise<void>;
  isDevMode: boolean;
}

const isDev = import.meta.env.DEV;

/**
 * Hook for accessing stream health scores
 */
export function useStreamHealth(): UseStreamHealthReturn {
  const [healthScores, setHealthScores] = useState<Map<string, ChannelHealth>>(new Map());

  /**
   * Refresh all health scores from main process
   */
  const refreshScores = useCallback(async () => {
    if (!window.electronAPI?.health) {
      return;
    }

    try {
      const scores = await window.electronAPI.health.getAllScores();
      const scoreMap = new Map<string, ChannelHealth>();
      
      scores.forEach(health => {
        scoreMap.set(health.channelId, health);
      });
      
      setHealthScores(scoreMap);
    } catch (error) {
      console.error('[StreamHealth] Failed to refresh scores:', error);
    }
  }, []);

  /**
   * Get health score for a specific channel
   */
  const getHealthForChannel = useCallback((channelId: string): ChannelHealth | null => {
    return healthScores.get(channelId) || null;
  }, [healthScores]);

  /**
   * Clear health data
   */
  const clearHealth = useCallback(async (channelId?: string) => {
    if (!window.electronAPI?.health) {
      return;
    }

    try {
      await window.electronAPI.health.clear(channelId);
      
      if (channelId) {
        setHealthScores(prev => {
          const next = new Map(prev);
          next.delete(channelId);
          return next;
        });
      } else {
        setHealthScores(new Map());
      }
    } catch (error) {
      console.error('[StreamHealth] Failed to clear health:', error);
    }
  }, []);

  // Auto-refresh scores periodically (only in dev mode)
  useEffect(() => {
    if (!isDev) {
      return;
    }

    refreshScores();

    // Refresh every 5 seconds
    const interval = setInterval(refreshScores, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshScores]);

  return {
    healthScores,
    getHealthForChannel,
    refreshScores,
    clearHealth,
    isDevMode: isDev
  };
}

/**
 * Format health score as stars (1-5)
 */
export function formatHealthStars(score: number): string {
  if (score >= 90) return '⭐⭐⭐⭐⭐';
  if (score >= 75) return '⭐⭐⭐⭐';
  if (score >= 60) return '⭐⭐⭐';
  if (score >= 40) return '⭐⭐';
  return '⭐';
}

/**
 * Get health color class
 */
export function getHealthColor(score: number): string {
  if (score >= 80) return '#22c55e'; // Green (keep vibrant)
  if (score >= 60) return '#f59e0b'; // Amber
  if (score >= 40) return '#f97316'; // Orange
  return '#d14848'; // Wii red
}

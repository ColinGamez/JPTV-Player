/**
 * Sleep Timer
 * Auto-stop playback after a set duration
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface SleepTimerState {
  isActive: boolean;
  remainingMs: number;
  totalMs: number;
  presetMinutes: number;
}

const PRESETS = [15, 30, 45, 60, 90, 120]; // minutes

export function useSleepTimer(onTimerEnd?: () => void) {
  const [isActive, setIsActive] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [presetMinutes, setPresetMinutes] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);
  // Store callback in ref to avoid interval teardown when caller doesn't memoize
  const onTimerEndRef = useRef(onTimerEnd);
  onTimerEndRef.current = onTimerEnd;

  // Tick countdown
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, endTimeRef.current - Date.now());
      setRemainingMs(remaining);

      if (remaining <= 0) {
        setIsActive(false);
        setRemainingMs(0);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onTimerEndRef.current?.();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  const startTimer = useCallback((minutes: number) => {
    if (minutes <= 0 || !Number.isFinite(minutes)) return;
    const ms = Math.min(minutes * 60 * 1000, 24 * 60 * 60 * 1000); // Cap at 24h
    endTimeRef.current = Date.now() + ms;
    setTotalMs(ms);
    setRemainingMs(ms);
    setPresetMinutes(minutes);
    setIsActive(true);
  }, []);

  const cancelTimer = useCallback(() => {
    setIsActive(false);
    setRemainingMs(0);
    setTotalMs(0);
    setPresetMinutes(0);
  }, []);

  const extendTimer = useCallback((extraMinutes: number) => {
    if (isActive) {
      const extraMs = extraMinutes * 60 * 1000;
      endTimeRef.current += extraMs;
      setTotalMs(prev => prev + extraMs);
      setRemainingMs(Math.max(0, endTimeRef.current - Date.now()));
    }
  }, [isActive]);

  const formatRemaining = useCallback(() => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [remainingMs]);

  const getProgress = useCallback(() => {
    if (totalMs === 0) return 0;
    return (remainingMs / totalMs) * 100;
  }, [remainingMs, totalMs]);

  return {
    isActive,
    remainingMs,
    totalMs,
    presetMinutes,
    presets: PRESETS,
    startTimer,
    cancelTimer,
    extendTimer,
    formatRemaining,
    getProgress,
  };
}

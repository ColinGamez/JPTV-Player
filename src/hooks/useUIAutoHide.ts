import { useState, useEffect, useCallback, useRef } from 'react';

interface UseUIAutoHideOptions {
  hideDelay?: number;      // Time in ms before hiding (default 5000)
  enabled?: boolean;       // Enable auto-hide (default true)
}

interface UseUIAutoHideReturn {
  isUIVisible: boolean;
  showUI: () => void;
  hideUI: () => void;
  resetTimer: () => void;
}

/**
 * Hook for TV-style UI auto-hide behavior
 * - UI shows on keyboard input (not mouse movement)
 * - UI auto-hides after inactivity
 * - Mouse movement does NOT wake UI (TV box behavior)
 * 
 * IMPORTANT: This hook does NOT attach keyboard listeners.
 * The parent component (App.tsx) must call showUI() and resetTimer()
 * from its centralized keyboard handler.
 */
export function useUIAutoHide(options: UseUIAutoHideOptions = {}): UseUIAutoHideReturn {
  const { hideDelay = 5000, enabled = true } = options;
  
  const [isUIVisible, setIsUIVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isUIVisibleRef = useRef(isUIVisible);

  // Keep ref in sync with state
  useEffect(() => {
    isUIVisibleRef.current = isUIVisible;
  }, [isUIVisible]);

  // Stable function refs (don't change between renders)
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const startHideTimer = useCallback(() => {
    if (!enabled) return;
    
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setIsUIVisible(false);
    }, hideDelay);
  }, [enabled, hideDelay, clearHideTimer]);

  const showUI = useCallback(() => {
    setIsUIVisible(true);
    lastActivityRef.current = Date.now();
    startHideTimer();
  }, [startHideTimer]);

  const hideUI = useCallback(() => {
    setIsUIVisible(false);
    clearHideTimer();
  }, [clearHideTimer]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    if (isUIVisibleRef.current) {
      lastActivityRef.current = Date.now();
      startHideTimer();
    }
  }, [enabled, startHideTimer]);

  // Start initial hide timer
  useEffect(() => {
    if (enabled && isUIVisible) {
      startHideTimer();
    }
    return () => clearHideTimer();
  }, [enabled, isUIVisible, startHideTimer, clearHideTimer]);

  return {
    isUIVisible,
    showUI,
    hideUI,
    resetTimer
  };
}

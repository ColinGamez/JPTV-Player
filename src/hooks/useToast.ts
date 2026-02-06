/**
 * Toast Notifications Hook
 * Non-intrusive notifications for user feedback
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  timestamp: number;
}

const DEFAULT_DURATION = 3000;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Track auto-dismiss timers so they can be cancelled on unmount
  const timerMapRef = useRef(new Map<string, NodeJS.Timeout>());

  // Clear all pending timers on unmount
  useEffect(() => {
    const timers = timerMapRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // Dismiss a specific toast
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    // Clear associated timer
    const timer = timerMapRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerMapRef.current.delete(id);
    }
  }, []);

  // Show a toast notification
  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration: number = DEFAULT_DURATION
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = {
      id,
      type,
      message,
      duration,
      timestamp: Date.now(),
    };

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after duration (tracked for cleanup)
    if (duration > 0) {
      const timer = setTimeout(() => {
        timerMapRef.current.delete(id);
        dismissToast(id);
      }, duration);
      timerMapRef.current.set(id, timer);
    }

    return id;
  }, [dismissToast]);

  // Clear all toasts
  const clearToasts = useCallback(() => {
    timerMapRef.current.forEach(clearTimeout);
    timerMapRef.current.clear();
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((message: string, duration?: number) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  return {
    toasts,
    showToast,
    dismissToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };
}

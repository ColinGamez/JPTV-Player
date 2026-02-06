/**
 * Keyboard Shortcuts Hook
 * Centralized keyboard shortcut management for TV player
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts: KeyboardShortcut[];
}

export function useKeyboardShortcuts({ enabled = true, shortcuts }: UseKeyboardShortcutsOptions) {
  // Use ref to avoid recreating the listener when shortcuts array identity changes
  // (callers typically create new arrays every render via createPlayerShortcuts)
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    for (const shortcut of shortcutsRef.current) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.action();
        break;
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * Common TV player keyboard shortcuts
 */
export const createPlayerShortcuts = (handlers: {
  onPlayPause?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onFullscreen?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onShowInfo?: () => void;
  onShowGuide?: () => void;
  onShowFavorites?: () => void;
  onSearch?: () => void;
  onBack?: () => void;
}): KeyboardShortcut[] => {
  return [
    // Playback control
    {
      key: ' ',
      description: 'Play/Pause',
      action: handlers.onPlayPause || (() => {}),
    },
    {
      key: 'k',
      description: 'Play/Pause (alternate)',
      action: handlers.onPlayPause || (() => {}),
    },

    // Volume control
    {
      key: 'ArrowUp',
      description: 'Volume Up',
      action: handlers.onVolumeUp || (() => {}),
    },
    {
      key: 'ArrowDown',
      description: 'Volume Down',
      action: handlers.onVolumeDown || (() => {}),
    },
    {
      key: 'm',
      description: 'Mute/Unmute',
      action: handlers.onMute || (() => {}),
    },

    // Channel navigation
    {
      key: 'ArrowRight',
      description: 'Next Channel',
      action: handlers.onChannelUp || (() => {}),
    },
    {
      key: 'ArrowLeft',
      description: 'Previous Channel',
      action: handlers.onChannelDown || (() => {}),
    },
    {
      key: 'PageUp',
      description: 'Next Channel (alternate)',
      action: handlers.onChannelUp || (() => {}),
    },
    {
      key: 'PageDown',
      description: 'Previous Channel (alternate)',
      action: handlers.onChannelDown || (() => {}),
    },

    // UI controls
    {
      key: 'f',
      description: 'Toggle Fullscreen',
      action: handlers.onFullscreen || (() => {}),
    },
    {
      key: 'F11',
      description: 'Toggle Fullscreen (alternate)',
      action: handlers.onFullscreen || (() => {}),
    },
    {
      key: 'i',
      description: 'Show Channel Info',
      action: handlers.onShowInfo || (() => {}),
    },
    {
      key: 'g',
      description: 'Show Guide/EPG',
      action: handlers.onShowGuide || (() => {}),
    },
    {
      key: 'h',
      description: 'Show Favorites',
      action: handlers.onShowFavorites || (() => {}),
    },
    {
      key: 'f',
      ctrl: true,
      description: 'Search Channels',
      action: handlers.onSearch || (() => {}),
    },
    {
      key: 'Escape',
      description: 'Back/Close',
      action: handlers.onBack || (() => {}),
    },
  ];
};

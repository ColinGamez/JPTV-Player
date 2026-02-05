/**
 * Keyboard Shortcuts Help Modal
 * Shows all available keyboard shortcuts to the user
 */

import React from 'react';
import './KeyboardShortcutsHelp.css';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  // Playback
  { keys: ['Space', 'K'], description: 'Play/Pause', category: 'Playback' },
  { keys: ['M'], description: 'Mute/Unmute', category: 'Playback' },
  
  // Volume
  { keys: ['↑'], description: 'Volume Up', category: 'Volume' },
  { keys: ['↓'], description: 'Volume Down', category: 'Volume' },
  
  // Channel Navigation
  { keys: ['→', 'Page Up'], description: 'Next Channel', category: 'Navigation' },
  { keys: ['←', 'Page Down'], description: 'Previous Channel', category: 'Navigation' },
  { keys: ['0-9'], description: 'Direct Channel Number', category: 'Navigation' },
  
  // UI Controls
  { keys: ['F', 'F11'], description: 'Fullscreen', category: 'UI' },
  { keys: ['Ctrl+F', 'Cmd+F'], description: 'Search Channels', category: 'UI' },
  { keys: ['I'], description: 'Channel Info', category: 'UI' },
  { keys: ['G'], description: 'TV Guide/EPG', category: 'UI' },
  { keys: ['H'], description: 'Favorites', category: 'UI' },
  { keys: ['?'], description: 'Show This Help', category: 'UI' },
  { keys: ['Esc'], description: 'Back/Close', category: 'UI' },
];

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <button className="shortcuts-close-btn" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className="shortcuts-content">
          {categories.map(category => (
            <div key={category} className="shortcuts-category">
              <h3 className="category-title">{category}</h3>
              <div className="shortcuts-list">
                {shortcuts
                  .filter(s => s.category === category)
                  .map((shortcut, index) => (
                    <div key={index} className="shortcut-row">
                      <div className="shortcut-keys">
                        {shortcut.keys.map((key, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="key-separator">or</span>}
                            <kbd className="shortcut-key">{key}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="shortcut-desc">{shortcut.description}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <p>Press <kbd>?</kbd> anytime to show this help</p>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import styles from './ParentalLockSettings.module.css';

interface ParentalLockSettingsProps {
  onClose: () => void;
  channels: Array<{ id: string; name: string; category?: string }>;
}

export const ParentalLockSettings: React.FC<ParentalLockSettingsProps> = ({
  onClose,
  channels
}) => {
  const { activeSession, updateProfileData } = useProfile();
  
  const [enabled, setEnabled] = useState(
    activeSession?.data.parentalLockEnabled ?? false
  );
  const [lockedCategories, setLockedCategories] = useState<string[]>(
    activeSession?.data.lockedCategories ?? []
  );
  const [lockedChannels, setLockedChannels] = useState<string[]>(
    activeSession?.data.lockedChannels ?? []
  );
  const [unlockDuration, setUnlockDuration] = useState(
    activeSession?.data.unlockDurationMinutes ?? 10
  );
  const [channelSearch, setChannelSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Get unique categories
  const categories = Array.from(
    new Set(channels.map(ch => ch.category).filter(Boolean))
  ).sort() as string[];

  const toggleCategory = (category: string) => {
    setLockedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleChannel = (channelId: string) => {
    setLockedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    );
  };

  const filteredChannels = channels.filter(ch =>
    ch.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!activeSession) return;

    setIsSaving(true);
    try {
      await updateProfileData({
        parentalLockEnabled: enabled,
        lockedCategories,
        lockedChannels,
        unlockDurationMinutes: unlockDuration
      });
      onClose();
    } catch (error) {
      console.error('Error saving parental lock settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!activeSession) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>🔒 Parental Lock Settings</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close parental lock settings">
            ×
          </button>
        </div>

        <div className={styles.content}>
          {/* Enable/Disable Toggle */}
          <div className={styles.section}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className={styles.toggleSlider}></span>
              <span className={styles.toggleLabel}>Enable Parental Lock</span>
            </label>
          </div>

          {enabled && (
            <>
              {/* Unlock Duration */}
              <div className={styles.section}>
                <label className={styles.label}>
                  Unlock Duration: {unlockDuration} minutes
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={unlockDuration}
                  onChange={(e) => setUnlockDuration(Number(e.target.value))}
                  className={styles.slider}
                />
              </div>

              {/* Locked Categories */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Locked Categories</h3>
                <div className={styles.list}>
                  {categories.map(category => (
                    <label key={category} className={styles.listItem}>
                      <input
                        type="checkbox"
                        checked={lockedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                  {categories.length === 0 && (
                    <p className={styles.emptyMessage}>No categories available</p>
                  )}
                </div>
              </div>

              {/* Locked Channels */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Locked Channels</h3>
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  className={styles.searchInput}
                />
                <div className={styles.list}>
                  {filteredChannels.map(channel => (
                    <label key={channel.id} className={styles.listItem}>
                      <input
                        type="checkbox"
                        checked={lockedChannels.includes(channel.id)}
                        onChange={() => toggleChannel(channel.id)}
                      />
                      <span>{channel.name}</span>
                      {channel.category && (
                        <span className={styles.category}>{channel.category}</span>
                      )}
                    </label>
                  ))}
                  {filteredChannels.length === 0 && (
                    <p className={styles.emptyMessage}>
                      {channelSearch ? 'No matching channels' : 'No channels available'}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <p className={styles.hint}>
          Press <kbd>Ctrl+Shift+P</kbd> or <kbd>ESC</kbd> to close
        </p>
      </div>
    </div>
  );
};

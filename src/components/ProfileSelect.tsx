import React, { useState, useEffect, useCallback } from 'react';
import type { Profile } from '../types/profile';
import styles from './ProfileSelect.module.css';

interface ProfileSelectProps {
  profiles: Profile[];
  lastActiveProfileId: string | null;
  onSelectProfile: (profile: Profile) => void;
  onCreate: () => void;
  onDelete: (profileId: string) => void;
}

const AVATAR_OPTIONS = ['👤', '👨', '👩', '👶', '🧑', '👴', '👵', '🎮', '🎬', '🎵'];

export const ProfileSelect: React.FC<ProfileSelectProps> = ({
  profiles,
  lastActiveProfileId,
  onSelectProfile,
  onCreate,
  onDelete
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Auto-select last active profile
  useEffect(() => {
    if (lastActiveProfileId && profiles.length > 0) {
      const index = profiles.findIndex(p => p.id === lastActiveProfileId);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    }
  }, [lastActiveProfileId, profiles]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showDeleteConfirm) {
        // Delete confirmation mode
        if (e.key === 'y' || e.key === 'Y') {
          const profile = profiles[selectedIndex];
          if (profile) {
            onDelete(profile.id);
          }
          setShowDeleteConfirm(false);
        } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
          setShowDeleteConfirm(false);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(profiles.length, prev + 1)); // +1 for "Create New" option
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex < profiles.length) {
            // Select profile
            onSelectProfile(profiles[selectedIndex]);
          } else {
            // Create new profile
            onCreate();
          }
          break;
        case 'Delete':
        case 'd':
        case 'D':
          e.preventDefault();
          if (selectedIndex < profiles.length && profiles.length > 1) {
            setShowDeleteConfirm(true);
          }
          break;
        default:
          return; // Don't block unhandled keys
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, profiles, showDeleteConfirm, onSelectProfile, onCreate, onDelete]);

  const getAvatar = (profile: Profile): string => {
    return profile.avatar || AVATAR_OPTIONS[0];
  };

  const formatLastLogin = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Who's Watching?</h1>
        <p className={styles.subtitle}>Select your profile</p>
      </div>

      <div className={styles.profileGrid}>
        {profiles.map((profile, index) => (
          <div
            key={profile.id}
            className={`${styles.profileCard} ${selectedIndex === index ? styles.selected : ''}`}
            onClick={() => onSelectProfile(profile)}
            onMouseEnter={() => setSelectedIndex(index)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.avatarContainer}>
              <div className={styles.avatar}>
                {getAvatar(profile)}
              </div>
              {profile.hasPin && (
                <div className={styles.pinBadge}>🔒</div>
              )}
            </div>
            <div className={styles.profileName}>{profile.name}</div>
            <div className={styles.lastLogin}>
              {formatLastLogin(profile.lastLogin)}
            </div>
          </div>
        ))}

        {/* Create New Profile Option */}
        <div
          className={`${styles.profileCard} ${styles.createCard} ${selectedIndex === profiles.length ? styles.selected : ''}`}
          onClick={() => onCreate()}
          onMouseEnter={() => setSelectedIndex(profiles.length)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.avatarContainer}>
            <div className={`${styles.avatar} ${styles.createAvatar}`}>
              ➕
            </div>
          </div>
          <div className={styles.profileName}>Create Profile</div>
          <div className={styles.lastLogin}>New user</div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.hint}>
          <span className={styles.key}>↑↓</span> Navigate
          <span className={styles.key}>Enter</span> Select
          {profiles.length > 1 && <><span className={styles.key}>D</span> Delete</>}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedIndex < profiles.length && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Delete Profile?</h2>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{profiles[selectedIndex].name}</strong>?
            </p>
            <p className={styles.modalText}>
              All favorites, settings, and watch history will be lost.
            </p>
            <div className={styles.modalButtons}>
              <span className={styles.key}>Y</span> Yes, Delete
              <span className={styles.key}>N</span> Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

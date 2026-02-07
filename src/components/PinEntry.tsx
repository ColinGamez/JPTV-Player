import React, { useState, useEffect, useCallback } from 'react';
import type { Profile } from '../types/profile';
import styles from './PinEntry.module.css';

interface PinEntryProps {
  profile: Profile;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  error?: string | null;
}

const PIN_LENGTH = 6; // Support up to 6 digits

export const PinEntry: React.FC<PinEntryProps> = ({
  profile,
  onSubmit,
  onCancel,
  error
}) => {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // Show shake animation on error
  useEffect(() => {
    if (error) {
      setShake(true);
      setPin(''); // Clear PIN on error
      setTimeout(() => setShake(false), 500);
    }
  }, [error]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      // Numeric input
      if (/^[0-9]$/.test(e.key) && pin.length < PIN_LENGTH) {
        const newPin = pin + e.key;
        setPin(newPin);
        
        // Auto-submit only when reaching max PIN length
        if (newPin.length === PIN_LENGTH) {
          // Small delay for visual feedback
          setTimeout(() => onSubmit(newPin), 200);
        }
      }
      // Backspace
      else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      }
      // Enter - submit if min length met
      else if (e.key === 'Enter' && pin.length >= 4) {
        onSubmit(pin);
      }
      // Escape - cancel
      else if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, onSubmit, onCancel]);

  const getAvatar = (): string => {
    return profile.avatar || '👤';
  };

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${shake ? styles.shake : ''}`}>
        {/* Profile Info */}
        <div className={styles.profileInfo}>
          <div className={styles.avatar}>
            {getAvatar()}
          </div>
          <h2 className={styles.profileName}>{profile.name}</h2>
        </div>

        {/* PIN Input */}
        <div className={styles.pinContainer}>
          <p className={styles.label}>Enter PIN</p>
          
          <div className={styles.pinDots}>
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <div
                key={index}
                className={`${styles.dot} ${index < pin.length ? styles.filled : ''}`}
              >
                {index < pin.length ? '●' : '○'}
              </div>
            ))}
          </div>

          {error && (
            <div className={styles.error}>
              ⚠ {error}
            </div>
          )}

          <div className={styles.hint}>
            PIN must be 4-6 digits
          </div>
        </div>

        {/* Keyboard Hints */}
        <div className={styles.footer}>
          <div className={styles.keys}>
            <span className={styles.key}>0-9</span> Enter PIN
            <span className={styles.key}>Backspace</span> Delete
            <span className={styles.key}>Esc</span> Cancel
          </div>
        </div>
      </div>
    </div>
  );
};

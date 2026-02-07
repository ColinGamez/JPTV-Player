import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ParentalLockOverlay.module.css';

interface ParentalLockOverlayProps {
  onUnlock: (pin: string) => Promise<boolean>;
  onCancel: () => void;
  title?: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000; // 30 seconds
const MAX_LOCKOUT_MS = 300_000; // 5 minutes
const ERROR_DISPLAY_MS = 500;

export const ParentalLockOverlay: React.FC<ParentalLockOverlayProps> = ({
  onUnlock,
  onCancel,
  title = 'Content Locked'
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const isVerifyingRef = useRef(false);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup error timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Clear lockout when timer expires
  useEffect(() => {
    if (!lockedUntil) return;
    const remaining = lockedUntil - Date.now();
    if (remaining <= 0) { setLockedUntil(null); return; }
    const timer = setTimeout(() => setLockedUntil(null), remaining);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4 || isVerifyingRef.current) return;
    if (lockedUntil && Date.now() < lockedUntil) return;

    isVerifyingRef.current = true;
    setIsVerifying(true);
    setError(false);

    const success = await onUnlock(pin);

    if (!success) {
      setError(true);
      setPin('');
      setFailedAttempts(prev => {
        const next = prev + 1;
        if (next >= MAX_FAILED_ATTEMPTS) {
          const lockMs = Math.min(
            BASE_LOCKOUT_MS * Math.pow(2, next - MAX_FAILED_ATTEMPTS),
            MAX_LOCKOUT_MS
          );
          setLockedUntil(Date.now() + lockMs);
        }
        return next;
      });
      // Shake animation will be triggered by error class
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(false), ERROR_DISPLAY_MS);
    } else {
      setFailedAttempts(0);
      setLockedUntil(null);
    }

    isVerifyingRef.current = false;
    setIsVerifying(false);
  }, [pin, onUnlock, lockedUntil]);

  const handleKeyPress = useCallback((key: string) => {
    if (isVerifyingRef.current) return;
    if (lockedUntil && Date.now() < lockedUntil) return;

    if (key === 'backspace') {
      setPin(prev => prev.slice(0, -1));
    } else if (key >= '0' && key <= '9' && pin.length < 6) {
      setPin(prev => prev + key);
    }
  }, [pin.length, lockedUntil]);

  // PIN submission is handled by the Enter key in the keydown handler below.
  // Auto-submit was removed because it fires at 4, 5, AND 6 digits —
  // causing false rejections (and lockout attempts) for PINs longer than 4 digits.

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('backspace');
      } else if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Enter' && pin.length >= 4) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin.length, handleKeyPress, handleSubmit, onCancel]);

  const inputDisabled = isVerifying || !!lockedUntil;

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${error ? styles.shake : ''}`}>
        <div className={styles.icon}>🔒</div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>Enter PIN to unlock</p>

        <div className={styles.pinDisplay}>
          {[0, 1, 2, 3, 4, 5].map(index => (
            <div key={index} className={styles.pinDot}>
              {pin.length > index ? '●' : '○'}
            </div>
          ))}
        </div>

        {error && !lockedUntil && <p className={styles.error}>Incorrect PIN. Please try again.</p>}
        {!!lockedUntil && (
          <p className={styles.error}>Too many failed attempts. Please wait before trying again.</p>
        )}

        <div className={styles.numpad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              className={styles.numButton}
              onClick={() => handleKeyPress(num.toString())}
              disabled={inputDisabled}
            >
              {num}
            </button>
          ))}
          <button
            className={styles.numButton}
            onClick={onCancel}
            disabled={isVerifying}
          >
            Cancel
          </button>
          <button
            className={styles.numButton}
            onClick={() => handleKeyPress('0')}
            disabled={inputDisabled}
          >
            0
          </button>
          <button
            className={styles.numButton}
            onClick={() => handleKeyPress('backspace')}
            disabled={inputDisabled}
          >
            ⌫
          </button>
        </div>

        <p className={styles.hint}>Press ESC to cancel</p>
      </div>
    </div>
  );
};

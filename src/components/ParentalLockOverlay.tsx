import React, { useState, useEffect } from 'react';
import styles from './ParentalLockOverlay.module.css';

interface ParentalLockOverlayProps {
  onUnlock: (pin: string) => Promise<boolean>;
  onCancel: () => void;
  title?: string;
}

export const ParentalLockOverlay: React.FC<ParentalLockOverlayProps> = ({
  onUnlock,
  onCancel,
  title = 'Content Locked'
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Auto-submit when PIN reaches 4-6 digits
  useEffect(() => {
    if (pin.length >= 4 && pin.length <= 6 && !isVerifying) {
      handleSubmit();
    }
  }, [pin]);

  const handleSubmit = async () => {
    if (pin.length < 4) return;

    setIsVerifying(true);
    setError(false);

    const success = await onUnlock(pin);

    if (!success) {
      setError(true);
      setPin('');
      // Shake animation will be triggered by error class
      setTimeout(() => setError(false), 500);
    }

    setIsVerifying(false);
  };

  const handleKeyPress = (key: string) => {
    if (isVerifying) return;

    if (key === 'backspace') {
      setPin(prev => prev.slice(0, -1));
    } else if (key >= '0' && key <= '9' && pin.length < 6) {
      setPin(prev => prev + key);
    }
  };

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
  }, [pin, isVerifying]);

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

        {error && <p className={styles.error}>Incorrect PIN. Please try again.</p>}

        <div className={styles.numpad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              className={styles.numButton}
              onClick={() => handleKeyPress(num.toString())}
              disabled={isVerifying}
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
            disabled={isVerifying}
          >
            0
          </button>
          <button
            className={styles.numButton}
            onClick={() => handleKeyPress('backspace')}
            disabled={isVerifying}
          >
            ⌫
          </button>
        </div>

        <p className={styles.hint}>Press ESC to cancel</p>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import styles from './CreateProfile.module.css';

interface CreateProfileProps {
  onSubmit: (name: string, pin?: string, avatar?: string) => void;
  onCancel: () => void;
  error?: string | null;
}

const AVATAR_OPTIONS = ['👤', '👨', '👩', '👶', '🧑', '👴', '👵', '🎮', '🎬', '🎵', '🎨', '🎯', '🎪', '🎭'];

enum Step {
  Name = 'name',
  Avatar = 'avatar',
  Pin = 'pin',
}

export const CreateProfile: React.FC<CreateProfileProps> = ({
  onSubmit,
  onCancel,
  error
}) => {
  const [step, setStep] = useState<Step>(Step.Name);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [pin, setPin] = useState('');
  const [usePin, setUsePin] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step === Step.Name) {
        // Text input for name
        if (e.key === 'Escape') {
          onCancel();
        } else if (e.key === 'Enter' && name.trim().length > 0) {
          setStep(Step.Avatar);
        } else if (e.key === 'Backspace' && name.length > 0) {
          setName(prev => prev.slice(0, -1));
        } else if (e.key.length === 1 && name.length < 20) {
          // Alphanumeric and spaces
          if (/^[a-zA-Z0-9 ]$/.test(e.key)) {
            setName(prev => prev + e.key);
          }
        }
      } else if (step === Step.Avatar) {
        e.preventDefault();
        
        if (e.key === 'ArrowLeft') {
          setSelectedAvatar(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowRight') {
          setSelectedAvatar(prev => Math.min(AVATAR_OPTIONS.length - 1, prev + 1));
        } else if (e.key === 'ArrowUp') {
          setSelectedAvatar(prev => Math.max(0, prev - 4));
        } else if (e.key === 'ArrowDown') {
          setSelectedAvatar(prev => Math.min(AVATAR_OPTIONS.length - 1, prev + 4));
        } else if (e.key === 'Enter') {
          setStep(Step.Pin);
        } else if (e.key === 'Escape') {
          setStep(Step.Name);
        }
      } else if (step === Step.Pin) {
        e.preventDefault();

        if (e.key === 'Escape') {
          setStep(Step.Avatar);
        } else if (e.key === 'y' || e.key === 'Y') {
          setUsePin(true);
          setPin('');
        } else if (e.key === 'n' || e.key === 'N') {
          // No PIN - submit
          onSubmit(name, undefined, AVATAR_OPTIONS[selectedAvatar]);
        } else if (usePin) {
          // PIN entry mode
          if (/^[0-9]$/.test(e.key) && pin.length < 6) {
            const newPin = pin + e.key;
            setPin(newPin);
            
            // Auto-submit when reaching 4 digits
            if (newPin.length >= 4) {
              setTimeout(() => {
                onSubmit(name, newPin, AVATAR_OPTIONS[selectedAvatar]);
              }, 200);
            }
          } else if (e.key === 'Backspace') {
            setPin(prev => prev.slice(0, -1));
          } else if (e.key === 'Enter' && pin.length >= 4) {
            onSubmit(name, pin, AVATAR_OPTIONS[selectedAvatar]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, name, selectedAvatar, pin, usePin, onSubmit, onCancel]);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Create New Profile</h2>
        
        {/* Step 1: Name */}
        {step === Step.Name && (
          <div className={styles.step}>
            <p className={styles.label}>Enter profile name</p>
            <div className={styles.nameInput}>
              {name || <span className={styles.placeholder}>Type name...</span>}
              <span className={styles.cursor}>|</span>
            </div>
            <div className={styles.charCount}>{name.length}/20</div>
            {error && <div className={styles.error}>⚠ {error}</div>}
            <div className={styles.hint}>
              <span className={styles.key}>A-Z, 0-9, Space</span> Type
              <span className={styles.key}>Enter</span> Next
              <span className={styles.key}>Esc</span> Cancel
            </div>
          </div>
        )}

        {/* Step 2: Avatar */}
        {step === Step.Avatar && (
          <div className={styles.step}>
            <p className={styles.label}>Choose an avatar</p>
            <div className={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((avatar, index) => (
                <div
                  key={index}
                  className={`${styles.avatarOption} ${selectedAvatar === index ? styles.selected : ''}`}
                >
                  {avatar}
                </div>
              ))}
            </div>
            <div className={styles.hint}>
              <span className={styles.key}>Arrow Keys</span> Select
              <span className={styles.key}>Enter</span> Next
              <span className={styles.key}>Esc</span> Back
            </div>
          </div>
        )}

        {/* Step 3: PIN */}
        {step === Step.Pin && !usePin && (
          <div className={styles.step}>
            <p className={styles.label}>Add a PIN for security?</p>
            <div className={styles.pinQuestion}>
              <div className={styles.questionText}>
                A 4-6 digit PIN will protect this profile from unauthorized access.
              </div>
            </div>
            <div className={styles.hint}>
              <span className={styles.key}>Y</span> Yes, Set PIN
              <span className={styles.key}>N</span> No PIN
              <span className={styles.key}>Esc</span> Back
            </div>
          </div>
        )}

        {/* Step 3b: PIN Entry */}
        {step === Step.Pin && usePin && (
          <div className={styles.step}>
            <p className={styles.label}>Enter a 4-6 digit PIN</p>
            <div className={styles.pinDots}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={`${styles.dot} ${index < pin.length ? styles.filled : ''}`}
                >
                  {index < pin.length ? '●' : '○'}
                </div>
              ))}
            </div>
            {error && <div className={styles.error}>⚠ {error}</div>}
            <div className={styles.hint}>
              <span className={styles.key}>0-9</span> Enter PIN
              <span className={styles.key}>Backspace</span> Delete
              <span className={styles.key}>Esc</span> Back
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className={styles.progress}>
          <div className={`${styles.progressDot} ${step === Step.Name ? styles.active : styles.complete}`} />
          <div className={`${styles.progressDot} ${step === Step.Avatar ? styles.active : step === Step.Pin ? styles.complete : ''}`} />
          <div className={`${styles.progressDot} ${step === Step.Pin ? styles.active : ''}`} />
        </div>
      </div>
    </div>
  );
};

import { useState, useCallback, useEffect } from 'react';
import { useProfile } from '../contexts/ProfileContext';

interface ParentalLockState {
  unlockedUntil: number | null; // Timestamp
  isUnlocked: boolean;
}

interface ParentalLockHook {
  isLocked: (type: 'category' | 'channel', id: string) => boolean;
  requestUnlock: (pin: string) => Promise<boolean>;
  resetLock: () => void;
  isUnlocked: boolean;
  isParentalLockEnabled: boolean;
}

export function useParentalLock(): ParentalLockHook {
  const { activeSession } = useProfile();
  const [lockState, setLockState] = useState<ParentalLockState>({
    unlockedUntil: null,
    isUnlocked: false
  });

  // Check if unlock timeout has expired — uses a single setTimeout instead of polling
  useEffect(() => {
    if (!lockState.unlockedUntil) return;

    const remaining = lockState.unlockedUntil - Date.now();
    if (remaining <= 0) {
      // Already expired
      setLockState({ unlockedUntil: null, isUnlocked: false });
      return;
    }

    const timer = setTimeout(() => {
      setLockState({ unlockedUntil: null, isUnlocked: false });
    }, remaining);

    return () => clearTimeout(timer);
  }, [lockState.unlockedUntil]);

  // Reset lock when profile changes
  useEffect(() => {
    setLockState({ unlockedUntil: null, isUnlocked: false });
  }, [activeSession?.profile.id]);

  const isParentalLockEnabled = Boolean(
    activeSession?.data.parentalLockEnabled
  );

  const isLocked = useCallback((type: 'category' | 'channel', id: string): boolean => {
    if (!activeSession || !isParentalLockEnabled) {
      return false;
    }

    // If recently unlocked, allow access
    if (lockState.isUnlocked && lockState.unlockedUntil && Date.now() < lockState.unlockedUntil) {
      return false;
    }

    // Check if the specific item is locked
    if (type === 'category') {
      return activeSession.data.lockedCategories?.includes(id) ?? false;
    } else {
      return activeSession.data.lockedChannels?.includes(id) ?? false;
    }
  }, [activeSession, isParentalLockEnabled, lockState]);

  const requestUnlock = useCallback(async (pin: string): Promise<boolean> => {
    if (!activeSession) {
      return false;
    }

    try {
      const isValid = await window.electronAPI.profile.verifyPin(
        activeSession.profile.id,
        pin
      );

      if (isValid) {
        const unlockDuration = activeSession.data.unlockDurationMinutes ?? 10;
        const unlockedUntil = Date.now() + (unlockDuration * 60 * 1000);
        
        setLockState({
          unlockedUntil,
          isUnlocked: true
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error verifying parental lock PIN:', error);
      return false;
    }
  }, [activeSession]);

  const resetLock = useCallback(() => {
    setLockState({ unlockedUntil: null, isUnlocked: false });
  }, []);

  return {
    isLocked,
    requestUnlock,
    resetLock,
    isUnlocked: lockState.isUnlocked && Boolean(lockState.unlockedUntil && Date.now() < lockState.unlockedUntil),
    isParentalLockEnabled
  };
}

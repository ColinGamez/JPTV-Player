/**
 * Mini Player Hook
 * Enables picture-in-picture mode for watching while working
 */

import { useState, useCallback, useEffect } from 'react';

interface UseMiniPlayerOptions {
  videoElement?: HTMLVideoElement | null;
}

export function useMiniPlayer({ videoElement }: UseMiniPlayerOptions = {}) {
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Check if PiP is supported
  useEffect(() => {
    const supported = 
      document.pictureInPictureEnabled && 
      videoElement !== null &&
      videoElement !== undefined;
    setIsSupported(supported);
  }, [videoElement]);

  // Enter mini player mode (Picture-in-Picture)
  const enterMiniMode = useCallback(async () => {
    if (!videoElement || !isSupported) {
      console.warn('Picture-in-Picture not supported');
      return false;
    }

    try {
      await videoElement.requestPictureInPicture();
      setIsMiniMode(true);
      return true;
    } catch (error) {
      console.error('Failed to enter PiP mode:', error);
      return false;
    }
  }, [videoElement, isSupported]);

  // Exit mini player mode
  const exitMiniMode = useCallback(async () => {
    if (!document.pictureInPictureElement) {
      return false;
    }

    try {
      await document.exitPictureInPicture();
      setIsMiniMode(false);
      return true;
    } catch (error) {
      console.error('Failed to exit PiP mode:', error);
      return false;
    }
  }, []);

  // Toggle mini player mode
  const toggleMiniMode = useCallback(async () => {
    if (isMiniMode) {
      return await exitMiniMode();
    } else {
      return await enterMiniMode();
    }
  }, [isMiniMode, enterMiniMode, exitMiniMode]);

  // Listen for PiP events
  useEffect(() => {
    if (!videoElement) return;

    const handleEnterPiP = () => setIsMiniMode(true);
    const handleLeavePiP = () => setIsMiniMode(false);

    videoElement.addEventListener('enterpictureinpicture', handleEnterPiP);
    videoElement.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      videoElement.removeEventListener('enterpictureinpicture', handleEnterPiP);
      videoElement.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, [videoElement]);

  return {
    isMiniMode,
    isSupported,
    enterMiniMode,
    exitMiniMode,
    toggleMiniMode,
  };
}

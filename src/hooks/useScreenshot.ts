/**
 * Screenshot Capture
 * Captures frames from the video player
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface Screenshot {
  id: string;
  channelName: string;
  timestamp: Date;
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_SCREENSHOTS = 20;

export function useScreenshot() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [lastScreenshot, setLastScreenshot] = useState<Screenshot | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup flash timer on unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const captureScreenshot = useCallback(async (
    videoElement: HTMLVideoElement | null,
    channelName: string = 'Unknown'
  ): Promise<Screenshot | null> => {
    if (!videoElement) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || videoElement.clientWidth;
      canvas.height = videoElement.videoHeight || videoElement.clientHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Use JPEG at 0.8 quality instead of PNG to reduce memory footprint
      // PNG data URLs for 1080p frames can be 5-10MB each; JPEG ~200-500KB
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      const screenshot: Screenshot = {
        id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        channelName,
        timestamp: new Date(),
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      };

      setScreenshots(prev => {
        const updated = [screenshot, ...prev];
        return updated.slice(0, MAX_SCREENSHOTS);
      });
      setLastScreenshot(screenshot);
      
      // Camera flash effect (tracked timer)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setShowFlash(true);
      flashTimerRef.current = setTimeout(() => {
        setShowFlash(false);
        flashTimerRef.current = null;
      }, 150);

      return screenshot;
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      return null;
    }
  }, []);

  const downloadScreenshot = useCallback((screenshot: Screenshot) => {
    const link = document.createElement('a');
    link.href = screenshot.dataUrl;
    const timestamp = screenshot.timestamp.toISOString().replace(/[:.]/g, '-');
    link.download = `${screenshot.channelName}_${timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const downloadLastScreenshot = useCallback(() => {
    if (lastScreenshot) {
      downloadScreenshot(lastScreenshot);
    }
  }, [lastScreenshot, downloadScreenshot]);

  const deleteScreenshot = useCallback((id: string) => {
    setScreenshots(prev => prev.filter(s => s.id !== id));
    if (lastScreenshot?.id === id) {
      setLastScreenshot(null);
    }
  }, [lastScreenshot]);

  const clearAllScreenshots = useCallback(() => {
    setScreenshots([]);
    setLastScreenshot(null);
  }, []);

  return {
    screenshots,
    lastScreenshot,
    showFlash,
    captureScreenshot,
    downloadScreenshot,
    downloadLastScreenshot,
    deleteScreenshot,
    clearAllScreenshots,
    screenshotCount: screenshots.length,
  };
}

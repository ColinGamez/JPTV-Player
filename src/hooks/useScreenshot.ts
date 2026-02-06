/**
 * Screenshot Capture
 * Captures frames from the video player
 */

import { useState, useCallback } from 'react';

export interface Screenshot {
  id: string;
  channelName: string;
  timestamp: Date;
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_SCREENSHOTS = 50;

export function useScreenshot() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [lastScreenshot, setLastScreenshot] = useState<Screenshot | null>(null);
  const [showFlash, setShowFlash] = useState(false);

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

      const dataUrl = canvas.toDataURL('image/png');
      
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
      
      // Camera flash effect
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 150);

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
    link.download = `${screenshot.channelName}_${timestamp}.png`;
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

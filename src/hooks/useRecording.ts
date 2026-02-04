import { useState, useCallback, useEffect } from 'react';
import type { RecordingInfo } from '../types/electron';

interface UseRecordingResult {
  isRecording: boolean;
  recordingInfo: RecordingInfo | null;
  activeRecordings: RecordingInfo[];
  recordingsPath: string;
  startRecording: (channelId: string, channelName: string) => Promise<boolean>;
  stopRecording: (channelId: string) => Promise<boolean>;
  refreshActiveRecordings: () => Promise<void>;
}

export function useRecording(channelId?: string): UseRecordingResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingInfo, setRecordingInfo] = useState<RecordingInfo | null>(null);
  const [activeRecordings, setActiveRecordings] = useState<RecordingInfo[]>([]);
  const [recordingsPath, setRecordingsPath] = useState('');

  const checkRecordingStatus = useCallback(async () => {
    if (!channelId) return;
    
    try {
      const recording = await window.electronAPI.recording.isRecording(channelId);
      setIsRecording(recording);
      
      if (recording) {
        const info = await window.electronAPI.recording.getInfo(channelId);
        setRecordingInfo(info);
      } else {
        setRecordingInfo(null);
      }
    } catch (error) {
      console.error('Failed to check recording status:', error);
      setIsRecording(false);
      setRecordingInfo(null);
    }
  }, [channelId]);

  const refreshActiveRecordings = useCallback(async () => {
    try {
      const active = await window.electronAPI.recording.getActive();
      setActiveRecordings(active);
    } catch (error) {
      console.error('Failed to refresh active recordings:', error);
      setActiveRecordings([]);
    }
  }, []);

  const loadRecordingsPath = useCallback(async () => {
    try {
      const path = await window.electronAPI.recording.getPath();
      setRecordingsPath(path);
    } catch (error) {
      console.error('Failed to get recordings path:', error);
      setRecordingsPath('');
    }
  }, []);

  const startRecording = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.recording.start(id, name);
      if (result.success) {
        await checkRecordingStatus();
        await refreshActiveRecordings();
        return true;
      } else {
        console.error('Failed to start recording:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }, [checkRecordingStatus, refreshActiveRecordings]);

  const stopRecording = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await window.electronAPI.recording.stop(id);
      if (result.success) {
        await checkRecordingStatus();
        await refreshActiveRecordings();
        return true;
      } else {
        console.error('Failed to stop recording:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return false;
    }
  }, [checkRecordingStatus, refreshActiveRecordings]);

  // Initial load
  useEffect(() => {
    checkRecordingStatus();
    refreshActiveRecordings();
    loadRecordingsPath();
  }, [checkRecordingStatus, refreshActiveRecordings, loadRecordingsPath]);

  // Poll recording status every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkRecordingStatus();
      refreshActiveRecordings();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkRecordingStatus, refreshActiveRecordings]);

  return {
    isRecording,
    recordingInfo,
    activeRecordings,
    recordingsPath,
    startRecording,
    stopRecording,
    refreshActiveRecordings
  };
}

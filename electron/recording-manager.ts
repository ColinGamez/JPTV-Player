/**
 * Recording Manager
 * 
 * Manages stream recording to disk with automatic file organization.
 * Organizes recordings by date and channel name.
 */

import * as path from 'path';
import * as fs from 'fs';
import { RotatingLogger } from './logger';

export interface RecordingInfo {
  channelId: string;
  channelName: string;
  filePath: string;
  startTime: Date;
  isRecording: boolean;
}

export class RecordingManager {
  private recordings: Map<string, RecordingInfo> = new Map();
  private recordingsPath: string;
  private logger: RotatingLogger | null = null;

  constructor(recordingsPath: string, logger?: RotatingLogger) {
    this.recordingsPath = recordingsPath;
    this.logger = logger || null;

    // Ensure recordings directory exists
    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true });
      this.logger?.info('Created recordings directory', { path: recordingsPath });
    }
  }

  /**
   * Generate file path for recording
   * Format: recordings/YYYY-MM-DD/ChannelName_HHMMSS.ts
   */
  generateFilePath(channelName: string): string {
    const now = new Date();
    
    // Date folder: YYYY-MM-DD
    const dateFolder = now.toISOString().split('T')[0];
    const datePath = path.join(this.recordingsPath, dateFolder);
    
    // Ensure date folder exists
    if (!fs.existsSync(datePath)) {
      fs.mkdirSync(datePath, { recursive: true });
    }
    
    // Sanitize channel name for filename
    const sanitized = channelName
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars
      .replace(/\s+/g, '_')           // Replace spaces
      .substring(0, 50);              // Limit length
    
    // Time stamp: HHMMSS
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const timeStamp = `${hours}${minutes}${seconds}`;
    
    // Full filename
    const filename = `${sanitized}_${timeStamp}.ts`;
    
    return path.join(datePath, filename);
  }

  /**
   * Start recording for a channel
   */
  startRecording(channelId: string, channelName: string): string {
    if (this.recordings.has(channelId)) {
      const existing = this.recordings.get(channelId)!;
      if (existing.isRecording) {
        this.logger?.warn('Already recording channel', { channelId, channelName });
        return existing.filePath;
      }
    }

    const filePath = this.generateFilePath(channelName);
    
    const info: RecordingInfo = {
      channelId,
      channelName,
      filePath,
      startTime: new Date(),
      isRecording: true
    };

    this.recordings.set(channelId, info);
    
    this.logger?.info('Recording started', {
      channelId,
      channelName,
      filePath
    });

    return filePath;
  }

  /**
   * Stop recording for a channel
   */
  stopRecording(channelId: string): boolean {
    const info = this.recordings.get(channelId);
    
    if (!info || !info.isRecording) {
      this.logger?.warn('No active recording for channel', { channelId });
      return false;
    }

    info.isRecording = false;
    
    const duration = Date.now() - info.startTime.getTime();
    const durationMin = Math.round(duration / 1000 / 60);
    
    this.logger?.info('Recording stopped', {
      channelId,
      channelName: info.channelName,
      filePath: info.filePath,
      durationMin
    });

    // Check if file exists and has size
    try {
      if (fs.existsSync(info.filePath)) {
        const stats = fs.statSync(info.filePath);
        const sizeMB = Math.round(stats.size / 1024 / 1024);
        this.logger?.info('Recording file info', {
          filePath: info.filePath,
          sizeMB
        });
      }
    } catch (error) {
      this.logger?.error('Error checking recording file', { error });
    }

    return true;
  }

  /**
   * Check if channel is currently recording
   */
  isRecording(channelId: string): boolean {
    const info = this.recordings.get(channelId);
    return info?.isRecording || false;
  }

  /**
   * Get recording info for a channel
   */
  getRecordingInfo(channelId: string): RecordingInfo | null {
    return this.recordings.get(channelId) || null;
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings(): RecordingInfo[] {
    return Array.from(this.recordings.values()).filter(r => r.isRecording);
  }

  /**
   * Get recordings path
   */
  getRecordingsPath(): string {
    return this.recordingsPath;
  }

  /**
   * Clear recording info (doesn't delete files)
   */
  clearRecording(channelId: string): void {
    this.recordings.delete(channelId);
  }

  /**
   * Clear all recording info
   */
  clearAll(): void {
    this.recordings.clear();
  }
}

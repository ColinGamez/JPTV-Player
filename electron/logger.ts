import * as fs from 'fs';
import * as path from 'path';

export class RotatingLogger {
  private logDir: string;
  private maxLogSize: number;
  private maxLogFiles: number;
  private currentLogFile: string;
  private writeQueue: string[] = [];
  private isWriting = false;

  constructor(logDir: string, maxLogSize = 5 * 1024 * 1024, maxLogFiles = 5) {
    this.logDir = logDir;
    this.maxLogSize = maxLogSize;
    this.maxLogFiles = maxLogFiles;
    this.currentLogFile = path.join(logDir, 'vlc-player.log');

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = this.getTimestamp();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
  }

  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.currentLogFile)) {
        return;
      }

      const stats = fs.statSync(this.currentLogFile);
      if (stats.size < this.maxLogSize) {
        return;
      }

      // Rotate logs
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = path.join(this.logDir, `vlc-player.${i}.log`);
        const newFile = path.join(this.logDir, `vlc-player.${i + 1}.log`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Rename current log to .1.log
      const firstRotated = path.join(this.logDir, 'vlc-player.1.log');
      fs.renameSync(this.currentLogFile, firstRotated);
    } catch (error) {
      console.error('[RotatingLogger] Failed to rotate logs:', error);
    }
  }

  /**
   * Non-blocking async write with queue to prevent event loop blocking.
   * Falls back to sync write if queue draining fails.
   */
  private writeLog(message: string): void {
    this.writeQueue.push(message);
    this.drainQueue();
  }

  private drainQueue(): void {
    if (this.isWriting || this.writeQueue.length === 0) return;
    this.isWriting = true;

    // Batch all queued messages into a single write
    const batch = this.writeQueue.splice(0);
    const data = batch.join('');

    try {
      this.rotateIfNeeded();
    } catch { /* rotation errors already logged */ }

    fs.appendFile(this.currentLogFile, data, 'utf-8', (err) => {
      this.isWriting = false;
      if (err) {
        console.error('[RotatingLogger] Failed to write log:', err);
      }
      // Drain any messages that arrived while we were writing
      if (this.writeQueue.length > 0) {
        this.drainQueue();
      }
    });
  }

  /**
   * Flush remaining log messages synchronously (for shutdown)
   */
  close(): void {
    if (this.writeQueue.length > 0) {
      try {
        const batch = this.writeQueue.splice(0);
        fs.appendFileSync(this.currentLogFile, batch.join(''), 'utf-8');
      } catch (error) {
        console.error('[RotatingLogger] Failed to flush logs on close:', error);
      }
    }
  }

  info(message: string, meta?: any): void {
    this.writeLog(this.formatMessage('INFO', message, meta));
  }

  warn(message: string, meta?: any): void {
    this.writeLog(this.formatMessage('WARN', message, meta));
    console.warn(`[VLC] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    this.writeLog(this.formatMessage('ERROR', message, meta));
    console.error(`[VLC] ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    this.writeLog(this.formatMessage('DEBUG', message, meta));
  }
}

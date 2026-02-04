import * as fs from 'fs';
import * as path from 'path';

export class RotatingLogger {
  private logDir: string;
  private maxLogSize: number;
  private maxLogFiles: number;
  private currentLogFile: string;

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

  private writeLog(message: string): void {
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.currentLogFile, message, 'utf-8');
    } catch (error) {
      console.error('[RotatingLogger] Failed to write log:', error);
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

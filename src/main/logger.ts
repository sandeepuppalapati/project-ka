import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logDir: string;
  private currentLogFile: string;
  private logLevel: LogLevel = 'info';
  private maxLogFiles = 7; // Keep logs for 7 days
  private writeQueue: LogEntry[] = [];
  private isWriting = false;

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.currentLogFile = path.join(this.logDir, `${this.getDateString()}.log`);
    this.init();
  }

  private async init() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      await this.rotateOldLogs();
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private async rotateOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(f => f.endsWith('.log'))
        .sort()
        .reverse();

      // Delete old log files
      if (logFiles.length > this.maxLogFiles) {
        for (const file of logFiles.slice(this.maxLogFiles)) {
          await fs.unlink(path.join(this.logDir, file));
        }
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private async writeToFile(entry: LogEntry) {
    try {
      // Check if we need to rotate to a new file (new day)
      const today = this.getDateString();
      const currentFile = path.join(this.logDir, `${today}.log`);
      if (currentFile !== this.currentLogFile) {
        this.currentLogFile = currentFile;
        await this.rotateOldLogs();
      }

      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.currentLogFile, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  private async processQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    while (this.writeQueue.length > 0) {
      const entry = this.writeQueue.shift();
      if (entry) {
        await this.writeToFile(entry);
      }
    }
    this.isWriting = false;
  }

  private log(level: LogLevel, category: string, message: string, data?: any) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      logFn(`[${entry.timestamp}] [${level.toUpperCase()}] [${category}] ${message}`, data || '');
    }

    this.writeQueue.push(entry);
    this.processQueue();
  }

  debug(category: string, message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
    this.info('logger', `Log level changed to ${level}`);
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDir);
      return files
        .filter(f => f.endsWith('.log'))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      this.error('logger', 'Failed to list log files', error);
      return [];
    }
  }

  async readLogFile(filename: string): Promise<string> {
    try {
      const filePath = path.join(this.logDir, filename);
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      this.error('logger', `Failed to read log file: ${filename}`, error);
      return '';
    }
  }

  async clearLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      for (const file of files) {
        if (file.endsWith('.log')) {
          await fs.unlink(path.join(this.logDir, file));
        }
      }
      this.info('logger', 'All logs cleared');
    } catch (error) {
      this.error('logger', 'Failed to clear logs', error);
    }
  }

  getLogDir(): string {
    return this.logDir;
  }
}

// Singleton instance
export const logger = new Logger();

// Performance measurement helper
export class PerformanceTimer {
  private startTime: number;
  private category: string;
  private operation: string;

  constructor(category: string, operation: string) {
    this.category = category;
    this.operation = operation;
    this.startTime = performance.now();
    logger.debug(category, `${operation} started`);
  }

  end() {
    const duration = performance.now() - this.startTime;
    logger.info(this.category, `${this.operation} completed`, { duration: `${duration.toFixed(2)}ms` });
    return duration;
  }
}

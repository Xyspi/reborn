import { join } from 'path';
import { promises as fs } from 'fs';

// Safe electron imports for testing
let app: any;
try {
  const electron = require('electron');
  app = electron.app;
} catch (error) {
  // Mock for testing
  app = {
    getPath: () => process.cwd(),
    getName: () => 'reborn'
  };
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service?: string;
  error?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private static instance: Logger;
  private logDir: string;
  private logFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;

  private constructor() {
    this.logDir = join(app.getPath('userData'), 'logs');
    this.logFile = join(this.logDir, 'reborn.log');
    this.ensureLogDirectory();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, service, error, stack, metadata } = entry;
    
    let logLine = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (service) {
      logLine += ` [${service}]`;
    }
    
    logLine += ` ${message}`;
    
    if (error) {
      logLine += ` ERROR: ${error}`;
    }
    
    if (stack) {
      logLine += `\nStack: ${stack}`;
    }
    
    if (metadata && Object.keys(metadata).length > 0) {
      logLine += `\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
    }
    
    return logLine;
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.logFile);
      
      if (stats.size >= this.maxLogSize) {
        // Rotate logs
        for (let i = this.maxLogFiles - 1; i >= 1; i--) {
          const oldFile = `${this.logFile}.${i}`;
          const newFile = `${this.logFile}.${i + 1}`;
          
          try {
            await fs.rename(oldFile, newFile);
          } catch (error) {
            // File doesn't exist, continue
          }
        }
        
        // Move current log to .1
        await fs.rename(this.logFile, `${this.logFile}.1`);
        
        // Remove oldest log if it exists
        try {
          await fs.unlink(`${this.logFile}.${this.maxLogFiles}`);
        } catch (error) {
          // File doesn't exist, continue
        }
      }
    } catch (error) {
      // Log file doesn't exist yet, continue
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      await this.rotateLogsIfNeeded();
      
      const logLine = this.formatLogEntry(entry) + '\n';
      await fs.appendFile(this.logFile, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, service?: string, error?: Error, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service,
      error: error?.message,
      stack: error?.stack,
      metadata
    };

    // Always log to console
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(this.formatLogEntry(entry));

    // Write to file asynchronously
    this.writeToFile(entry).catch(console.error);
  }

  debug(message: string, service?: string, metadata?: Record<string, any>): void {
    this.log('debug', message, service, undefined, metadata);
  }

  info(message: string, service?: string, metadata?: Record<string, any>): void {
    this.log('info', message, service, undefined, metadata);
  }

  warn(message: string, service?: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('warn', message, service, error, metadata);
  }

  error(message: string, service?: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('error', message, service, error, metadata);
  }

  async getLogs(lines: number = 100): Promise<string[]> {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      return [];
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await fs.writeFile(this.logFile, '', 'utf8');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }
}

// Export a singleton instance
export const logger = Logger.getInstance();
export default logger;
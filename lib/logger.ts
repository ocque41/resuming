/**
 * Logger Service
 * 
 * This service provides a unified interface for logging with different levels
 * and contexts, making it easier to debug and monitor the application.
 */

// Define log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// Define log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  userId?: number | string;
  cvId?: number | string;
  error?: Error | string;
}

// Define logger options
export interface LoggerOptions {
  minLevel?: LogLevel;
  includeTimestamp?: boolean;
  includeContext?: boolean;
  includeData?: boolean;
}

// Default logger options
const defaultOptions: LoggerOptions = {
  minLevel: LogLevel.DEBUG,
  includeTimestamp: true,
  includeContext: true,
  includeData: true
};

// Global options that can be changed at runtime
let globalOptions: LoggerOptions = { ...defaultOptions };

/**
 * Set global logger options
 * 
 * @param options - The options to set
 */
export function setLoggerOptions(options: LoggerOptions): void {
  globalOptions = { ...globalOptions, ...options };
}

/**
 * Create a logger instance with a specific context
 * 
 * @param context - The context for the logger
 * @param options - The options for the logger
 * @returns A logger instance
 */
export function createLogger(context: string, options?: LoggerOptions) {
  const loggerOptions = { ...globalOptions, ...options };
  
  return {
    debug: (message: string, data?: any, userId?: number | string, cvId?: number | string) => {
      log(LogLevel.DEBUG, message, context, data, userId, cvId);
    },
    info: (message: string, data?: any, userId?: number | string, cvId?: number | string) => {
      log(LogLevel.INFO, message, context, data, userId, cvId);
    },
    warn: (message: string, data?: any, userId?: number | string, cvId?: number | string) => {
      log(LogLevel.WARN, message, context, data, userId, cvId);
    },
    error: (message: string, error?: Error | string, data?: any, userId?: number | string, cvId?: number | string) => {
      log(LogLevel.ERROR, message, context, data, userId, cvId, error);
    }
  };
}

/**
 * Log a message
 * 
 * @param level - The log level
 * @param message - The message to log
 * @param context - The context for the log
 * @param data - Additional data to log
 * @param userId - The user ID associated with the log
 * @param cvId - The CV ID associated with the log
 * @param error - The error associated with the log
 */
function log(
  level: LogLevel,
  message: string,
  context?: string,
  data?: any,
  userId?: number | string,
  cvId?: number | string,
  error?: Error | string
): void {
  // Check if the log level is high enough
  if (!shouldLog(level)) {
    return;
  }
  
  // Create the log entry
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    userId,
    cvId
  };
  
  // Add data if available and enabled
  if (data && globalOptions.includeData) {
    entry.data = data;
  }
  
  // Add error if available
  if (error) {
    entry.error = error;
  }
  
  // Log to console
  logToConsole(entry);
  
  // Here you could add additional logging targets
  // For example, sending logs to a server or writing to a file
}

/**
 * Check if a log level should be logged
 * 
 * @param level - The log level to check
 * @returns Whether the log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  const minLevelIndex = levels.indexOf(globalOptions.minLevel || LogLevel.DEBUG);
  const levelIndex = levels.indexOf(level);
  
  return levelIndex >= minLevelIndex;
}

/**
 * Log an entry to the console
 * 
 * @param entry - The log entry to log
 */
function logToConsole(entry: LogEntry): void {
  // Create the log message
  let message = '';
  
  // Add timestamp if enabled
  if (globalOptions.includeTimestamp) {
    message += `[${entry.timestamp}] `;
  }
  
  // Add level
  message += `[${entry.level.toUpperCase()}] `;
  
  // Add context if available and enabled
  if (entry.context && globalOptions.includeContext) {
    message += `[${entry.context}] `;
  }
  
  // Add user ID if available
  if (entry.userId) {
    message += `[User: ${entry.userId}] `;
  }
  
  // Add CV ID if available
  if (entry.cvId) {
    message += `[CV: ${entry.cvId}] `;
  }
  
  // Add message
  message += entry.message;
  
  // Log to console with the appropriate level
  switch (entry.level) {
    case LogLevel.DEBUG:
      console.debug(message);
      break;
    case LogLevel.INFO:
      console.info(message);
      break;
    case LogLevel.WARN:
      console.warn(message);
      break;
    case LogLevel.ERROR:
      console.error(message);
      break;
  }
  
  // Log additional data if available
  if (entry.data && globalOptions.includeData) {
    console.log('Data:', entry.data);
  }
  
  // Log error if available
  if (entry.error) {
    if (entry.error instanceof Error) {
      console.error('Error:', entry.error.message);
      console.error('Stack:', entry.error.stack);
    } else {
      console.error('Error:', entry.error);
    }
  }
}

// Create default loggers for common contexts
export const logger = createLogger('app');
export const apiLogger = createLogger('api');
export const dbLogger = createLogger('db');
export const cvLogger = createLogger('cv');
export const authLogger = createLogger('auth');
export const storageLogger = createLogger('storage'); 
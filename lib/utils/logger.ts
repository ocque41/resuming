/**
 * Simple logger utility for application-wide logging
 */
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[${new Date().toISOString()}] [INFO] [app] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[${new Date().toISOString()}] [WARN] [app] ${message}`, ...args);
  },
  
  error: (message: string, error?: Error | string) => {
    if (error) {
      if (error instanceof Error) {
        console.error(`[${new Date().toISOString()}] [ERROR] [app] ${message}`, error.message);
        if (error.stack) {
          console.error(error.stack);
        }
      } else {
        console.error(`[${new Date().toISOString()}] [ERROR] [app] ${message}`, error);
      }
    } else {
      console.error(`[${new Date().toISOString()}] [ERROR] [app] ${message}`);
    }
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${new Date().toISOString()}] [DEBUG] [app] ${message}`, ...args);
    }
  }
}; 
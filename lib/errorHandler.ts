/**
 * Error Handler
 * 
 * This module provides functions for handling errors and implementing recovery mechanisms
 * in the CV optimization system.
 */

import { cvLogger } from './logger';

// Define error types
export enum ErrorType {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  SERVER = 'server',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

// Define error severity
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Define error interface
export interface AppError {
  type: ErrorType;
  message: string;
  severity: ErrorSeverity;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: string;
  recoverable: boolean;
  recoveryStrategy?: string;
}

/**
 * Create an application error
 * 
 * @param type - The error type
 * @param message - The error message
 * @param severity - The error severity
 * @param originalError - The original error
 * @param context - Additional context
 * @returns The application error
 */
export function createError(
  type: ErrorType,
  message: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  originalError?: Error,
  context?: Record<string, any>
): AppError {
  // Determine if the error is recoverable
  const recoverable = isRecoverable(type, severity);
  
  // Determine the recovery strategy
  const recoveryStrategy = recoverable ? getRecoveryStrategy(type) : undefined;
  
  // Create the error
  const appError: AppError = {
    type,
    message,
    severity,
    originalError,
    context,
    timestamp: new Date().toISOString(),
    recoverable,
    recoveryStrategy
  };
  
  // Log the error
  logError(appError);
  
  return appError;
}

/**
 * Handle an error
 * 
 * @param error - The error to handle
 * @param context - Additional context
 * @returns The result of the error handling
 */
export async function handleError(
  error: Error | AppError,
  context?: Record<string, any>
): Promise<{ success: boolean; error?: AppError; recoveryResult?: any }> {
  try {
    // Convert to AppError if needed
    const appError = isAppError(error) ? error : convertToAppError(error, context);
    
    // Log the error
    logError(appError);
    
    // Try to recover if the error is recoverable
    if (appError.recoverable && appError.recoveryStrategy) {
      const recoveryResult = await executeRecoveryStrategy(appError);
      
      if (recoveryResult.success) {
        return {
          success: true,
          error: appError,
          recoveryResult: recoveryResult.result
        };
      }
    }
    
    // If recovery failed or the error is not recoverable, return failure
    return {
      success: false,
      error: appError
    };
  } catch (handlingError) {
    // If an error occurs during error handling, log it and return failure
    cvLogger.error(
      "Error occurred during error handling",
      handlingError as Error,
      { originalError: error }
    );
    
    return {
      success: false,
      error: createError(
        ErrorType.UNKNOWN,
        "Error occurred during error handling",
        ErrorSeverity.HIGH,
        handlingError as Error
      )
    };
  }
}

/**
 * Check if an error is an AppError
 * 
 * @param error - The error to check
 * @returns Whether the error is an AppError
 */
function isAppError(error: Error | AppError): error is AppError {
  return (
    typeof (error as AppError).type === 'string' &&
    typeof (error as AppError).message === 'string' &&
    typeof (error as AppError).severity === 'string' &&
    typeof (error as AppError).timestamp === 'string' &&
    typeof (error as AppError).recoverable === 'boolean'
  );
}

/**
 * Convert an Error to an AppError
 * 
 * @param error - The error to convert
 * @param context - Additional context
 * @returns The converted AppError
 */
function convertToAppError(error: Error, context?: Record<string, any>): AppError {
  // Try to determine the error type
  let type = ErrorType.UNKNOWN;
  let severity = ErrorSeverity.MEDIUM;
  
  // Check for common error patterns
  if (error.message.includes("not found") || error.message.includes("404")) {
    type = ErrorType.NOT_FOUND;
    severity = ErrorSeverity.LOW;
  } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
    type = ErrorType.TIMEOUT;
    severity = ErrorSeverity.MEDIUM;
  } else if (error.message.includes("rate limit") || error.message.includes("429")) {
    type = ErrorType.RATE_LIMIT;
    severity = ErrorSeverity.MEDIUM;
  } else if (error.message.includes("network") || error.message.includes("connection")) {
    type = ErrorType.NETWORK;
    severity = ErrorSeverity.MEDIUM;
  } else if (error.message.includes("server") || error.message.includes("500")) {
    type = ErrorType.SERVER;
    severity = ErrorSeverity.HIGH;
  } else if (error.message.includes("auth")) {
    if (error.message.includes("unauthorized") || error.message.includes("401")) {
      type = ErrorType.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
    } else if (error.message.includes("forbidden") || error.message.includes("403")) {
      type = ErrorType.AUTHORIZATION;
      severity = ErrorSeverity.HIGH;
    }
  } else if (error.message.includes("valid")) {
    type = ErrorType.VALIDATION;
    severity = ErrorSeverity.LOW;
  }
  
  return createError(type, error.message, severity, error, context);
}

/**
 * Check if an error is recoverable
 * 
 * @param type - The error type
 * @param severity - The error severity
 * @returns Whether the error is recoverable
 */
function isRecoverable(type: ErrorType, severity: ErrorSeverity): boolean {
  // Critical errors are never recoverable
  if (severity === ErrorSeverity.CRITICAL) {
    return false;
  }
  
  // Some error types are always recoverable
  if (
    type === ErrorType.TIMEOUT ||
    type === ErrorType.RATE_LIMIT ||
    type === ErrorType.NETWORK
  ) {
    return true;
  }
  
  // Some error types are recoverable depending on severity
  if (
    type === ErrorType.VALIDATION ||
    type === ErrorType.NOT_FOUND
  ) {
    return severity !== ErrorSeverity.HIGH;
  }
  
  // Other error types are not recoverable
  return false;
}

/**
 * Get the recovery strategy for an error type
 * 
 * @param type - The error type
 * @returns The recovery strategy
 */
function getRecoveryStrategy(type: ErrorType): string {
  switch (type) {
    case ErrorType.TIMEOUT:
      return "retry";
    case ErrorType.RATE_LIMIT:
      return "wait_and_retry";
    case ErrorType.NETWORK:
      return "retry";
    case ErrorType.VALIDATION:
      return "fallback";
    case ErrorType.NOT_FOUND:
      return "fallback";
    default:
      return "none";
  }
}

/**
 * Execute a recovery strategy
 * 
 * @param error - The error to recover from
 * @returns The result of the recovery
 */
async function executeRecoveryStrategy(
  error: AppError
): Promise<{ success: boolean; result?: any }> {
  try {
    if (!error.recoveryStrategy) {
      return { success: false };
    }
    
    switch (error.recoveryStrategy) {
      case "retry":
        return await retryStrategy(error);
      case "wait_and_retry":
        return await waitAndRetryStrategy(error);
      case "fallback":
        return await fallbackStrategy(error);
      default:
        return { success: false };
    }
  } catch (recoveryError) {
    cvLogger.error(
      `Error executing recovery strategy '${error.recoveryStrategy}'`,
      recoveryError as Error,
      { originalError: error }
    );
    
    return { success: false };
  }
}

/**
 * Retry strategy
 * 
 * @param error - The error to recover from
 * @returns The result of the recovery
 */
async function retryStrategy(error: AppError): Promise<{ success: boolean; result?: any }> {
  try {
    // Get the function to retry from the context
    const retryFunction = error.context?.retryFunction;
    const retryArgs = error.context?.retryArgs || [];
    
    if (typeof retryFunction !== 'function') {
      return { success: false };
    }
    
    // Retry the function
    const result = await retryFunction(...retryArgs);
    
    return { success: true, result };
  } catch (retryError) {
    cvLogger.error(
      "Retry strategy failed",
      retryError as Error,
      { originalError: error }
    );
    
    return { success: false };
  }
}

/**
 * Wait and retry strategy
 * 
 * @param error - The error to recover from
 * @returns The result of the recovery
 */
async function waitAndRetryStrategy(error: AppError): Promise<{ success: boolean; result?: any }> {
  try {
    // Get the function to retry from the context
    const retryFunction = error.context?.retryFunction;
    const retryArgs = error.context?.retryArgs || [];
    const waitTime = error.context?.waitTime || 1000;
    
    if (typeof retryFunction !== 'function') {
      return { success: false };
    }
    
    // Wait for the specified time
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Retry the function
    const result = await retryFunction(...retryArgs);
    
    return { success: true, result };
  } catch (retryError) {
    cvLogger.error(
      "Wait and retry strategy failed",
      retryError as Error,
      { originalError: error }
    );
    
    return { success: false };
  }
}

/**
 * Fallback strategy
 * 
 * @param error - The error to recover from
 * @returns The result of the recovery
 */
async function fallbackStrategy(error: AppError): Promise<{ success: boolean; result?: any }> {
  try {
    // Get the fallback function from the context
    const fallbackFunction = error.context?.fallbackFunction;
    const fallbackArgs = error.context?.fallbackArgs || [];
    
    if (typeof fallbackFunction === 'function') {
      // Use the fallback function
      const result = await fallbackFunction(...fallbackArgs);
      return { success: true, result };
    }
    
    // Get the fallback value from the context
    const fallbackValue = error.context?.fallbackValue;
    
    if (fallbackValue !== undefined) {
      // Use the fallback value
      return { success: true, result: fallbackValue };
    }
    
    return { success: false };
  } catch (fallbackError) {
    cvLogger.error(
      "Fallback strategy failed",
      fallbackError as Error,
      { originalError: error }
    );
    
    return { success: false };
  }
}

/**
 * Log an error
 * 
 * @param error - The error to log
 */
function logError(error: AppError): void {
  const logMessage = `[${error.type.toUpperCase()}] ${error.message}`;
  
  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      cvLogger.error(logMessage, error.originalError, error.context);
      break;
    case ErrorSeverity.HIGH:
      cvLogger.error(logMessage, error.originalError, error.context);
      break;
    case ErrorSeverity.MEDIUM:
      cvLogger.warn(logMessage, error.context);
      break;
    case ErrorSeverity.LOW:
      cvLogger.info(logMessage, error.context);
      break;
  }
} 
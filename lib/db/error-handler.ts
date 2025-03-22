/**
 * Error handling utilities for database operations
 */

/**
 * Represents a database operation error with additional context
 */
export class DbOperationError extends Error {
  public readonly operation: string;
  public readonly table: string;
  public readonly originalError: unknown;
  public readonly errorId: string;

  constructor({
    message,
    operation,
    table,
    originalError,
  }: {
    message: string;
    operation: string;
    table: string;
    originalError: unknown;
  }) {
    // Generate a unique error ID for tracking
    const errorId = `db-error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    super(`[${errorId}] ${message}`);
    this.name = 'DbOperationError';
    this.operation = operation;
    this.table = table;
    this.originalError = originalError;
    this.errorId = errorId;
    
    // Log the error with full context
    console.error(`Database Error [${errorId}]:`, {
      message,
      operation,
      table,
      originalError,
    });
  }
}

/**
 * Wraps database operations with consistent error handling
 * @param operation The database operation to perform
 * @param operationName A descriptive name of the operation (e.g., 'fetchUser', 'updateEmail')
 * @param tableName The database table being accessed
 * @returns The result of the operation or throws a structured error
 */
export async function withDbErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  tableName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new DbOperationError({
      message: `Failed to ${operationName} in ${tableName}`,
      operation: operationName,
      table: tableName,
      originalError: error,
    });
  }
}

/**
 * Checks if an error is a database constraint violation
 * @param error The error to check
 * @returns True if the error is a constraint violation
 */
export function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('duplicate key') || 
           error.message.includes('unique constraint') ||
           error.message.includes('UNIQUE constraint failed');
  }
  return false;
}

/**
 * Checks if an error is a foreign key constraint violation
 * @param error The error to check
 * @returns True if the error is a foreign key constraint violation
 */
export function isForeignKeyError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('foreign key constraint') || 
           error.message.includes('FOREIGN KEY constraint failed');
  }
  return false;
}

/**
 * Creates a user-friendly error message from a database error
 * @param error The database error
 * @returns A user-friendly error message
 */
export function getUserFriendlyDbErrorMessage(error: unknown): string {
  if (error instanceof DbOperationError) {
    if (isUniqueConstraintError(error.originalError)) {
      return 'This record already exists. Please try with different details.';
    } else if (isForeignKeyError(error.originalError)) {
      return 'The referenced record does not exist.';
    }
    
    return 'A database error occurred. Please try again later.';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unknown error occurred.';
} 
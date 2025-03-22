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
  public readonly isMissingColumnError: boolean;
  public readonly missingColumn?: string;

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
    
    // Check if this is a missing column error
    this.isMissingColumnError = isMissingColumnError(originalError);
    
    // Extract the missing column name if applicable
    if (this.isMissingColumnError) {
      this.missingColumn = extractMissingColumnName(originalError);
    }
    
    // Log the error with full context
    console.error(`Database Error [${errorId}]:`, {
      message,
      operation,
      table,
      isMissingColumnError: this.isMissingColumnError,
      missingColumn: this.missingColumn,
      originalError,
    });
    
    // Log a more detailed warning if we detected a missing column
    if (this.isMissingColumnError && this.missingColumn) {
      console.warn(`
        ⚠️ SCHEMA MISMATCH DETECTED ⚠️
        The column "${this.missingColumn}" was referenced in code but doesn't exist in the database.
        This might indicate that a migration is missing or failed to run.
        
        To fix this issue:
        1. Run the database migration: npx tsx lib/db/fix-db-schema.ts
        2. Or manually add the missing column to the database
      `);
    }
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
 * Checks if an error is related to a missing column
 * @param error The error to check
 * @returns True if the error indicates a missing column
 */
function isMissingColumnError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('column') && 
      (errorMessage.includes('does not exist') || 
       errorMessage.includes('not found') ||
       errorMessage.includes('no such column'))
    );
  }
  return false;
}

/**
 * Extracts the name of the missing column from an error message
 * @param error The error containing the missing column information
 * @returns The name of the missing column, or undefined if it couldn't be extracted
 */
function extractMissingColumnName(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  
  const errorMessage = error.message;
  
  // Common PostgreSQL error: column "X" does not exist
  const pgMatch = errorMessage.match(/column ["']([^"']+)["'] does not exist/i);
  if (pgMatch && pgMatch[1]) return pgMatch[1];
  
  // Another common pattern: ERROR: column X does not exist
  const pgMatch2 = errorMessage.match(/ERROR:[^:]*column ([^ ]+) does not exist/i);
  if (pgMatch2 && pgMatch2[1]) return pgMatch2[1];
  
  // MySQL pattern: Unknown column 'X' in 'field list'
  const mysqlMatch = errorMessage.match(/Unknown column ['"]([^'"]+)['"] in/i);
  if (mysqlMatch && mysqlMatch[1]) return mysqlMatch[1];
  
  // SQLite pattern: no such column: X
  const sqliteMatch = errorMessage.match(/no such column:[ ]*([^ ]+)/i);
  if (sqliteMatch && sqliteMatch[1]) return sqliteMatch[1];
  
  return undefined;
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
    if (error.isMissingColumnError) {
      return `The application is trying to access data that doesn't exist in the database. Please contact support (Error ID: ${error.errorId})`;
    }
    
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
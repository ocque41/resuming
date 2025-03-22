/**
 * Utilities for handling API errors consistently across the application
 */

import { NextResponse } from 'next/server';
import { DbOperationError } from '@/lib/db/error-handler';

/**
 * Standard error response structure for API endpoints
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  errorCode?: string;
  errorId?: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

/**
 * Error codes for API responses
 */
export enum ApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

/**
 * Handles errors in API routes consistently
 * @param error The error to handle
 * @returns A NextResponse with appropriate status code and formatted error
 */
export function handleApiError(error: unknown): NextResponse {
  // Generate a unique error ID for tracking
  const errorId = `api-error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.error(`API Error [${errorId}]:`, error);
  
  // Handle different types of errors
  if (error instanceof DbOperationError) {
    return NextResponse.json(
      {
        success: false,
        message: 'Database operation failed',
        errorCode: ApiErrorCode.DATABASE_ERROR,
        errorId: error.errorId,
        statusCode: 500,
      },
      { status: 500 }
    );
  }
  
  if (error instanceof Error) {
    // Handle specific error types based on message or name
    if (error.message.includes('unauthorized') || error.message.includes('not logged in')) {
      return NextResponse.json(
        {
          success: false,
          message: 'You must be logged in to perform this action',
          errorCode: ApiErrorCode.UNAUTHORIZED,
          errorId,
          statusCode: 401,
        },
        { status: 401 }
      );
    }
    
    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      return NextResponse.json(
        {
          success: false,
          message: 'The requested resource was not found',
          errorCode: ApiErrorCode.NOT_FOUND,
          errorId,
          statusCode: 404,
        },
        { status: 404 }
      );
    }
    
    if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Rate limit exceeded. Please try again later.',
          errorCode: ApiErrorCode.RATE_LIMIT_EXCEEDED,
          errorId,
          statusCode: 429,
        },
        { status: 429 }
      );
    }
    
    // Generic error response
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'An unexpected error occurred',
        errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR,
        errorId,
        statusCode: 500,
      },
      { status: 500 }
    );
  }
  
  // Default case for unknown errors
  return NextResponse.json(
    {
      success: false,
      message: 'An unexpected error occurred',
      errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR,
      errorId,
      statusCode: 500,
    },
    { status: 500 }
  );
}

/**
 * Creates a safe API route handler with consistent error handling
 * @param handler The original route handler
 * @returns A wrapped handler with error handling
 */
export function withApiErrorHandling(
  handler: (...args: any[]) => Promise<NextResponse>
) {
  return async (...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
} 
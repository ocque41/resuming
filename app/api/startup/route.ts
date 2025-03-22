import { NextRequest, NextResponse } from 'next/server';

/**
 * Global variable to track if startup checks have run
 */
let startupChecksCompleted = false;

/**
 * Runs database schema validation
 */
async function validateDatabaseSchema() {
  try {
    // Call our schema validation endpoint
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    console.log('Running database schema validation...');
    
    const response = await fetch(`${baseUrl}/api/startup/schema-check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add a header to avoid infinite recursion
        'X-Internal-Request': 'true'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Database schema validation passed');
    } else {
      console.error('❌ Database schema validation failed:', result);
    }
    
    return result;
  } catch (error) {
    console.error('Error validating database schema:', error);
    return { success: false, error: 'Failed to validate database schema' };
  }
}

/**
 * Main startup route that runs all startup tasks
 * GET /api/startup
 */
export async function GET(request: NextRequest) {
  // Check if this is an internal request to avoid recursion
  const isInternalRequest = request.headers.get('X-Internal-Request') === 'true';
  if (isInternalRequest) {
    return NextResponse.json({ error: 'Internal request loop detected' }, { status: 400 });
  }
  
  // Check if startup checks have already run
  if (startupChecksCompleted) {
    return NextResponse.json({ 
      success: true,
      message: 'Startup checks already completed'
    });
  }
  
  try {
    console.log('Running application startup checks...');
    
    // Run all startup tasks
    const schemaValidationResult = await validateDatabaseSchema();
    
    // Mark startup checks as completed
    startupChecksCompleted = true;
    
    // Determine overall status
    const success = schemaValidationResult.success;
    
    return NextResponse.json({
      success,
      timestamp: new Date().toISOString(),
      schema: schemaValidationResult
    }, {
      status: success ? 200 : 500
    });
  } catch (error) {
    console.error('Error during startup checks:', error);
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500
    });
  }
}

// Make this route run at build time and during runtime
export const dynamic = 'force-dynamic'; 
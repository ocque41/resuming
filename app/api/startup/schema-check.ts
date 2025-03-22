import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

type SchemaValidationResult = {
  emailVerifiedColumn: {
    exists: boolean;
    added?: boolean;
    error?: string;
  };
  emailVerificationTokensTable: {
    exists: boolean;
    created?: boolean;
    error?: string;
  };
};

/**
 * Validates that the required schema elements exist
 * Creates them if they don't
 */
async function validateRequiredSchema(): Promise<SchemaValidationResult> {
  const connectionString = process.env.POSTGRES_URL!;
  
  // Create a client for this operation only
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  
  // Return object
  const result: SchemaValidationResult = {
    emailVerifiedColumn: {
      exists: false
    },
    emailVerificationTokensTable: {
      exists: false
    }
  };
  
  try {
    // Check for email_verified column
    try {
      const columnResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email_verified';
      `);
      
      if (columnResult.length > 0) {
        console.log('✅ users.email_verified column exists');
        result.emailVerifiedColumn.exists = true;
      } else {
        console.log('❌ users.email_verified column does not exist, adding it...');
        await db.execute(sql`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ users.email_verified column added');
        result.emailVerifiedColumn.exists = true;
        result.emailVerifiedColumn.added = true;
      }
    } catch (columnError) {
      console.error('Error checking/adding email_verified column:', columnError);
      result.emailVerifiedColumn.error = columnError instanceof Error ? columnError.message : 'Unknown error';
    }
    
    // Check for email_verification_tokens table
    try {
      const tableResult = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'email_verification_tokens'
        );
      `);
      
      const tableExists = tableResult[0]?.exists;
      if (tableExists) {
        console.log('✅ email_verification_tokens table exists');
        result.emailVerificationTokensTable.exists = true;
      } else {
        console.log('❌ email_verification_tokens table does not exist, creating it...');
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            token TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
        console.log('✅ email_verification_tokens table created');
        result.emailVerificationTokensTable.exists = true;
        result.emailVerificationTokensTable.created = true;
      }
    } catch (tableError) {
      console.error('Error checking/creating email_verification_tokens table:', tableError);
      result.emailVerificationTokensTable.error = tableError instanceof Error ? tableError.message : 'Unknown error';
    }
    
    return result;
  } finally {
    // Always close the client to avoid connection leaks
    await client.end();
  }
}

/**
 * API route that validates the database schema on startup
 * GET /api/startup/schema-check
 */
export async function GET(request: NextRequest) {
  try {
    const result = await validateRequiredSchema();
    
    // Determine overall status
    const success = result.emailVerifiedColumn.exists && result.emailVerificationTokensTable.exists;
    
    return NextResponse.json({ 
      success,
      timestamp: new Date().toISOString(),
      schema: result
    }, { 
      status: success ? 200 : 500 
    });
  } catch (error) {
    console.error('Error in schema validation API:', error);
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
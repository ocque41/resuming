export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * API endpoint to create the job_status table
 * This is a temporary endpoint for setting up the database
 * Note: For security in production, this should be restricted,
 * but we're making it open temporarily for setup purposes
 */
export async function GET(request: NextRequest) {
  try {
    // Create the job_status table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_status (
        id SERIAL PRIMARY KEY,
        job_id TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        cv_id INTEGER NOT NULL REFERENCES cvs(id),
        status VARCHAR(50) NOT NULL DEFAULT 'processing',
        progress INTEGER NOT NULL DEFAULT 0,
        result JSONB,
        error TEXT,
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        job_type VARCHAR(50) NOT NULL DEFAULT 'tailor',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    return NextResponse.json({ 
      success: true, 
      message: 'job_status table created successfully' 
    });
  } catch (error) {
    logger.error('Error creating job_status table:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 
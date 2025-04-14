import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    // Add a usageBasedPricing column to the teams table
    await sql`
      ALTER TABLE teams 
      ADD COLUMN IF NOT EXISTS usage_based_pricing BOOLEAN DEFAULT FALSE;
    `;

    // Create a job_applications table for tracking job applications
    await sql`
      CREATE TABLE IF NOT EXISTS job_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        team_id INTEGER NOT NULL REFERENCES teams(id),
        cv_id INTEGER NOT NULL REFERENCES cvs(id),
        job_count INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        amount_charged INTEGER NOT NULL,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        payment_intent_id TEXT,
        metadata TEXT
      );
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Database schema updated for usage-based pricing'
    });
  } catch (error) {
    console.error('Error updating database schema:', error);
    return NextResponse.json(
      { error: 'Failed to update database schema' },
      { status: 500 }
    );
  }
} 
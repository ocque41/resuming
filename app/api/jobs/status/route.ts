import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get the job ID from the query parameters
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('id');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Query the database for the job status
    const jobResult = await sql`
      SELECT * FROM job_applications 
      WHERE payment_intent_id = ${jobId} AND user_id = ${user.id}
      LIMIT 1
    `;

    if (jobResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const job = jobResult.rows[0];

    return NextResponse.json({
      id: job.payment_intent_id,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      cvId: job.cv_id,
      metadata: job.metadata
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
} 
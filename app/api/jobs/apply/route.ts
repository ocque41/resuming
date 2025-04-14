import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import { getUser } from '@/lib/db/queries.server';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { cvId, jobCount } = body;

    if (!cvId) {
      return NextResponse.json(
        { error: 'CV ID is required' },
        { status: 400 }
      );
    }
    
    // Validate jobCount - ensure it's between 5 and 50, defaulting to 25 if not provided
    const validatedJobCount = !jobCount ? 25 : 
                            Math.min(50, Math.max(5, parseInt(jobCount.toString(), 10)));

    if (isNaN(validatedJobCount)) {
      return NextResponse.json(
        { error: 'Invalid job count, must be a number between 5 and 50' },
        { status: 400 }
      );
    }

    // Get the user's team
    const userTeam = await db
      .select({
        teamId: teamMembers.teamId,
      })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .limit(1);

    if (userTeam.length === 0) {
      return NextResponse.json(
        { error: 'User is not associated with any team' },
        { status: 400 }
      );
    }

    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, userTeam[0].teamId))
      .limit(1);

    if (team.length === 0) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 400 }
      );
    }

    // Check if usage-based pricing is enabled for the team
    const usageBasedPricingResult = await sql`
      SELECT usage_based_pricing FROM teams WHERE id = ${userTeam[0].teamId}
    `;
    
    const hasUsageBasedPricing = usageBasedPricingResult.rows[0]?.usage_based_pricing || false;
    
    if (!hasUsageBasedPricing) {
      return NextResponse.json(
        { error: 'Usage-based pricing not enabled for this team' },
        { status: 400 }
      );
    }

    // Create a payment intent for $0.99
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 99, // $0.99 in cents
      currency: 'usd',
      customer: team[0].stripeCustomerId || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: user.id.toString(),
        teamId: team[0].id.toString(),
        cvId: cvId.toString(),
        jobCount: validatedJobCount.toString(),
        type: 'job_application',
      },
    });

    // Create a record in the job_applications table
    await sql`
      INSERT INTO job_applications (
        user_id, team_id, cv_id, job_count, status, amount_charged, 
        payment_status, payment_intent_id, metadata
      ) VALUES (
        ${user.id}, ${team[0].id}, ${cvId}, ${validatedJobCount}, 'pending', 99, 
        'pending', ${paymentIntent.id}, ${JSON.stringify({ 
          jobCount: validatedJobCount, 
          startedAt: new Date().toISOString() 
        })}
      )
    `;

    // Start the job application process asynchronously
    // In a real implementation, this would start a background job
    // with a webhook that calls our LinkedIn job application agent
    
    // For now, we'll mock this by updating the status after a few seconds
    setTimeout(async () => {
      try {
        // Update the job status to 'completed'
        await sql`
          UPDATE job_applications 
          SET status = 'completed', 
              updated_at = NOW(),
              payment_status = 'succeeded',
              metadata = ${JSON.stringify({ 
                jobCount: validatedJobCount, 
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                appliedJobs: validatedJobCount,
                successfulApplications: Math.floor(validatedJobCount * 0.9),
                failedApplications: Math.floor(validatedJobCount * 0.1),
              })}
          WHERE payment_intent_id = ${paymentIntent.id}
        `;

        // In a real implementation, we would send an email to the user
        // with the results of the job application process
        console.log(`Job application ${paymentIntent.id} completed successfully`);
      } catch (error) {
        console.error('Error completing job application:', error);
      }
    }, 5000);

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Job application process started',
      jobCount: validatedJobCount,
    });
  } catch (error) {
    console.error('Error starting job application process:', error);
    return NextResponse.json(
      { error: 'Failed to start job application process' },
      { status: 500 }
    );
  }
} 
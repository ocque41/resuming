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
    const { cvId, cv, jobCount = 25 } = body;
    const selectedCvId = cvId || cv;

    if (!selectedCvId) {
      return NextResponse.json(
        { error: 'CV ID is required' },
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
        { error: 'Usage-based pricing not enabled for this team', needsPayment: true },
        { status: 400 }
      );
    }

    // Calculate the amount based on job count
    const amount = Math.max(1, Math.ceil(jobCount * 0.99 * 100)); // $0.99 per job in cents

    // Create a payment intent for the job application
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: team[0].stripeCustomerId || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: user.id.toString(),
        teamId: team[0].id.toString(),
        cvId: selectedCvId.toString(),
        jobCount: jobCount.toString(),
        type: 'job_application',
      },
    });

    // Create a record in the job_applications table
    await sql`
      INSERT INTO job_applications (
        user_id, team_id, cv_id, job_count, status, amount_charged, 
        payment_status, payment_intent_id, metadata
      ) VALUES (
        ${user.id}, ${team[0].id}, ${selectedCvId}, ${jobCount}, 'pending', ${amount}, 
        'pending', ${paymentIntent.id}, ${JSON.stringify({ 
          jobCount, 
          startedAt: new Date().toISOString(),
          amountPerJob: 0.99,
          totalAmount: (jobCount * 0.99).toFixed(2)
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
                jobCount, 
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                appliedJobs: jobCount,
                successfulApplications: Math.floor(jobCount * 0.9),
                failedApplications: Math.floor(jobCount * 0.1),
                amountPerJob: 0.99,
                totalAmount: (jobCount * 0.99).toFixed(2)
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
      jobCount,
      totalAmount: (jobCount * 0.99).toFixed(2)
    });
  } catch (error) {
    console.error('Error starting job application process:', error);
    return NextResponse.json(
      { error: 'Failed to start job application process' },
      { status: 500 }
    );
  }
} 
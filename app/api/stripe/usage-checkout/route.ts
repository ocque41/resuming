import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries.server';

export async function POST(request: NextRequest) {
  // Get the user's data from the request
  const data = await request.json();
  const { jobCount = 25, returnUrl = '/dashboard/apply' } = data;

  try {
    // Get the current user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get the user's team
    const userTeamData = await db
      .select({
        id: teams.id,
        name: teams.name,
        stripeCustomerId: teams.stripeCustomerId,
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, user.id))
      .limit(1);

    if (userTeamData.length === 0) {
      return NextResponse.json(
        { error: 'User is not associated with any team' },
        { status: 404 }
      );
    }

    const team = userTeamData[0];
    let stripeCustomerId = team.stripeCustomerId;

    // If the team doesn't have a Stripe customer ID, create one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: team.name,
        email: user.email,
        metadata: {
          teamId: team.id,
        },
      });

      stripeCustomerId = customer.id;

      // Update the team with the Stripe customer ID
      await db
        .update(teams)
        .set({
          stripeCustomerId: customer.id,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    }

    // Calculate the unit amount based on the job count
    const unitAmount = 99; // $0.99 in cents

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Apply to ${jobCount} Jobs`,
              description: 'LinkedIn job application automation',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer: stripeCustomerId,
      success_url: `${new URL(request.url).origin}${returnUrl}?success=true&jobCount=${jobCount}`,
      cancel_url: `${new URL(request.url).origin}${returnUrl}?canceled=true`,
      metadata: {
        teamId: team.id,
        userId: user.id,
        jobCount: jobCount.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 
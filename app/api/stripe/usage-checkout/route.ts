import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries.server';

export async function POST(request: NextRequest) {
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

    // Parse the request body
    const body = await request.json();
    const returnUrl = body.returnUrl || '/dashboard/apply';

    // Create a Stripe customer if one doesn't exist
    let customerId = team[0].stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: user.name || undefined,
        email: user.email || undefined,
        metadata: {
          teamId: team[0].id.toString(),
          userId: user.id.toString(),
        },
      });
      customerId = customer.id;

      // Update the team with the new customer ID
      await db
        .update(teams)
        .set({
          stripeCustomerId: customerId,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team[0].id));
    }

    // Create a Stripe checkout session for setting up usage-based billing
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'setup',
      customer: customerId,
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/stripe/usage-setup?session_id={CHECKOUT_SESSION_ID}&return_to=${encodeURIComponent(returnUrl)}`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}${returnUrl}`,
      client_reference_id: user.id.toString(),
    });

    // Return the checkout URL
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating usage-based checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 
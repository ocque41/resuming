import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { getUser } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { users, teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { plans, type PlanId } from '@/config/stripe';

// Initialize Stripe with proper API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

/**
 * POST /api/stripe/checkout
 * Creates a Stripe checkout session for a user to upgrade their plan
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const planId = body.planId as PlanId;

    if (!planId || !plans[planId]) {
      return NextResponse.json({ message: 'Invalid plan' }, { status: 400 });
    }

    // Get session cookie
    const session = await getUser();

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Get user's team membership
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ message: 'Team membership not found' }, { status: 404 });
    }

    // Get team
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, membership.teamId))
      .limit(1);

    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 });
    }

    // Get plan details
    const plan = plans[planId];

    // Create a checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_email: user.email,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${process.env.BASE_URL}/dashboard/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/dashboard/settings/billing?canceled=true`,
      metadata: {
        userId: user.id.toString(),
        teamId: team.id.toString(),
        planId: planId,
      },
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { message: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/checkout
 * Retrieves a specific checkout session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json({ message: 'Session ID is required' }, { status: 400 });
    }
    
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({ session: checkoutSession });
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    return NextResponse.json(
      { message: 'Error retrieving checkout session' },
      { status: 500 }
    );
  }
}

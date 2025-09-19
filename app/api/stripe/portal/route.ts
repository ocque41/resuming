import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries.server';
import {
  MISSING_STRIPE_CUSTOMER_ERROR,
  createCustomerPortalSession,
} from '@/lib/payments/stripe';

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamData = await getTeamForUser(user.id);
    if (!teamData) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // If teamData is an array, use the first element
    const teamObj = Array.isArray(teamData) ? teamData[0] : teamData;
    if (!teamObj) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const {
      id,
      name,
      createdAt,
      updatedAt,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeProductId,
      planName,
      subscriptionStatus,
    } = teamObj;
    const team = {
      id,
      name,
      createdAt,
      updatedAt,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeProductId,
      planName,
      subscriptionStatus,
    };

    const session = await createCustomerPortalSession(team);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);

    if (
      error instanceof Error &&
      error.message === MISSING_STRIPE_CUSTOMER_ERROR
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}

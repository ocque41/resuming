import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries.server';
import { createCustomerPortalSession } from '@/lib/payments/stripe';

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const team = await getTeamForUser(user.id) as unknown as import('@/lib/db/schema').Team;
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    const { id, name, createdAt, updatedAt, stripeCustomerId, stripeSubscriptionId, stripeProductId, planName, subscriptionStatus } = team;
    const teamObj = { id, name, createdAt, updatedAt, stripeCustomerId, stripeSubscriptionId, stripeProductId, planName, subscriptionStatus };

    const session = await createCustomerPortalSession(teamObj);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}

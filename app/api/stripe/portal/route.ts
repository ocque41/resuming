import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries.server';
import { createCustomerPortalSession } from '@/lib/payments/stripe';

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamData = await getTeamForUser(user.id) as import('@/lib/db/schema').TeamDataWithMembers | null;
    if (!teamData) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Extract only the Team fields (id, name, createdAt, updatedAt, stripeCustomerId, stripeSubscriptionId, stripeProductId, planName, subscriptionStatus)
    const { id, name, createdAt, updatedAt, stripeCustomerId, stripeSubscriptionId, stripeProductId, planName, subscriptionStatus } = teamData;
    const team = { id, name, createdAt, updatedAt, stripeCustomerId, stripeSubscriptionId, stripeProductId, planName, subscriptionStatus };

    const session = await createCustomerPortalSession(team);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}

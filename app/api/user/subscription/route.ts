import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries.server';

export async function GET() {
  try {
    // Get the current user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user's team
    const teamData = await getTeamForUser(user.id);
    if (!teamData) {
      // If no team is found, default to Pro plan
      return NextResponse.json({
        planName: 'Pro',
        subscriptionStatus: null,
        stripeProductId: null,
        stripeSubscriptionId: null,
        stripeCustomerId: null
      });
    }

    // Use any type to access the team data safely
    const team = teamData as any;

    // Return the team's subscription details
    return NextResponse.json({
      planName: team.planName || 'Pro',
      subscriptionStatus: team.subscriptionStatus || null,
      stripeProductId: team.stripeProductId || null,
      stripeSubscriptionId: team.stripeSubscriptionId || null,
      stripeCustomerId: team.stripeCustomerId || null
    });

  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription details' },
      { status: 500 }
    );
  }
} 
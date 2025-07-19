import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries.server';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Define the team structure based on the schema
interface Team {
  id: number;
  name: string;
  planName?: string;
  subscriptionStatus?: string;
  stripeProductId?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function POST() {
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
    const team = await getTeamForUser(user.id) as unknown as Team;
    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check if the user already has the Pro plan
    if (team.planName === 'Pro') {
      return NextResponse.json(
        { message: 'Already on Pro plan, no downgrade needed' }
      );
    }

    // Downgrade the plan to Pro
    await db
      .update(teams)
      .set({
        planName: 'Pro',
        subscriptionStatus: 'active',
        stripeProductId: 'pro-fallback',
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id));

    return NextResponse.json({
      success: true,
      message: 'Successfully downgraded to Pro plan',
      planName: 'Pro'
    });

  } catch (error) {
    console.error('Error downgrading plan:', error);
    return NextResponse.json(
      { error: 'Failed to downgrade plan' },
      { status: 500 }
    );
  }
} 
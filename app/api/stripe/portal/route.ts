import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries.server';
import { createCustomerPortalSession } from '@/lib/payments/stripe';
import { Team } from '@/lib/db/schema';

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const team = await getTeamForUser(user.id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Defensive: If team is an array, use the first element
    const teamObj = Array.isArray(team) ? team[0] : team;
    if (!teamObj) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { teamMembers, ...plainTeam } = teamObj;
    const session = await createCustomerPortalSession(plainTeam as Team);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}

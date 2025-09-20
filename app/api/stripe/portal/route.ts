import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries.server';
import {
  MISSING_STRIPE_CUSTOMER_ERROR,
  createCustomerPortalSession,
} from '@/lib/payments/stripe';

type PortalSessionResult =
  | { url: string }
  | { error: { message: string; status: number } };

async function createPortalSession(): Promise<PortalSessionResult> {
  try {
    const user = await getUser();
    if (!user) {
      return { error: { message: 'Unauthorized', status: 401 } };
    }

    const teamData = await getTeamForUser(user.id);
    if (!teamData) {
      return { error: { message: 'Team not found', status: 404 } };
    }

    const teamObj = Array.isArray(teamData) ? teamData[0] : teamData;
    if (!teamObj) {
      return { error: { message: 'Team not found', status: 404 } };
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

    const userEmail = typeof user.email === 'string' ? user.email : undefined;
    const session = await createCustomerPortalSession(team, { userEmail });

    if (!session.url) {
      return {
        error: {
          message: 'Stripe did not return a billing portal URL.',
          status: 502,
        },
      };
    }

    return { url: session.url };
  } catch (error) {
    console.error('Error creating customer portal session:', error);

    if (
      error instanceof Error &&
      error.message === MISSING_STRIPE_CUSTOMER_ERROR
    ) {
      return { error: { message: error.message, status: 400 } };
    }

    return {
      error: {
        message: 'Failed to create customer portal session',
        status: 500,
      },
    };
  }
}

export async function POST() {
  const result = await createPortalSession();

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status },
    );
  }

  return NextResponse.json({ url: result.url });
}

export async function GET() {
  const result = await createPortalSession();

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status },
    );
  }

  return NextResponse.redirect(result.url, { status: 303 });
}

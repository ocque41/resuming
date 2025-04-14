import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { teams, teamMembers } from '@/lib/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import { getUser } from '@/lib/db/queries.server';
import Stripe from 'stripe';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');
  const returnTo = searchParams.get('return_to') || '/dashboard/apply';

  if (!sessionId) {
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  try {
    // Get the session details from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['setup_intent', 'customer'],
    });

    if (!session.customer || typeof session.customer === 'string') {
      throw new Error('Invalid customer data from Stripe.');
    }

    const customerId = session.customer.id;
    
    // Handle the setup intent correctly with type checking
    if (!session.setup_intent || typeof session.setup_intent === 'string') {
      throw new Error('No setup intent found for this session.');
    }
    
    const setupIntentId = session.setup_intent.id;

    // Get the setup intent to retrieve the payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
      expand: ['payment_method'],
    });

    const paymentMethodId = setupIntent.payment_method;
    if (!paymentMethodId || typeof paymentMethodId === 'string') {
      throw new Error('No payment method found in setup intent.');
    }

    // Get current user
    const user = await getUser();
    if (!user) {
      throw new Error('User not authenticated.');
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
      throw new Error('User is not associated with any team.');
    }

    // Update the team with usage-based pricing enabled using SQL directly
    // as Drizzle might not have the column in the schema yet
    await sql`
      UPDATE teams 
      SET usage_based_pricing = true, 
          updated_at = NOW() 
      WHERE id = ${userTeam[0].teamId}
    `;

    // Log the redirect URL for debugging
    console.log(`Redirecting to: ${returnTo}`);
    
    // Use the current origin for the redirect
    const origin = new URL(request.url).origin;
    const redirectUrl = new URL(returnTo, origin);
    
    // Redirect back to the apply page
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error setting up usage-based pricing:', error);
    
    // Use the current origin for the error redirect
    const origin = new URL(request.url).origin;
    const errorUrl = new URL('/error?message=setup-failed', origin);
    
    return NextResponse.redirect(errorUrl);
  }
} 
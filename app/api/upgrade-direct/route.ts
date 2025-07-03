import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries.server';
import { stripe } from '@/lib/payments/stripe';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const priceId =
      searchParams.get('priceId') ||
      process.env.STRIPE_PRO_PRICE_ID ||
      'price_pro_fallback';
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    // Get the current user
    const user = await getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}&return_to=${encodeURIComponent(returnUrl)}`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}${returnUrl}`,
      client_reference_id: user.id.toString(),
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          tier: 'pro',
          features: JSON.stringify({
            cv_uploads: 100,
            ats_analyses: 50,
            optimizations: 30,
            priority: 1
          })
        }
      },
    });

    // Redirect to the checkout URL
    return NextResponse.redirect(session.url || new URL(returnUrl, request.url));
  } catch (error) {
    console.error('Error creating direct checkout session:', error);
    return NextResponse.redirect(new URL('/dashboard?error=checkout_failed', request.url));
  }
} 
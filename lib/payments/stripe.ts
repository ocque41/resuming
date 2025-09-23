import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getUser,
  setTeamStripeCustomerId,
  updateTeamSubscription,
} from '@/lib/db/queries.server';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

let cachedBillingPortalConfigurationId =
  process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID ?? null;
let pendingBillingPortalConfigurationCreation: Promise<string | null> | null =
  null;

export async function createCheckoutSession({
  team,
  priceId,
  returnUrl = '/dashboard',
}: {
  team: Team | null;
  priceId: string;
  returnUrl?: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}&return_to=${encodeURIComponent(returnUrl)}`,
    cancel_url: `${process.env.BASE_URL}${returnUrl}`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 1, // 24 hours trial
      metadata: {
        tier: 'pro',
        features: JSON.stringify({
          cv_uploads: 20,
          ats_analyses: 10,
          optimizations: 7,
          priority: 2
        })
      }
    },
  });

  redirect(session.url!);
}

function resolveBaseUrl() {
  const baseUrl =
    process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const url = new URL(baseUrl);
    return url.origin;
  } catch (error) {
    console.warn(
      'Invalid BASE_URL configured for Stripe billing portal redirect. Falling back to http://localhost:3000',
      error,
    );
    return 'http://localhost:3000';
  }
}

export const MISSING_STRIPE_CUSTOMER_ERROR = 'Team is missing a Stripe customer.';
export const MISSING_STRIPE_PORTAL_CONFIGURATION_ERROR =
  'Stripe billing portal configuration is missing.';

interface CreateCustomerPortalSessionOptions {
  userEmail?: string;
}

async function createBillingPortalConfiguration() {
  if (pendingBillingPortalConfigurationCreation) {
    return pendingBillingPortalConfigurationCreation;
  }

  pendingBillingPortalConfigurationCreation = (async () => {
    try {
      const baseUrl = resolveBaseUrl();
      const configuration = await stripe.billingPortal.configurations.create({
        business_profile: {
          privacy_policy_url: `${baseUrl}/privacy`,
          terms_of_service_url: `${baseUrl}/terms`,
        },
        default_return_url: `${baseUrl}/dashboard`,
        features: {
          customer_update: {
            allowed_updates: ['email'],
            enabled: true,
          },
          invoice_history: {
            enabled: true,
          },
          payment_method_update: {
            enabled: true,
          },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
          },
          subscription_update: {
            default_allowed_updates: [],
            enabled: false,
            products: [],
          },
        },
      });

      cachedBillingPortalConfigurationId = configuration.id;
      process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID = configuration.id;

      return configuration.id;
    } catch (error) {
      console.error('Failed to create Stripe billing portal configuration', error);
      return null;
    } finally {
      pendingBillingPortalConfigurationCreation = null;
    }
  })();

  return pendingBillingPortalConfigurationCreation;
}

async function findActiveBillingPortalConfigurationId() {
  if (cachedBillingPortalConfigurationId) {
    return cachedBillingPortalConfigurationId;
  }

  try {
    const configurations = await stripe.billingPortal.configurations.list({
      limit: 20,
    });

    const activeConfiguration = configurations.data.find(
      (configuration) => configuration.active,
    );

    if (activeConfiguration?.id) {
      cachedBillingPortalConfigurationId = activeConfiguration.id;
      process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID = activeConfiguration.id;
      return activeConfiguration.id;
    }

    return await createBillingPortalConfiguration();
  } catch (error) {
    console.error('Failed to list Stripe billing portal configurations', error);
    return null;
  }
}

export async function createCustomerPortalSession(
  team: Team,
  { userEmail }: CreateCustomerPortalSessionOptions = {},
) {
  let stripeCustomerId = team.stripeCustomerId;

  if (!stripeCustomerId && team.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        team.stripeSubscriptionId,
      );
      const subscriptionCustomer = subscription.customer;

      if (typeof subscriptionCustomer === 'string') {
        stripeCustomerId = subscriptionCustomer;
        await setTeamStripeCustomerId(team.id, subscriptionCustomer);
      }
    } catch (error) {
      console.error(
        'Failed to recover Stripe customer ID from subscription',
        error,
      );
    }
  }

  if (!stripeCustomerId && userEmail) {
    try {
      const customerSearch = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      const matchingCustomer = customerSearch.data[0];
      if (matchingCustomer?.id) {
        stripeCustomerId = matchingCustomer.id;
        await setTeamStripeCustomerId(team.id, matchingCustomer.id);
      }
    } catch (error) {
      console.error('Failed to recover Stripe customer ID from email lookup', error);
    }
  }

  if (!stripeCustomerId) {
    throw new Error(MISSING_STRIPE_CUSTOMER_ERROR);
  }

  const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
    customer: stripeCustomerId,
    return_url: `${resolveBaseUrl()}/dashboard`,
  };

  const resolvedPortalConfigurationId =
    await findActiveBillingPortalConfigurationId();
  if (resolvedPortalConfigurationId) {
    sessionParams.configuration = resolvedPortalConfigurationId;
  }

  let session: Stripe.BillingPortal.Session;

  try {
    session = await stripe.billingPortal.sessions.create(sessionParams);
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.message.includes('No configuration provided')
    ) {
      console.error(
        'Stripe billing portal configuration missing. Attempting to provision a default configuration automatically.',
        error,
      );

      const fallbackConfigurationId = await findActiveBillingPortalConfigurationId();

      if (fallbackConfigurationId) {
        try {
          sessionParams.configuration = fallbackConfigurationId;
          session = await stripe.billingPortal.sessions.create({
            ...sessionParams,
            configuration: fallbackConfigurationId,
          });
        } catch (retryError) {
          console.error(
            'Retrying billing portal session creation with fallback configuration failed.',
            retryError,
          );
          throw new Error(MISSING_STRIPE_PORTAL_CONFIGURATION_ERROR);
        }
      } else {
        throw new Error(MISSING_STRIPE_PORTAL_CONFIGURATION_ERROR);
      }
    } else {
      throw error;
    }
  }

  if (!session.url) {
    throw new Error('Stripe did not return a billing portal URL.');
  }

  return session;
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
) {
  const features = subscription.metadata?.features 
    ? JSON.parse(subscription.metadata.features)
    : null;
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  if (status === 'active' || status === 'trialing') {
    const plan = subscription.items.data[0]?.plan;
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: plan?.product as string,
      planName: (plan?.product as Stripe.Product).name,
      subscriptionStatus: status,
    });
  } else if (status === 'canceled' || status === 'unpaid') {
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus: status,
    });
  }
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring',
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days,
  }));
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id,
  }));
}

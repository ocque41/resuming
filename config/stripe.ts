/**
 * Subscription plan configuration
 */

export type PlanId = 'free' | 'basic' | 'pro' | 'enterprise';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  features: string[];
  stripePriceId: string;
  price: number;
  interval: 'month' | 'year';
  currency?: string;
  highlight?: boolean;
}

// Define all available plans
export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'For individuals just getting started',
    features: [
      'Upload up to 3 CVs',
      'Basic keyword analysis',
      'CV storage',
      'Export as PDF'
    ],
    stripePriceId: '', // Free plan doesn't have a Stripe price ID
    price: 0,
    interval: 'month',
    currency: 'USD',
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'For job seekers who want to optimize their CVs',
    features: [
      'Everything in Free',
      'Upload up to 10 CVs',
      'Advanced keyword analysis',
      'Compare against job descriptions',
      'ATS compatibility check'
    ],
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || 'price_1Ow1J8FYYYXM77wGGbZYyhZk',
    price: 9.99,
    interval: 'month',
    currency: 'USD',
    highlight: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals who want the best results',
    features: [
      'Everything in Basic',
      'Unlimited CV uploads',
      'AI CV optimization suggestions',
      'Custom CV templates',
      'Priority support'
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_1Ow1JKFYYYXM77wGYFPZNmgb',
    price: 19.99,
    interval: 'month',
    currency: 'USD',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For teams and companies',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Admin dashboard',
      'API access',
      'Dedicated account manager'
    ],
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_1Ow1JcFYYYXM77wGCHuYGkZx',
    price: 49.99,
    interval: 'month',
    currency: 'USD',
  },
};

// Helper function to get plan by Stripe Price ID
export function getPlanByPriceId(priceId: string): Plan | undefined {
  return Object.values(plans).find(plan => plan.stripePriceId === priceId);
}

// Helper function to compare plan levels
export function isPlanEqualOrHigher(userPlan: PlanId, requiredPlan: PlanId): boolean {
  const planLevels: Record<PlanId, number> = {
    'free': 0,
    'basic': 1,
    'pro': 2,
    'enterprise': 3
  };
  
  return planLevels[userPlan] >= planLevels[requiredPlan];
} 
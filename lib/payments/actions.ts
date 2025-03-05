'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { withTeam } from '@/lib/auth/middleware';

export const checkoutAction = withTeam(async (formData, team) => {
  const priceId = formData.get('priceId') as string;
  if (!priceId) {
    throw new Error('Price ID is required');
  }
  
  // Get the returnUrl from the form
  const returnUrl = formData.get('returnUrl') as string || '/dashboard';
  
  await createCheckoutSession({ team: team, priceId, returnUrl });
});

export const customerPortalAction = withTeam(async (_, team) => {
  const portalSession = await createCustomerPortalSession(team);
  redirect(portalSession.url);
});

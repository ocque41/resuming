'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface UseManageSubscriptionOptions {
  fallbackPath?: string;
}

interface UseManageSubscriptionResult {
  openCustomerPortal: () => Promise<void>;
  isLoading: boolean;
}

export function useManageSubscription(
  { fallbackPath = '/dashboard/pricing' }: UseManageSubscriptionOptions = {}
): UseManageSubscriptionResult {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const openCustomerPortal = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });

      if (!response.ok) {
        let errorMessage = 'Please try again or contact support.';

        try {
          const data = await response.json();
          if (data?.error && typeof data.error === 'string') {
            errorMessage = data.error;
          }
        } catch (parseError) {
          console.error('Failed to parse billing portal error response:', parseError);
        }

        toast({
          title: 'Unable to open the billing portal',
          description: errorMessage,
          variant: 'destructive',
        });

        if (fallbackPath) {
          router.push(fallbackPath);
        }

        return;
      }

      const data = await response.json();

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      toast({
        title: 'Unable to open the billing portal',
        description: 'Stripe did not return a redirect URL.',
        variant: 'destructive',
      });

      if (fallbackPath) {
        router.push(fallbackPath);
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      toast({
        title: 'Unable to open the billing portal',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });

      if (fallbackPath) {
        router.push(fallbackPath);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fallbackPath, router, toast]);

  return { openCustomerPortal, isLoading };
}

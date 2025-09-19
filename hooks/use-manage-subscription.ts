'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const openCustomerPortal = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });

      if (response.ok) {
        const data = await response.json();

        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }

      router.push(fallbackPath);
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      router.push(fallbackPath);
    } finally {
      setIsLoading(false);
    }
  }, [fallbackPath, router]);

  return { openCustomerPortal, isLoading };
}

// app/(dashboard)/dashboard/billing-button.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useManageSubscription } from '@/hooks/use-manage-subscription';

interface BillingButtonProps {
  variant?: 'primary' | 'secondary' | 'unstyled';
  className?: string;
  label?: string;
  loadingLabel?: string;
  fallbackPath?: string;
}

export default function BillingButton({
  variant = 'primary',
  className,
  label = 'Manage My Subscription',
  loadingLabel = 'Redirecting...',
  fallbackPath = '/dashboard/pricing',
}: BillingButtonProps) {
  const { openCustomerPortal, isLoading } = useManageSubscription({
    fallbackPath,
  });

  const variantClasses =
    variant === 'primary'
      ? 'bg-[#584235] hover:bg-[#6b4f3b] text-white'
      : variant === 'secondary'
        ? 'bg-gray-300 text-black'
        : '';

  return (
    <Button
      onClick={openCustomerPortal}
      className={cn(
        variantClasses,
        'py-2 px-4 rounded-md',
        isLoading && 'opacity-50 cursor-not-allowed',
        className,
      )}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

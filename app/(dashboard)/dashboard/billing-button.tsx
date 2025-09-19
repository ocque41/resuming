// app/(dashboard)/dashboard/billing-button.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useManageSubscription } from '@/hooks/use-manage-subscription';

interface BillingButtonProps {
  variant?: 'primary' | 'secondary';
}

export default function BillingButton({ variant = 'primary' }: BillingButtonProps) {
  const { openCustomerPortal, isLoading } = useManageSubscription({
    fallbackPath: '/dashboard/pricing',
  });

  const buttonStyles = variant === 'primary'
    ? 'bg-[#584235] hover:bg-[#6b4f3b] text-white'
    : 'bg-gray-300 text-black';

  return (
    <Button
      onClick={openCustomerPortal}
      className={`${buttonStyles} py-2 px-4 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </>
      ) : (
        'Manage My Subscription'
      )}
    </Button>
  );
}

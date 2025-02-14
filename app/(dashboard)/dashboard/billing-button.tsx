'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { customerPortalAction } from '@/lib/payments/actions';

export default function BillingButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleBilling = async () => {
    setIsLoading(true);
    try {
      await customerPortalAction();
    } catch (error) {
      console.error('Failed to redirect to billing portal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleBilling}
      className="bg-[#584235] hover:bg-[#6b4f3b] text-white"
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Redirecting...
        </>
      ) : (
        'Manage Billing'
      )}
    </Button>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { customerPortalAction } from '@/lib/payments/actions';

export default function BillingButton({ variant = "primary" }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleBilling = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      // Add necessary data to formData if required
      await customerPortalAction(formData);
    } catch (error) {
      console.error('Failed to redirect to billing portal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonStyles = variant === "primary"
    ? "bg-[#584235] hover:bg-[#6b4f3b] text-white"
    : "bg-gray-300 text-black";

  return (
    <Button
      onClick={handleBilling}
      className={`${buttonStyles} py-2 px-4 rounded-md ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
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

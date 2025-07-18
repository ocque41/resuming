// app/(dashboard)/dashboard/billing-button.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BillingButton({ variant = "primary" }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleBilling = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      router.push('/dashboard/pricing');
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      router.push('/dashboard/pricing');
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
        'Manage Subscription'
      )}
    </Button>
  );
}

"use client";

import React, { createContext, useContext, ReactNode } from 'react';

// Define types
interface StripePrice {
  id: string;
  productId: string;
  unitAmount: number | null;
  currency?: string;
  interval?: string;
  trialPeriodDays?: number | null;
}

interface StripeProduct {
  id: string;
  name: string;
}

// Define context type
interface PricingContextType {
  prices: StripePrice[];
  products: StripeProduct[];
  isLoading: boolean;
  error: string | null;
}

// Create context with default values
const PricingContext = createContext<PricingContextType>({
  prices: [],
  products: [],
  isLoading: false,
  error: null
});

// Hook to use the pricing context
export const usePricing = () => useContext(PricingContext);

// Provider component
interface PricingProviderProps {
  children: ReactNode;
  prices: StripePrice[];
  products: StripeProduct[];
  isLoading?: boolean;
  error?: string | null;
}

export function PricingProvider({
  children,
  prices,
  products,
  isLoading = false,
  error = null
}: PricingProviderProps) {
  const value = {
    prices,
    products,
    isLoading,
    error
  };

  return (
    <PricingContext.Provider value={value}>
      {children}
    </PricingContext.Provider>
  );
}

export default PricingContext; 
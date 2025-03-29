"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function UpgradeButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Always use the hardcoded Moonlighting price ID
      const moonlightingPriceId = "price_1R5vvRFYYYXM77wG8jVM2pGC";
      console.log('Initiating Moonlighting checkout, Price ID:', moonlightingPriceId);
      
      // Create form data
      const formData = new FormData();
      formData.append('priceId', moonlightingPriceId);
      formData.append('returnUrl', '/dashboard');

      // Submit form to server action
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to initiate checkout' }));
        throw new Error(errorData.message || 'Failed to initiate checkout');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Checkout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] rounded-xl py-6 px-8 flex items-center justify-center transition-colors duration-300 text-lg font-bold shadow-xl border-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-5 w-5" />
              <span className="font-safiro">Processing...</span>
            </>
          ) : (
            <>
              <span className="font-safiro">Upgrade to Moonlighting</span>
              <motion.div
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowRight className="ml-2 h-5 w-5" />
              </motion.div>
            </>
          )}
        </Button>
      </motion.div>
      
      {error && (
        <div className="mt-2 bg-red-500/10 p-2 rounded-lg text-red-400 text-sm border border-red-900/30">
          {error}
        </div>
      )}
      
      <div className="mt-1 text-xs text-center text-white/70">
        Price ID: price_1R5vvRFYYYXM77wG8jVM2pGC
      </div>
    </div>
  );
} 
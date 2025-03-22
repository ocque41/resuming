"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

// Define interface for the reCAPTCHA v3 props
interface ReCaptchaV3Props {
  action: string;
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
  siteKey?: string;
  className?: string;
}

// Define window with reCAPTCHA properties
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
    onRecaptchaLoaded: () => void;
  }
}

/**
 * ReCaptcha V3 component that loads the reCAPTCHA script and executes verification
 * without requiring user interaction.
 */
export function ReCaptchaV3({
  action,
  onVerify,
  onError,
  siteKey,
  className = ''
}: ReCaptchaV3Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Get site key from props or environment
  const actualSiteKey = siteKey || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  // Function to load the reCAPTCHA script
  const loadReCaptchaScript = useCallback(() => {
    // Skip if script is already loaded
    if (window.grecaptcha) {
      setLoading(false);
      return;
    }

    // Validate site key
    if (!actualSiteKey) {
      const error = new Error('reCAPTCHA site key is missing');
      setError(error);
      onError?.(error);
      setLoading(false);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${actualSiteKey}`;
    script.async = true;
    script.defer = true;
    
    // Set up callbacks
    script.onload = () => {
      window.grecaptcha.ready(() => {
        setLoading(false);
      });
    };

    script.onerror = () => {
      const error = new Error('Error loading reCAPTCHA script');
      setError(error);
      onError?.(error);
      setLoading(false);
    };

    // Add script to document
    document.head.appendChild(script);

    // Clean up function
    return () => {
      document.head.removeChild(script);
    };
  }, [actualSiteKey, onError]);

  // Function to execute reCAPTCHA verification
  const executeReCaptcha = useCallback(async () => {
    if (!window.grecaptcha) {
      const error = new Error('reCAPTCHA has not loaded yet');
      setError(error);
      onError?.(error);
      return;
    }

    try {
      const token = await window.grecaptcha.execute(actualSiteKey, { action });
      console.log(`reCAPTCHA v3 token generated for action: ${action}`);
      onVerify(token);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to execute reCAPTCHA');
      setError(error);
      onError?.(error);
      console.error('reCAPTCHA execution error:', error);
    }
  }, [actualSiteKey, action, onVerify, onError]);

  // Load script when component mounts
  useEffect(() => {
    loadReCaptchaScript();
  }, [loadReCaptchaScript]);

  // Execute reCAPTCHA when script is loaded
  useEffect(() => {
    if (!loading && !error) {
      executeReCaptcha();
    }
  }, [loading, error, executeReCaptcha]);

  // Show loading indicator while script is loading
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-2 ${className}`}>
        <Loader2 className="animate-spin h-4 w-4 mr-2 text-gray-500" />
        <span className="text-sm text-gray-500">Verifying...</span>
      </div>
    );
  }

  // Show error message if something went wrong
  if (error) {
    return (
      <div className={`text-sm text-red-500 p-2 ${className}`}>
        Error: {error.message}
      </div>
    );
  }

  // Return null in the successful case - v3 is invisible to users
  return null;
}

/**
 * Custom hook to use reCAPTCHA v3 in functional components
 */
export function useReCaptchaV3() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Function to execute reCAPTCHA verification
  const executeReCaptcha = useCallback(async (action: string) => {
    setLoading(true);
    setError(null);
    
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    if (!siteKey) {
      const error = new Error('reCAPTCHA site key is missing');
      setError(error);
      setLoading(false);
      return null;
    }

    try {
      if (!window.grecaptcha) {
        throw new Error('reCAPTCHA is not loaded');
      }

      // Execute reCAPTCHA with specified action
      await new Promise<void>((resolve) => window.grecaptcha.ready(() => resolve()));
      const token = await window.grecaptcha.execute(siteKey, { action });
      setToken(token);
      setLoading(false);
      return token;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('reCAPTCHA failed');
      setError(error);
      setLoading(false);
      return null;
    }
  }, []);

  return { executeReCaptcha, token, error, loading };
}

/**
 * Wrapper component that loads reCAPTCHA v3 script only once for the entire app
 */
export function ReCaptchaV3Provider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  useEffect(() => {
    // Skip if already loaded or no site key
    if (loaded || !siteKey || typeof window === 'undefined') return;
    
    // Define global callback
    window.onRecaptchaLoaded = () => setLoaded(true);
    
    // Add script to document
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [siteKey, loaded]);

  return <>{children}</>;
}

export default ReCaptchaV3; 
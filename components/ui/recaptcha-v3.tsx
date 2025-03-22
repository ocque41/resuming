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

// Add helper for environment variables
// This helps ensure we can access environment variables in different contexts
const getEnv = () => {
  // Ensure window.__env exists
  if (typeof window !== 'undefined') {
    // Initialize __env object if it doesn't exist
    if (!window.__env) {
      window.__env = {};
    }
    
    // Try to get from window.__env if it exists (for runtime injection)
    if (window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      return {
        NEXT_PUBLIC_RECAPTCHA_SITE_KEY: window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      };
    }
    
    // Try to get from regular Next.js env
    if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      return {
        NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      };
    }
  }
  
  // Return empty object as fallback
  return { NEXT_PUBLIC_RECAPTCHA_SITE_KEY: '' };
};

// Define window with reCAPTCHA properties
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
    onRecaptchaLoaded: () => void;
    _recaptchaLoadedCallback?: () => void;
    _recaptchaStatus?: {
      loaded: boolean;
      error: Error | null;
      timestamp: number;
    };
    __env?: {
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY?: string;
      [key: string]: any;
    };
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
  
  // Get site key from props, environment, or URL query parameter
  const actualSiteKey = useCallback(() => {
    // First check props
    if (siteKey) return siteKey;
    
    // Then check environment variables (with helper)
    const env = getEnv();
    if (env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      return env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    }
    
    // Try to get from URL if we're in the browser
    if (typeof window !== 'undefined') {
      // Make sure window.__env exists
      if (!window.__env) {
        window.__env = {};
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const urlSiteKey = urlParams.get('recaptchaKey');
      if (urlSiteKey) {
        // Save to window.__env for future use
        window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = urlSiteKey;
        return urlSiteKey;
      }
    }
    
    return '';
  }, [siteKey]);

  // Function to load the reCAPTCHA script
  const loadReCaptchaScript = useCallback(() => {
    // Check for a global status object to avoid duplicate script loads
    if (typeof window !== 'undefined') {
      // Initialize status object if it doesn't exist
      if (!window._recaptchaStatus) {
        window._recaptchaStatus = {
          loaded: false,
          error: null,
          timestamp: Date.now()
        };
      }
      
      // If already loaded, update local state
      if (window._recaptchaStatus.loaded && window.grecaptcha) {
        console.log("reCAPTCHA: Using already loaded script");
        setLoading(false);
        return;
      }
      
      // If there was a previous error recently, don't try to load again too quickly
      if (window._recaptchaStatus.error && (Date.now() - window._recaptchaStatus.timestamp < 5000)) {
        console.warn("reCAPTCHA: Recent error, waiting before retry");
        setError(window._recaptchaStatus.error);
        setLoading(false);
        return;
      }
    }

    // Skip if script is already loaded
    if (window.grecaptcha) {
      setLoading(false);
      return;
    }

    // Get the site key using our helper
    const key = actualSiteKey();
    
    // Validate site key
    if (!key) {
      const error = new Error('reCAPTCHA site key is missing');
      console.error("reCAPTCHA: Site key is missing", { 
        fromProps: !!siteKey,
        fromEnv: !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
        fromWindowEnv: typeof window !== 'undefined' && !!window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      });
      setError(error);
      onError?.(error);
      setLoading(false);
      
      if (typeof window !== 'undefined') {
        window._recaptchaStatus = {
          loaded: false,
          error: error,
          timestamp: Date.now()
        };
      }
      
      return;
    }

    console.log(`reCAPTCHA: Loading script with site key starting with ${key.substring(0, 5)}`);

    // Create script element
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${key}`;
    script.async = true;
    script.defer = true;
    
    // Create a global callback that can be referenced for clean-up
    window._recaptchaLoadedCallback = () => {
      console.log("reCAPTCHA: Script loaded successfully");
      window._recaptchaStatus = {
        loaded: true,
        error: null,
        timestamp: Date.now()
      };
      setLoading(false);
    };
    
    // Set up callbacks
    script.onload = () => {
      window.grecaptcha.ready(window._recaptchaLoadedCallback || (() => setLoading(false)));
    };

    script.onerror = (event) => {
      const error = new Error('Error loading reCAPTCHA script');
      console.error("reCAPTCHA: Script loading error", event);
      
      if (typeof window !== 'undefined') {
        window._recaptchaStatus = {
          loaded: false,
          error: error,
          timestamp: Date.now()
        };
      }
      
      setError(error);
      onError?.(error);
      setLoading(false);
    };

    // Add script to document
    document.head.appendChild(script);

    // Clean up function
    return () => {
      // Only remove if it's the one we added
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [actualSiteKey, onError, siteKey]);

  // Function to execute reCAPTCHA verification
  const executeReCaptcha = useCallback(async () => {
    if (!window.grecaptcha) {
      const error = new Error('reCAPTCHA has not loaded yet');
      console.error("reCAPTCHA: grecaptcha object not available");
      setError(error);
      onError?.(error);
      return;
    }

    try {
      console.log(`reCAPTCHA: Executing verification for action "${action}"`);
      
      // Make sure grecaptcha is ready
      await new Promise<void>((resolve) => {
        if (window.grecaptcha) {
          window.grecaptcha.ready(() => resolve());
        } else {
          resolve(); // Resolve anyway to avoid hanging
        }
      });
      
      const key = actualSiteKey();
      const token = await window.grecaptcha.execute(key, { action });
      
      if (!token) {
        throw new Error('reCAPTCHA execution returned empty token');
      }
      
      console.log(`reCAPTCHA: Token generated successfully (length: ${token.length})`);
      onVerify(token);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to execute reCAPTCHA');
      console.error('reCAPTCHA execution error:', error);
      setError(error);
      onError?.(error);
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
  const [initialized, setInitialized] = useState<boolean>(false);

  // Initialize the reCAPTCHA script on first load
  useEffect(() => {
    // Skip if already initialized
    if (initialized) return;

    // Get site key with our helper
    const env = getEnv();
    const siteKey = env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    if (!siteKey) {
      console.error("reCAPTCHA hook: No site key available");
      setError(new Error('reCAPTCHA site key is missing'));
      return;
    }

    // Check if script is already loaded
    if (typeof window !== 'undefined' && window.grecaptcha) {
      console.log("reCAPTCHA hook: Script already loaded");
      setInitialized(true);
      return;
    }

    // Load script if not already loaded
    setLoading(true);
    
    // Check for existing script tag
    const existingScript = document.querySelector(`script[src*="recaptcha/api.js"]`);
    
    if (existingScript) {
      console.log("reCAPTCHA hook: Script tag already exists");
      // Wait for it to be ready
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          setLoading(false);
          setInitialized(true);
        });
      } else {
        // Set a timeout in case it never loads
        setTimeout(() => {
          if (!window.grecaptcha) {
            setError(new Error('reCAPTCHA failed to initialize'));
            setLoading(false);
          }
        }, 5000);
      }
      return;
    }

    console.log("reCAPTCHA hook: Loading script");
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log("reCAPTCHA hook: Script loaded");
      window.grecaptcha.ready(() => {
        console.log("reCAPTCHA hook: Ready");
        setLoading(false);
        setInitialized(true);
      });
    };

    script.onerror = () => {
      console.error("reCAPTCHA hook: Script failed to load");
      setError(new Error('Failed to load reCAPTCHA script'));
      setLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup only if we added the script
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [initialized]);

  // Function to execute reCAPTCHA verification
  const executeReCaptcha = useCallback(async (action: string) => {
    setLoading(true);
    setError(null);
    
    // Get site key with our helper
    const env = getEnv();
    const siteKey = env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    if (!siteKey) {
      const error = new Error('reCAPTCHA site key is missing');
      console.error("reCAPTCHA execute: No site key");
      setError(error);
      setLoading(false);
      return null;
    }

    try {
      if (!window.grecaptcha) {
        console.error("reCAPTCHA execute: grecaptcha not loaded");
        throw new Error('reCAPTCHA is not loaded');
      }

      console.log(`reCAPTCHA execute: Starting for action "${action}"`);
      
      // Execute reCAPTCHA with specified action
      await new Promise<void>((resolve) => {
        const readyCallback = () => {
          console.log("reCAPTCHA execute: Ready");
          resolve();
        };
        
        if (window.grecaptcha) {
          window.grecaptcha.ready(readyCallback);
        } else {
          console.warn("reCAPTCHA execute: grecaptcha disappeared");
          setTimeout(resolve, 100); // Resolve anyway to prevent hanging
        }
      });
      
      console.log("reCAPTCHA execute: Calling execute");
      const token = await window.grecaptcha.execute(siteKey, { action });
      
      if (!token) {
        console.error("reCAPTCHA execute: Empty token returned");
        throw new Error('Empty token returned');
      }
      
      console.log(`reCAPTCHA execute: Token generated (length: ${token.length})`);
      setToken(token);
      setLoading(false);
      return token;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('reCAPTCHA failed');
      console.error("reCAPTCHA execute error:", err);
      setError(error);
      setLoading(false);
      return null;
    }
  }, []);

  return { executeReCaptcha, token, error, loading, initialized };
}

/**
 * Wrapper component that loads reCAPTCHA v3 script only once for the entire app
 */
export function ReCaptchaV3Provider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  
  // Get site key with our helper
  const env = getEnv();
  const siteKey = env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  useEffect(() => {
    // Skip if already loaded or no site key
    if (loaded || !siteKey || typeof window === 'undefined') return;
    
    // Check if script is already loaded
    if (window.grecaptcha) {
      console.log("ReCaptchaV3Provider: Script already loaded");
      setLoaded(true);
      return;
    }
    
    console.log("ReCaptchaV3Provider: Loading script");
    
    // Define global callback
    window.onRecaptchaLoaded = () => {
      console.log("ReCaptchaV3Provider: Script loaded via callback");
      setLoaded(true);
    };
    
    // Add script to document
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log("ReCaptchaV3Provider: Script onload event");
      window.grecaptcha.ready(() => {
        console.log("ReCaptchaV3Provider: Ready");
        setLoaded(true);
        if (window.onRecaptchaLoaded) {
          window.onRecaptchaLoaded();
        }
      });
    };
    
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [siteKey, loaded]);

  return <>{children}</>;
}

export default ReCaptchaV3; 
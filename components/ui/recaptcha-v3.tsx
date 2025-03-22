"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Loader2 } from 'lucide-react';
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha/actions';
import { getRecaptchaConfigStatus, isUsingTestKeys } from '@/lib/recaptcha/domain-check';

// Define interface for the reCAPTCHA v3 props
interface ReCaptchaV3Props {
  action?: string;
  siteKey?: string;
  onToken?: (token: string) => void;
  onError?: (error: Error) => void;
  /**
   * Whether to automatically refresh the token periodically
   * Tokens expire after 2 minutes, so this can help ensure 
   * fresh tokens are available
   */
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  /**
   * Flag to skip loading recaptcha in some development scenarios 
   * where you don't want to hit the recaptcha API
   */
  skipForDevelopment?: boolean;
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

export function ReCaptchaV3({
  action = RECAPTCHA_ACTIONS.GENERIC, // Use consistent action name from our constants
  siteKey,
  onToken,
  onError,
  autoRefresh = false,
  refreshInterval = 110000, // just under 2 minutes
  skipForDevelopment = false
}: ReCaptchaV3Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const executingRef = useRef(false);

  // Check if we're in a development environment and should skip recaptcha
  const isDevelopment = process.env.NODE_ENV === 'development';
  const shouldSkip = isDevelopment && skipForDevelopment;

  // Get proper site key with improved error handling
  const actualSiteKey = useCallback(() => {
    // Check if we have a valid site key as a prop
    if (siteKey && siteKey.length > 10) {
      return siteKey;
    }

    // Check if we need to skip altogether for development
    if (shouldSkip) {
      console.log('Skipping reCAPTCHA in development mode');
      return 'development-skip';
    }

    // Try to get the site key from environment
    const envSiteKey = 
      typeof window !== 'undefined' && window.__env && window.__env.RECAPTCHA_SITE_KEY 
        ? window.__env.RECAPTCHA_SITE_KEY 
        : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    // Check if we're using test keys and log warning if appropriate
    if (envSiteKey && isUsingTestKeys()) {
      console.warn(
        'Using Google reCAPTCHA test keys. These should not be used in production!'
      );
    }

    // Check configuration status for more detailed logs
    if (!envSiteKey || envSiteKey.length < 10) {
      const configStatus = getRecaptchaConfigStatus();
      console.error(
        'ReCAPTCHA configuration issue:',
        configStatus
      );
    }

    return envSiteKey;
  }, [siteKey, shouldSkip]);

  // Execute reCAPTCHA with improved error handling and retries
  const executeReCaptcha = useCallback(async (): Promise<string | null> => {
    if (shouldSkip) {
      console.log('Skipping reCAPTCHA execution in development mode');
      return 'development-dummy-token';
    }

    const key = actualSiteKey();
    if (!key || key.length < 10) {
      const error = new Error(`Cannot execute reCAPTCHA: Invalid site key`);
      console.error(error);
      setError(error);
      onError?.(error);
      return null;
    }

    // Prevent concurrent executions
    if (executingRef.current) {
      console.log('reCAPTCHA execution already in progress, skipping');
      return null;
    }

    try {
      executingRef.current = true;
      console.log(`Executing reCAPTCHA for action: ${action}`);

      if (!window.grecaptcha || !window.grecaptcha.execute) {
        throw new Error('reCAPTCHA not loaded yet');
      }

      // Use the execute method with sitekey and action
      const token = await window.grecaptcha.execute(key, { action });
      console.log(`reCAPTCHA token received: ${token.substring(0, 10)}...`);
      
      // Only call onToken if token is valid (non-empty string)
      if (token && typeof token === 'string' && token.length > 0) {
        onToken?.(token);
        return token;
      } else {
        throw new Error('Received invalid token from reCAPTCHA');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('reCAPTCHA execution error:', error);
      setError(error);
      onError?.(error);
      return null;
    } finally {
      executingRef.current = false;
    }
  }, [action, actualSiteKey, onError, onToken, shouldSkip]);

  // Load the reCAPTCHA script with better error handling
  useEffect(() => {
    if (loaded || loadingScript || shouldSkip) return;

    const key = actualSiteKey();
    
    // Skip if we don't have a valid key
    if (!key || key.length < 10) {
      console.error(`Cannot load reCAPTCHA: No valid site key available`);
      return;
    }

    // Skip if recaptcha is already loaded
    if (window.grecaptcha) {
      console.log('reCAPTCHA already loaded, skipping script load');
      setLoaded(true);
      return;
    }

    const loadScript = async () => {
      try {
        setLoadingScript(true);
        console.log(`Loading reCAPTCHA script with site key: ${key.substring(0, 5)}...`);

        // Create script element
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${key}`;
        script.async = true;
        script.defer = true;

        // Setup load and error handlers
        const scriptLoaded = new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log('reCAPTCHA script loaded successfully');
            resolve();
          };
          script.onerror = (event) => {
            reject(new Error('Failed to load reCAPTCHA script'));
          };
        });

        // Add script to document
        document.head.appendChild(script);
        
        // Wait for script to load
        await scriptLoaded;
        setLoaded(true);
        
        // Wait a bit for grecaptcha to initialize properly
        setTimeout(() => {
          executeReCaptcha().catch(console.error);
        }, 1000);
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error loading reCAPTCHA:', error);
        setError(error);
        onError?.(error);
      } finally {
        setLoadingScript(false);
      }
    };

    loadScript();

    // Cleanup function
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [loaded, loadingScript, executeReCaptcha, actualSiteKey, onError, shouldSkip]);

  // Setup token refresh if autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh || !loaded || shouldSkip) return;

    const setupRefresh = () => {
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await executeReCaptcha();
        } catch (err) {
          console.error('Error in reCAPTCHA refresh:', err);
        } finally {
          // Schedule next refresh
          setupRefresh();
        }
      }, refreshInterval);
    };

    setupRefresh();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [autoRefresh, loaded, refreshInterval, executeReCaptcha, shouldSkip]);

  // Method to manually execute reCAPTCHA
  const execute = useCallback(async (): Promise<string | null> => {
    if (!loaded && !shouldSkip) {
      console.warn('ReCAPTCHA not loaded yet, cannot execute');
      return null;
    }

    return executeReCaptcha();
  }, [loaded, executeReCaptcha, shouldSkip]);

  return null; // This component doesn't render anything
}

// Utility hook to use reCAPTCHA in functional components
export function useReCaptcha(props: Omit<ReCaptchaV3Props, 'onToken' | 'onError'> = {}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const executingRef = useRef(false);

  const handleToken = useCallback((newToken: string) => {
    setToken(newToken);
    setLoading(false);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
    setLoading(false);
  }, []);

  const execute = useCallback(async (): Promise<string | null> => {
    // Prevent multiple simultaneous executions
    if (executingRef.current) {
      console.log('reCAPTCHA execution already in progress, skipping');
      return token;
    }

    try {
      executingRef.current = true;
      setLoading(true);
      setError(null);

      // Directly return a development token if skipping
      if (props.skipForDevelopment && process.env.NODE_ENV === 'development') {
        const dummyToken = 'development-dummy-token';
        setToken(dummyToken);
        setLoading(false);
        return dummyToken;
      }

      // Create a promise to handle the token
      return new Promise((resolve) => {
        // Create one-time handlers for this execution
        const onTokenCallback = (newToken: string) => {
          handleToken(newToken);
          resolve(newToken);
        };

        const onErrorCallback = (err: Error) => {
          handleError(err);
          resolve(null);
        };

        // Create temporary reCAPTCHA element
        const recaptchaContainer = document.createElement('div');
        recaptchaContainer.style.display = 'none';
        document.body.appendChild(recaptchaContainer);

        // Render temporary component to get token
        const cleanup = () => {
          if (recaptchaContainer) {
            document.body.removeChild(recaptchaContainer);
          }
        };

        ReactDOM.render(
          <ReCaptchaV3
            {...props}
            onToken={(token) => {
              cleanup();
              onTokenCallback(token);
            }}
            onError={(err) => {
              cleanup();
              onErrorCallback(err);
            }}
          />,
          recaptchaContainer
        );

        // Set timeout to cleanup if it takes too long
        setTimeout(() => {
          cleanup();
          onErrorCallback(new Error('reCAPTCHA execution timed out'));
        }, 10000);
      });
    } finally {
      executingRef.current = false;
    }
  }, [props, token, handleToken, handleError]);

  // Create ReCAPTCHA component for continuous token refreshing if needed
  const RecaptchaComponent = useCallback(
    () => (
      <ReCaptchaV3
        {...props}
        onToken={handleToken}
        onError={handleError}
      />
    ),
    [props, handleToken, handleError]
  );

  return {
    token,
    loading,
    error,
    execute,
    RecaptchaComponent,
  };
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
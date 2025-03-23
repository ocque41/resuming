"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Loader2 } from 'lucide-react';
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha/actions';
import { 
  getRecaptchaConfigStatus, 
  isUsingTestKeys, 
  PRODUCTION_DOMAINS,
  getCurrentDomain,
  isDevelopmentDomain,
  isProductionDomain
} from '@/lib/recaptcha/domain-check';

// Define interface for the reCAPTCHA v3 props
interface ReCaptchaV3Props {
  action?: string;
  siteKey?: string;
  onToken?: (token: string, score?: number) => void;
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
  /**
   * Flag to force using test keys in development
   */
  useTestKeysInDev?: boolean;
}

// Define interface for reCAPTCHA response
interface ReCaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
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

// Test key for development environments
const RECAPTCHA_TEST_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

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
      domain?: string;
      isProductionDomain?: boolean;
      isDevelopmentDomain?: boolean;
      usingTestKey?: boolean;
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
  skipForDevelopment = false,
  useTestKeysInDev = false
}: ReCaptchaV3Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [verificationScore, setVerificationScore] = useState<number | undefined>(undefined);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const executingRef = useRef(false);
  const retryAttemptsRef = useRef(0);
  const MAX_RETRY_ATTEMPTS = 3;

  // Check if we're in a development environment and should skip recaptcha
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  const currentDomain = getCurrentDomain();
  const isDevDomain = isDevelopmentDomain(currentDomain);
  const isProdDomain = isProductionDomain(currentDomain);
  
  // Determine if we should skip based on environment and configuration
  const shouldSkip = (isDevelopment && skipForDevelopment) || 
    (process.env.SKIP_RECAPTCHA === 'true' && isDevelopment);

  // Log environment during development
  useEffect(() => {
    if (isDevelopment) {
      console.log('ReCaptchaV3 Component Environment:', {
        nodeEnv: process.env.NODE_ENV,
        domain: currentDomain,
        isDevelopmentDomain: isDevDomain,
        isProductionDomain: isProdDomain,
        skipForDevelopment,
        useTestKeysInDev,
        shouldSkip
      });
    }
  }, []);

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
    
    // Use test keys in development if specified
    if (isDevelopment && useTestKeysInDev) {
      console.log('Using Google test keys in development mode');
      window.__env && (window.__env.usingTestKey = true);
      return RECAPTCHA_TEST_KEY;
    }

    // Try to get the site key from environment
    const envSiteKey = 
      typeof window !== 'undefined' && window.__env && window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY 
        ? window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY 
        : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    // Check if we're using test keys and log warning if appropriate
    if (envSiteKey && isUsingTestKeys() && !isDevelopment) {
      console.warn(
        'Using Google reCAPTCHA test keys. These should not be used in production!'
      );
      window.__env && (window.__env.usingTestKey = true);
    }

    // Check configuration status for more detailed logs
    if (!envSiteKey || envSiteKey.length < 10) {
      const configStatus = getRecaptchaConfigStatus();
      
      if (isProdDomain && isProduction) {
        console.error(
          'Critical: ReCAPTCHA configuration issue on production domain:',
          configStatus
        );
      } else {
        console.warn(
          'ReCAPTCHA configuration issue:',
          configStatus
        );
      }
    }

    return envSiteKey || '';
  }, [siteKey, shouldSkip, isDevelopment, useTestKeysInDev, isProduction, isProdDomain]);

  // Execute reCAPTCHA with improved error handling and retries
  const executeReCaptcha = useCallback(async (): Promise<string | null> => {
    if (shouldSkip) {
      console.log('Skipping reCAPTCHA execution in development mode');
      setVerificationScore(1.0); // Perfect score for skipped verification
      const dummyToken = 'development-dummy-token-' + new Date().getTime();
      onToken?.(dummyToken, 1.0);
      return dummyToken;
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
      
      // Log token for debugging (only first 10 chars for security)
      if (isDevelopment) {
        console.log(`reCAPTCHA token received: ${token.substring(0, 10)}...`);
      }
      
      // Only call onToken if token is valid (non-empty string)
      if (token && typeof token === 'string' && token.length > 0) {
        // Reset retry attempts on success
        retryAttemptsRef.current = 0;
        
        // For development or test keys, use a simulated score
        if (isUsingTestKeys() || shouldSkip) {
          const simulatedScore = 0.9; // High score for test keys
          setVerificationScore(simulatedScore);
          onToken?.(token, simulatedScore);
        } else {
          // In production, we'd ideally validate the token on the server
          // and get the actual score, but we can use a default here
          setVerificationScore(undefined);
          onToken?.(token, undefined);
        }
        
        return token;
      } else {
        throw new Error('Received invalid token from reCAPTCHA');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('reCAPTCHA execution error:', error);
      
      // Implement retry logic
      if (retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
        retryAttemptsRef.current++;
        console.log(`Retrying reCAPTCHA execution (attempt ${retryAttemptsRef.current} of ${MAX_RETRY_ATTEMPTS})`);
        
        // Exponential backoff for retries
        const backoffDelay = Math.pow(2, retryAttemptsRef.current) * 1000;
        
        setTimeout(() => {
          executingRef.current = false;
          executeReCaptcha().catch(console.error);
        }, backoffDelay);
        
        return null;
      }
      
      setError(error);
      onError?.(error);
      return null;
    } finally {
      // Only set to false if we're not retrying
      if (retryAttemptsRef.current >= MAX_RETRY_ATTEMPTS) {
        executingRef.current = false;
      }
    }
  }, [action, actualSiteKey, onError, onToken, shouldSkip, isDevelopment]);

  // Load the reCAPTCHA script with better error handling
  useEffect(() => {
    if (loaded || loadingScript || shouldSkip) return;

    const key = actualSiteKey();
    
    // Skip if we don't have a valid key
    if (!key || key.length < 10) {
      if (isProdDomain && isProduction) {
        console.error(`Critical: Cannot load reCAPTCHA on production domain: No valid site key available`);
      } else {
        console.warn(`Cannot load reCAPTCHA: No valid site key available`);
      }
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
        
        // Wait for script to load with timeout
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('reCAPTCHA script load timed out after 10 seconds'));
          }, 10000);
        });
        
        await Promise.race([scriptLoaded, timeoutPromise]);
        setLoaded(true);
        
        // Wait a bit for grecaptcha to initialize properly
        setTimeout(() => {
          executeReCaptcha().catch(console.error);
        }, 1000);
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error loading reCAPTCHA:', error);
        
        if (isProdDomain && isProduction) {
          console.error('Critical: reCAPTCHA failed to load on production domain:', {
            domain: currentDomain,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
        
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
  }, [loaded, loadingScript, executeReCaptcha, actualSiteKey, onError, shouldSkip, isProdDomain, isProduction, currentDomain]);

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
  const [score, setScore] = useState<number | undefined>(undefined);
  const executingRef = useRef(false);

  const handleToken = useCallback((newToken: string, newScore?: number) => {
    setToken(newToken);
    if (newScore !== undefined) {
      setScore(newScore);
    }
    setLoading(false);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
    setLoading(false);
  }, []);

  const execute = useCallback(async (action?: string): Promise<string | null> => {
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
        const dummyToken = 'development-dummy-token-' + new Date().getTime();
        setToken(dummyToken);
        setScore(1.0);
        setLoading(false);
        return dummyToken;
      }

      // Create a promise to handle the token
      return new Promise((resolve) => {
        // Create one-time handlers for this execution
        const onTokenCallback = (newToken: string, newScore?: number) => {
          handleToken(newToken, newScore);
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
          if (recaptchaContainer && recaptchaContainer.parentNode) {
            ReactDOM.unmountComponentAtNode(recaptchaContainer);
            if (document.body.contains(recaptchaContainer)) {
              document.body.removeChild(recaptchaContainer);
            }
          }
        };

        // Set specific action if provided
        const recaptchaAction = action || props.action || RECAPTCHA_ACTIONS.GENERIC;

        ReactDOM.render(
          <ReCaptchaV3
            {...props}
            action={recaptchaAction}
            onToken={(token, newScore) => {
              cleanup();
              onTokenCallback(token, newScore);
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
    score,
    execute,
    RecaptchaComponent,
  };
}

/**
 * Wrapper component that loads reCAPTCHA v3 script only once for the entire app
 */
export function ReCaptchaV3Provider({ 
  children,
  defaultAction = RECAPTCHA_ACTIONS.GENERIC,
  skipInDevelopment = false
}: { 
  children: React.ReactNode,
  defaultAction?: string,
  skipInDevelopment?: boolean
}) {
  const [loaded, setLoaded] = useState(false);
  
  // Determine environment
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  const currentDomain = getCurrentDomain();
  const isProdDomain = isProductionDomain(currentDomain);
  
  // Determine if we should skip based on environment and configuration
  const shouldSkip = (skipInDevelopment && isDevelopment) || 
    (process.env.SKIP_RECAPTCHA === 'true' && isDevelopment);
  
  // Get site key with our helper
  const env = getEnv();
  const siteKey = env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
  
  useEffect(() => {
    // Skip if already loaded or no site key or should skip
    if (loaded || !siteKey || typeof window === 'undefined' || shouldSkip) {
      if (shouldSkip && isDevelopment) {
        console.log("ReCaptchaV3Provider: Skipping in development mode");
      }
      return;
    }
    
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
    
    script.onerror = (event) => {
      console.error("ReCaptchaV3Provider: Failed to load script", event);
      
      if (isProdDomain && isProduction) {
        console.error("Critical: reCAPTCHA script failed to load on production domain:", {
          domain: currentDomain,
          time: new Date().toISOString()
        });
      }
    };
    
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [siteKey, loaded, shouldSkip, isDevelopment, isProdDomain, isProduction, currentDomain]);

  return <>{children}</>;
}

export default ReCaptchaV3; 
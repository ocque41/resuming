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
    const domainInfo = {
      nodeEnv: process.env.NODE_ENV,
      domain: currentDomain,
      isDevelopmentDomain: isDevDomain,
      isProductionDomain: isProdDomain,
      skipForDevelopment,
      useTestKeysInDev,
      shouldSkip
    };

    if (isDevelopment) {
      console.log('%c[ReCaptchaV3] Environment:', 'color: blue; font-weight: bold;', domainInfo);
    } else if (isProdDomain) {
      // Special logging for production domains, especially resuming.ai
      if (currentDomain.includes('resuming.ai')) {
        console.log(
          '%c[ReCaptchaV3] Resuming.ai Production Domain',
          'color: green; background-color: rgba(0,255,0,0.1); font-weight: bold; padding: 2px 5px; border-radius: 3px;',
          domainInfo
        );
      } else {
        console.log('%c[ReCaptchaV3] Production Domain:', 'color: green; font-weight: bold;', domainInfo);
      }
    }
  }, [currentDomain, isDevelopment, isDevDomain, isProdDomain, skipForDevelopment, useTestKeysInDev, shouldSkip]);

  // Get proper site key with improved error handling
  const actualSiteKey = useCallback(() => {
    // Check if we have a valid site key as a prop
    if (siteKey && siteKey.length > 10) {
      if (isDevelopment) {
        console.log('%c[ReCaptchaV3] Using provided site key', 'color: blue;');
      }
      return siteKey;
    }

    // Check if we need to skip altogether for development
    if (shouldSkip) {
      console.log('%c[ReCaptchaV3] Skipping in development mode', 'color: orange;');
      return 'development-skip';
    }
    
    // Use test keys in development if specified
    if (isDevelopment && useTestKeysInDev) {
      console.log('%c[ReCaptchaV3] Using Google test keys in development', 'color: orange;');
      window.__env && (window.__env.usingTestKey = true);
      return RECAPTCHA_TEST_KEY;
    }

    // Try to get the site key from environment
    const envSiteKey = 
      typeof window !== 'undefined' && window.__env && window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY 
        ? window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY 
        : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    // Add detailed logging about the key source
    if (envSiteKey) {
      const source = window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? 'window.__env' : 'process.env';
      if (isDevelopment) {
        console.log(`%c[ReCaptchaV3] Using site key from ${source}`, 'color: blue;');
      }
    }

    // Check if we're using test keys and log warning if appropriate
    if (envSiteKey && isUsingTestKeys() && !isDevelopment) {
      console.warn(
        '%c[ReCaptchaV3] Warning: Using Google test keys',
        'color: red; font-weight: bold;',
        'These should not be used in production!'
      );
      window.__env && (window.__env.usingTestKey = true);
    }

    // Check configuration status for more detailed logs
    if (!envSiteKey || envSiteKey.length < 10) {
      const configStatus = getRecaptchaConfigStatus();
      
      if (isProdDomain && isProduction) {
        // Special handling for resuming.ai domain
        if (currentDomain.includes('resuming.ai')) {
          console.error(
            '%c[ReCaptchaV3 CRITICAL ERROR] Missing site key on resuming.ai!',
            'color: white; background-color: red; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
            configStatus
          );
        } else {
          console.error(
            '%c[ReCaptchaV3 Error] Missing site key on production domain',
            'color: red; font-weight: bold;',
            configStatus
          );
        }
      } else {
        console.warn(
          '%c[ReCaptchaV3 Warning] Configuration issue',
          'color: orange; font-weight: bold;',
          configStatus
        );
      }

      // Attempt to recover the key if possible
      if (typeof window !== 'undefined' && window.__env) {
        if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
          console.warn('%c[ReCaptchaV3] Attempting to recover site key from process.env', 'color: orange;');
          window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
          
          if (window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.length > 10) {
            console.log('%c[ReCaptchaV3] Successfully recovered site key', 'color: green;');
            return window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
          }
        }
      }
    }

    return envSiteKey || '';
  }, [siteKey, shouldSkip, isDevelopment, useTestKeysInDev, isProduction, isProdDomain, currentDomain]);

  // Execute reCAPTCHA with improved error handling and retries
  const executeReCaptcha = useCallback(async (): Promise<string | null> => {
    if (shouldSkip) {
      console.log('%c[ReCaptchaV3] Skipping execution in development', 'color: orange;');
      setVerificationScore(1.0); // Perfect score for skipped verification
      const dummyToken = 'development-dummy-token-' + new Date().getTime();
      onToken?.(dummyToken, 1.0);
      return dummyToken;
    }

    const key = actualSiteKey();
    if (!key || key.length < 10) {
      const error = new Error(`Cannot execute reCAPTCHA: Invalid site key`);
      
      if (isProdDomain && isProduction) {
        // Special error for resuming.ai domain
        if (currentDomain.includes('resuming.ai')) {
          console.error(
            '%c[ReCaptchaV3 CRITICAL ERROR] Invalid site key on resuming.ai!',
            'color: white; background-color: red; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
            {
              domain: currentDomain,
              action,
              time: new Date().toISOString()
            }
          );
        } else {
          console.error('%c[ReCaptchaV3 Error] Invalid site key on production domain', 'color: red;', {
            domain: currentDomain,
            action
          });
        }
      } else {
        console.error('%c[ReCaptchaV3 Error] Invalid site key', 'color: red;', error);
      }
      
      setError(error);
      onError?.(error);
      return null;
    }

    // Prevent concurrent executions
    if (executingRef.current) {
      console.log('%c[ReCaptchaV3] Execution already in progress', 'color: orange;');
      return null;
    }

    try {
      executingRef.current = true;
      console.log(`%c[ReCaptchaV3] Executing for action: ${action}`, 'color: blue;');

      if (!window.grecaptcha || !window.grecaptcha.execute) {
        throw new Error('reCAPTCHA not loaded yet');
      }

      // Use the execute method with sitekey and action
      const token = await window.grecaptcha.execute(key, { action });
      
      // Log token for debugging (only first 10 chars for security)
      if (isDevelopment) {
        console.log(`%c[ReCaptchaV3] Token received: ${token.substring(0, 10)}...`, 'color: green;');
      } else if (isProdDomain) {
        console.log(`%c[ReCaptchaV3] Token received on ${currentDomain}`, 'color: green;');
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
          
          if (isProdDomain && isProduction && isUsingTestKeys()) {
            console.warn(
              '%c[ReCaptchaV3 Warning] Using test keys with simulated score in production',
              'color: orange; font-weight: bold;'
            );
          }
        } else {
          // In production, we'd ideally validate the token on the server
          // and get the actual score, but we can use a default here
          setVerificationScore(undefined);
          onToken?.(token, undefined);
          
          if (isProdDomain) {
            console.log(`%c[ReCaptchaV3] Verification successful on ${currentDomain}`, 'color: green;');
          }
        }
        
        return token;
      } else {
        throw new Error('Received invalid token from reCAPTCHA');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (isProdDomain && isProduction) {
        // Special error logging for production domains
        if (currentDomain.includes('resuming.ai')) {
          console.error(
            '%c[ReCaptchaV3 Error] Execution failed on resuming.ai',
            'color: red; font-weight: bold;',
            {
              error: error.message,
              action,
              attempt: retryAttemptsRef.current + 1,
              maxAttempts: MAX_RETRY_ATTEMPTS,
              domain: currentDomain,
              time: new Date().toISOString()
            }
          );
        } else {
          console.error('%c[ReCaptchaV3 Error] Execution failed on production domain', 'color: red;', {
            error: error.message,
            domain: currentDomain
          });
        }
      } else {
        console.error('%c[ReCaptchaV3 Error] Execution failed', 'color: red;', error);
      }
      
      // Implement retry logic
      if (retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
        retryAttemptsRef.current++;
        const backoffDelay = Math.pow(2, retryAttemptsRef.current) * 1000;
        
        console.log(
          `%c[ReCaptchaV3] Retrying in ${backoffDelay/1000}s (${retryAttemptsRef.current}/${MAX_RETRY_ATTEMPTS})`,
          'color: orange;'
        );
        
        setTimeout(() => {
          executingRef.current = false;
          executeReCaptcha().catch(e => {
            console.error('%c[ReCaptchaV3] Retry failed', 'color: red;', e);
          });
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
  }, [action, actualSiteKey, onError, onToken, shouldSkip, isDevelopment, isProdDomain, isProduction, currentDomain]);

  // Special handling for script load errors on production
  const handleScriptError = useCallback((error: Error) => {
    if (isProdDomain && isProduction) {
      // Special error for resuming.ai domain
      if (currentDomain.includes('resuming.ai')) {
        console.error(
          '%c[ReCaptchaV3 CRITICAL ERROR] Script failed to load on resuming.ai!',
          'color: white; background-color: red; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
          {
            domain: currentDomain,
            error: error.message,
            time: new Date().toISOString(),
            recovery: 'Attempting to recover by setting dummy token'
          }
        );
        
        // For production domains, we can attempt recovery by setting a token
        // This won't work for verification but prevents UI from breaking
        if (onToken) {
          setTimeout(() => {
            onToken('error-recovery-token-' + new Date().getTime(), 0.1);
          }, 1000);
        }
      } else {
        console.error('%c[ReCaptchaV3 Error] Script failed to load on production domain', 'color: red;', {
          domain: currentDomain,
          error: error.message
        });
      }
    } else {
      console.error('%c[ReCaptchaV3 Error] Script failed to load', 'color: red;', error);
    }
    
    setError(error);
    onError?.(error);
  }, [isProdDomain, isProduction, currentDomain, onToken, onError]);

  // Load the reCAPTCHA script with better error handling
  useEffect(() => {
    if (loaded || loadingScript || shouldSkip) return;

    const key = actualSiteKey();
    
    // Skip if we don't have a valid key
    if (!key || key.length < 10) {
      if (isProdDomain && isProduction) {
        console.error(
          `%c[ReCaptchaV3 Error] Cannot load script on ${currentDomain}: No valid site key`, 
          'color: red; font-weight: bold;'
        );
      } else {
        console.warn(`%c[ReCaptchaV3 Warning] Cannot load script: No valid site key`, 'color: orange;');
      }
      return;
    }

    // Skip if recaptcha is already loaded
    if (window.grecaptcha) {
      console.log('%c[ReCaptchaV3] Script already loaded', 'color: green;');
      setLoaded(true);
      return;
    }

    const loadScript = async () => {
      try {
        setLoadingScript(true);
        console.log(`%c[ReCaptchaV3] Loading script with key: ${key.substring(0, 5)}...`, 'color: blue;');

        // Create script element
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${key}`;
        script.async = true;
        script.defer = true;

        // Setup load and error handlers
        const scriptLoaded = new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log('%c[ReCaptchaV3] Script loaded successfully', 'color: green;');
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
          executeReCaptcha().catch(err => handleScriptError(
            err instanceof Error ? err : new Error(String(err))
          ));
        }, 1000);
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        handleScriptError(error);
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
  }, [loaded, loadingScript, executeReCaptcha, actualSiteKey, handleScriptError, shouldSkip, isProdDomain, isProduction, currentDomain]);

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
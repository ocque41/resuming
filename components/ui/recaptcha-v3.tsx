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
  const [scriptLoadError, setScriptLoadError] = useState(false);

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

  // Add better logging in development and production
  useEffect(() => {
    if (!skipForDevelopment || typeof window !== 'undefined') {
      const domain = typeof window !== 'undefined' ? window.location.hostname : '';
      const isProduction = domain === 'resuming.ai' || domain === 'www.resuming.ai';
      const debugMessage = isProduction 
        ? `[reCAPTCHA v3] Initializing on production domain: ${domain}`
        : `[reCAPTCHA v3] Initializing on development domain: ${domain}`;
      
      console.log(debugMessage, {
        action,
        skipForDevelopment,
        useTestKeysInDev,
        domain
      });
      
      // Special logging for resuming.ai domains
      if (isProduction) {
        console.log(`[reCAPTCHA v3] Production domain detected: ${domain}`, {
          siteKeyAvailable: !!actualSiteKey()
        });
      }
    }
  }, [skipForDevelopment, action, useTestKeysInDev]);

  // Get proper site key with improved error handling
  const actualSiteKey = useCallback(() => {
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProduction = domain === 'resuming.ai' || domain === 'www.resuming.ai';
    const isDev = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );

    // First, check props
    if (siteKey) {
      if (isDev) {
        console.log('[reCAPTCHA v3] Using provided site key from props');
      }
      return siteKey;
    }

    // Next, check window.__env
    const envKey = typeof window !== 'undefined' && window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (envKey) {
      if (isDev) {
        console.log('[reCAPTCHA v3] Using site key from window.__env');
      }
      
      // Check if using test key in production
      if (isProduction && envKey === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI') {
        console.warn('[reCAPTCHA v3] WARNING: Using Google test key in production environment!');
      }
      
      return envKey;
    }

    // Check if Next.js environment variable is available
    const nextEnvKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (nextEnvKey) {
      if (isDev) {
        console.log('[reCAPTCHA v3] Using site key from Next.js env');
      }
      return nextEnvKey;
    }

    // Hardcoded fallback for resuming.ai domains
    if (isProduction) {
      console.log('[reCAPTCHA v3] Using hardcoded production site key for resuming.ai');
      return '6LcX-vwqAAAAAMdAK0K7JlSyCqO6GOp27myEnlh2';
    }

    // Last resort, use Google's test key for development
    if (useTestKeysInDev || isDev) {
      console.warn('[reCAPTCHA v3] Using Google test key for development');
      return '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
    }

    // Critical error for production domains
    if (isProduction) {
      console.error('[reCAPTCHA v3] CRITICAL ERROR: No site key available for resuming.ai domain!');
      // Recovery attempt in production
      return '6LcX-vwqAAAAAMdAK0K7JlSyCqO6GOp27myEnlh2';
    }

    console.error('[reCAPTCHA v3] No site key available. reCAPTCHA will not work.');
    return '';
  }, [siteKey, useTestKeysInDev]);

  // Execute reCAPTCHA with improved error handling and retries
  const executeReCaptcha = useCallback((actionToExecute: string): Promise<string> => {
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProduction = domain === 'resuming.ai' || domain === 'www.resuming.ai';
    
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha) {
        const error = new Error('reCAPTCHA not loaded yet');
        
        if (isProduction) {
          console.error(`[reCAPTCHA v3] CRITICAL ERROR on ${domain}: grecaptcha not loaded`);
        } else {
          console.error('[reCAPTCHA v3] Error:', error);
        }
        
        reject(error);
        return;
      }

      try {
        window.grecaptcha.ready(async () => {
          try {
            const key = actualSiteKey();
            
            if (!key) {
              const error = new Error('No reCAPTCHA site key available');
              
              if (isProduction) {
                console.error(`[reCAPTCHA v3] CRITICAL ERROR on ${domain}: Missing site key`);
              } else {
                console.error('[reCAPTCHA v3] Error:', error);
              }
              
              reject(error);
              return;
            }
            
            // For resuming.ai - add retries with exponential backoff
            let attempts = 0;
            const maxAttempts = isProduction ? 3 : 1;
            
            const attemptExecution = async (): Promise<string> => {
              try {
                const token = await window.grecaptcha.execute(key, { action: actionToExecute });
                
                if (isProduction) {
                  console.log(`[reCAPTCHA v3] Successfully executed on ${domain}`);
                }
                
                return token;
              } catch (execError) {
                attempts++;
                
                if (attempts >= maxAttempts) {
                  throw execError;
                }
                
                // Exponential backoff
                const delay = 1000 * Math.pow(2, attempts);
                console.warn(`[reCAPTCHA v3] Retry attempt ${attempts}/${maxAttempts} after ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
                
                return attemptExecution();
              }
            };
            
            const token = await attemptExecution();
            setVerificationScore(undefined); // Score is only known after server-side verification
            setError(null);
            resolve(token);
          } catch (executeError) {
            const error = executeError instanceof Error 
              ? executeError 
              : new Error('Failed to execute reCAPTCHA');
            
            if (isProduction) {
              console.error(`[reCAPTCHA v3] CRITICAL EXECUTION ERROR on ${domain}:`, error);
            } else {
              console.error('[reCAPTCHA v3] Execution error:', error);
            }
            
            setError(error);
            reject(error);
          }
        });
      } catch (readyError) {
        const error = readyError instanceof Error 
          ? readyError 
          : new Error('Failed to execute grecaptcha.ready()');
        
        if (isProduction) {
          console.error(`[reCAPTCHA v3] CRITICAL READY ERROR on ${domain}:`, error);
        } else {
          console.error('[reCAPTCHA v3] Error in grecaptcha.ready:', error);
        }
        
        setError(error);
        reject(error);
      }
    });
  }, [actualSiteKey]);

  // Special handling for script load errors on production
  const handleScriptError = useCallback((error?: Error) => {
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    const isProduction = domain === 'resuming.ai' || domain === 'www.resuming.ai';
    const scriptError = error || new Error('Failed to load reCAPTCHA script');
    
    if (isProduction) {
      console.error(`[reCAPTCHA v3] CRITICAL LOADING ERROR on ${domain}: Script failed to load`);
      
      // Special handling for resuming.ai domain
      if (domain === 'resuming.ai' || domain === 'www.resuming.ai') {
        console.error(
          '%c[CRITICAL] reCAPTCHA script failed to load on resuming.ai domain!',
          'color: white; background: red; padding: 2px 5px; border-radius: 3px;'
        );
      }
    } else {
      console.error('[reCAPTCHA v3] Script loading error:', scriptError);
    }
    
    setLoaded(false);
    setLoadingScript(false);
    setScriptLoadError(true);
    setError(scriptError);
    onError?.(scriptError);
  }, [onError]);

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
          executeReCaptcha(action).catch(err => handleScriptError(
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
  }, [loaded, loadingScript, executeReCaptcha, actualSiteKey, handleScriptError, shouldSkip, isProdDomain, isProduction, currentDomain, action]);

  // Setup token refresh if autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh || !loaded || shouldSkip) return;

    const setupRefresh = () => {
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await executeReCaptcha(action);
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
  }, [autoRefresh, loaded, refreshInterval, executeReCaptcha, shouldSkip, action]);

  // Method to manually execute reCAPTCHA
  const execute = useCallback(async (): Promise<string | null> => {
    if (!loaded && !shouldSkip) {
      console.warn('ReCAPTCHA not loaded yet, cannot execute');
      return null;
    }

    return executeReCaptcha(action);
  }, [loaded, executeReCaptcha, shouldSkip, action]);

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
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useReCaptcha } from '@/components/ui/recaptcha-v3';
import { getRecaptchaConfigStatus, isDevelopmentDomain, isProductionDomain, getCurrentDomain, PRODUCTION_DOMAINS } from './domain-check';
import { RECAPTCHA_ACTIONS, getMinScoreForAction } from './actions';
import { getTrustLevel, TrustLevel, handleScoreWithTrustLevel } from './score-handler';

// Define the shape of our context state
interface ReCaptchaContextState {
  // Status
  isLoading: boolean;
  isConfigured: boolean;
  error: Error | null;
  verificationStatus: 'idle' | 'loading' | 'success' | 'error' | 'warning';
  verificationMessage?: string;
  verificationScore?: number;
  verificationTrustLevel?: TrustLevel;
  
  // Tokens
  token: string | null;
  tokenTimestamp: number | null;
  tokenExpiryTime: number | null;

  // Configuration
  action: string;
  siteKey?: string;
  configStatus: ReturnType<typeof getRecaptchaConfigStatus>;
  isDevelopment: boolean;
  usingTestKeys: boolean;
  currentDomain: string;
  isProductionDomain: boolean;

  // Methods
  executeVerification: (action?: string) => Promise<string | null>;
  resetVerification: () => void;
  setCustomMessage: (message: string, status?: 'idle' | 'loading' | 'success' | 'error' | 'warning') => void;
  skipVerification: () => Promise<string>;
  validateScore: (score: number, action: string) => boolean;
  getTrustLevelForScore: (score: number) => TrustLevel;
}

// Create the context with a default value
const ReCaptchaContext = createContext<ReCaptchaContextState | undefined>(undefined);

// Provider props
interface ReCaptchaProviderProps {
  children: ReactNode;
  defaultAction?: string;
  skipForDevelopment?: boolean;
  tokenRefreshInterval?: number;
  useTestKeysInDev?: boolean;
}

/**
 * ReCaptcha Provider
 * 
 * Provides global state management for reCAPTCHA verification.
 * Handles token generation, refresh, and expiry tracking.
 */
export function ReCaptchaProvider({
  children,
  defaultAction = RECAPTCHA_ACTIONS.GENERIC,
  skipForDevelopment = false,
  tokenRefreshInterval = 110000, // Just under two minutes (tokens expire at 2 mins)
  useTestKeysInDev = false,
}: ReCaptchaProviderProps) {
  // State for verification status
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'warning'>('idle');
  const [verificationMessage, setVerificationMessage] = useState<string | undefined>(undefined);
  const [verificationScore, setVerificationScore] = useState<number | undefined>(undefined);
  const [verificationTrustLevel, setVerificationTrustLevel] = useState<TrustLevel | undefined>(undefined);
  const [action, setAction] = useState<string>(defaultAction);
  
  // Token state
  const [tokenTimestamp, setTokenTimestamp] = useState<number | null>(null);
  const [tokenExpiryTime, setTokenExpiryTime] = useState<number | null>(null);
  
  // Domain and environment information
  const currentDomain = getCurrentDomain();
  const isDevDomain = isDevelopmentDomain(currentDomain);
  const isProdDomain = isProductionDomain(currentDomain);
  const isDevelopment = process.env.NODE_ENV === 'development' || isDevDomain;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Should we skip verification?
  const envSkipRecaptcha = process.env.SKIP_RECAPTCHA === 'true';
  const shouldSkip = (skipForDevelopment && isDevelopment) || (envSkipRecaptcha && isDevelopment);
  
  // Configuration status
  const configStatus = getRecaptchaConfigStatus();
  const usingTestKeys = configStatus.usingTestKeys;
  
  // Enhanced debug logging for configuration status
  useEffect(() => {
    const debugInfo = {
      hasSiteKey: configStatus.hasSiteKey,
      hasSecretKey: configStatus.hasSecretKey,
      domain: currentDomain,
      isProdDomain,
      isDevDomain,
      usingTestKeys,
      shouldSkipVerification: shouldSkip,
      environment: process.env.NODE_ENV,
      configuredProperly: configStatus.isProperlyConfigured
    };
    
    console.log("%creCAPTCHA Configuration Status:", "font-weight: bold; color: blue;", debugInfo);
    
    // Critical warnings for production domain missing configuration
    if (isProdDomain && isProduction) {
      if (!configStatus.hasSiteKey) {
        console.error("%cCRITICAL: reCAPTCHA Site Key is missing on production domain!", 
                     "font-weight: bold; color: red; font-size: 14px;", 
                     "Check if NEXT_PUBLIC_RECAPTCHA_SITE_KEY environment variable is set.");
      }
      
      if (!configStatus.hasSecretKey) {
        console.error("%cCRITICAL: reCAPTCHA Secret Key is missing on production domain!", 
                     "font-weight: bold; color: red; font-size: 14px;", 
                     "Check if RECAPTCHA_SECRET_KEY environment variable is set.");
      }
      
      if (usingTestKeys) {
        console.error("%cCRITICAL: Using TEST reCAPTCHA keys in PRODUCTION!", 
                     "font-weight: bold; color: red; font-size: 14px;",
                     "This is not secure and should never happen in production.");
      }
    } else {
      // Regular warnings for development
      if (!configStatus.hasSiteKey) {
        console.warn("%creCAPTCHA Site Key is missing!", "font-weight: bold; color: orange;", 
          "Check if NEXT_PUBLIC_RECAPTCHA_SITE_KEY environment variable is set.");
      }
      
      if (!configStatus.hasSecretKey) {
        console.warn("%creCAPTCHA Secret Key is missing!", "font-weight: bold; color: orange;", 
          "Check if RECAPTCHA_SECRET_KEY environment variable is set.");
      }
    }
    
    // Try to determine the source of site key
    const siteKeyFromEnv = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    const siteKeyFromWindow = typeof window !== 'undefined' && window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    console.log("%creCAPTCHA Site Key Sources:", "font-weight: bold; color: blue;", {
      fromEnvVar: siteKeyFromEnv ? "✅ Present" : "❌ Missing",
      fromWindow: siteKeyFromWindow ? "✅ Present" : "❌ Missing",
      fromWindowLength: siteKeyFromWindow ? siteKeyFromWindow.length : 0,
      fromEnvLength: siteKeyFromEnv ? siteKeyFromEnv.length : 0,
      // Show partial keys for debugging
      windowKeyPrefix: siteKeyFromWindow ? siteKeyFromWindow.substring(0, 6) : null,
      envKeyPrefix: siteKeyFromEnv ? siteKeyFromEnv.substring(0, 6) : null,
    });
  }, [configStatus, isDevDomain, isProdDomain, shouldSkip, usingTestKeys, currentDomain, isProduction]);
  
  // Use our reCAPTCHA hook
  const {
    token,
    loading: isLoading,
    error,
    score,
    execute,
    RecaptchaComponent
  } = useReCaptcha({
    action,
    skipForDevelopment: shouldSkip,
    useTestKeysInDev
  });

  // Determine if reCAPTCHA is configured properly
  const isConfigured = !!(
    configStatus.hasSiteKey && 
    configStatus.hasSecretKey
  );
  
  // Score validation function
  const validateScore = useCallback((score: number, actionType: string): boolean => {
    const minScore = getMinScoreForAction(actionType);
    return score >= minScore;
  }, []);
  
  // Get trust level for score
  const getTrustLevelForScore = useCallback((score: number): TrustLevel => {
    return getTrustLevel(score);
  }, []);
  
  // Update token timestamp and score whenever token changes
  useEffect(() => {
    if (token) {
      const now = Date.now();
      setTokenTimestamp(now);
      // reCAPTCHA tokens expire after 2 minutes
      setTokenExpiryTime(now + 120000);
      
      // If we have a valid token, update status
      setVerificationStatus('success');
      setVerificationMessage("Verification ready");
      
      // Update score and trust level if available
      if (score !== undefined) {
        setVerificationScore(score);
        const trustLevel = getTrustLevel(score);
        setVerificationTrustLevel(trustLevel);
        
        // If score is too low, set warning status
        const minScore = getMinScoreForAction(action);
        if (score < minScore) {
          setVerificationStatus('warning');
          setVerificationMessage(`Verification score (${score.toFixed(2)}) below threshold (${minScore.toFixed(2)})`);
        }
      }
    }
  }, [token, score, action]);

  // Set up automatic token refresh
  useEffect(() => {
    if (!isConfigured || shouldSkip) return;
    
    const refreshToken = async () => {
      console.log("Refreshing reCAPTCHA token");
      try {
        await execute();
        console.log("reCAPTCHA token refreshed");
      } catch (err) {
        console.error("Failed to refresh reCAPTCHA token:", err);
        setVerificationStatus('warning');
        setVerificationMessage("Token refresh failed. Verification may be required.");
      }
    };
    
    // Set up refresh interval
    const intervalId = setInterval(refreshToken, tokenRefreshInterval);
    
    // Clear on unmount
    return () => clearInterval(intervalId);
  }, [isConfigured, shouldSkip, execute, tokenRefreshInterval]);

  // Initialize verification status based on configuration
  useEffect(() => {
    if (!isConfigured && !shouldSkip) {
      setVerificationStatus('error');
      
      // Provide a more specific error message
      let message = "reCAPTCHA is not properly configured";
      if (!configStatus.hasSiteKey && !configStatus.hasSecretKey) {
        message = "reCAPTCHA site key and secret key are missing";
      } else if (!configStatus.hasSiteKey) {
        message = "reCAPTCHA site key is missing";
      } else if (!configStatus.hasSecretKey) {
        message = "reCAPTCHA secret key is missing";
      }
      
      // Special message for production domain
      if (isProdDomain && isProduction) {
        message = `Critical: ${message} on production domain ${currentDomain}`;
      }
      
      setVerificationMessage(message);
      console.error("reCAPTCHA configuration error:", message, {
        hasSiteKey: configStatus.hasSiteKey,
        hasSecretKey: configStatus.hasSecretKey,
        domain: currentDomain,
        isProdDomain
      });
    } else if (shouldSkip) {
      setVerificationStatus('warning');
      setVerificationMessage("reCAPTCHA verification skipped in development");
      console.info("reCAPTCHA verification skipped in development environment");
    } else if (usingTestKeys && isProduction) {
      setVerificationStatus('warning');
      setVerificationMessage("Using test keys in production. Not secure for real users.");
      console.warn("Using test reCAPTCHA keys in production environment. This is not secure for real users.");
    } else {
      // Only set to idle if we don't already have a token
      if (!token) {
        setVerificationStatus('idle');
        setVerificationMessage("Verification ready");
      }
    }
  }, [isConfigured, shouldSkip, usingTestKeys, token, configStatus, isProdDomain, isProduction, currentDomain]);

  // Execute verification with optional custom action
  const executeVerification = useCallback(async (customAction?: string): Promise<string | null> => {
    if (shouldSkip) {
      console.log("Skipping reCAPTCHA verification in development");
      setVerificationStatus('warning');
      setVerificationMessage("Verification skipped in development");
      setVerificationScore(1.0);
      setVerificationTrustLevel(TrustLevel.HIGH);
      return "dev-mode-skip-token-" + new Date().getTime();
    }
    
    if (!isConfigured) {
      const errorDetails = {
        hasSiteKey: configStatus.hasSiteKey,
        hasSecretKey: configStatus.hasSecretKey,
        domain: currentDomain,
        isProdDomain
      };
      
      console.error("Cannot execute reCAPTCHA - not configured properly", errorDetails);
      
      // Provide more descriptive error messages
      let message = "reCAPTCHA is not properly configured";
      if (!configStatus.hasSiteKey && !configStatus.hasSecretKey) {
        message = "Cannot verify: reCAPTCHA keys are missing";
      } else if (!configStatus.hasSiteKey) {
        message = "Cannot verify: reCAPTCHA site key is missing";
      } else if (!configStatus.hasSecretKey) {
        message = "Cannot verify: reCAPTCHA secret key is missing";
      }
      
      // Special message for production domain
      if (isProdDomain && isProduction) {
        message = `Critical: ${message} on production domain ${currentDomain}`;
      }
      
      setVerificationStatus('error');
      setVerificationMessage(message);
      return null;
    }
    
    // If token exists and is not expired, return it without changing state
    if (token && tokenExpiryTime && Date.now() < tokenExpiryTime) {
      console.log("Using existing valid reCAPTCHA token (expires in", 
        Math.round((tokenExpiryTime - Date.now()) / 1000), "seconds)");
      return token;
    }
    
    // Otherwise, get a new token
    setVerificationStatus('loading');
    setVerificationMessage("Verifying...");
    
    let retries = 0;
    const maxRetries = 2;
    
    const attemptExecution = async (): Promise<string | null> => {
      try {
        // If a custom action is provided, update the action
        if (customAction && customAction !== action) {
          console.log(`Updating reCAPTCHA action from "${action}" to "${customAction}"`);
          setAction(customAction);
        }
        
        const actionToExecute = customAction || action;
        console.log(`Executing reCAPTCHA verification with action: ${actionToExecute}`);
        const newToken = await execute(actionToExecute);
        
        if (newToken) {
          // Only log first 10 chars of token to protect sensitive info
          if (isDevelopment) {
            console.log(`Successfully obtained reCAPTCHA token (${newToken.substring(0, 10)}...)`);
          } else {
            console.log(`Successfully obtained reCAPTCHA token`);
          }
          
          // Check score against threshold if score is available
          if (score !== undefined) {
            const minScore = getMinScoreForAction(actionToExecute);
            const trustLevel = getTrustLevel(score);
            
            setVerificationScore(score);
            setVerificationTrustLevel(trustLevel);
            
            if (score < minScore) {
              setVerificationStatus('warning');
              setVerificationMessage(`Verification score (${score.toFixed(2)}) below threshold (${minScore.toFixed(2)})`);
              
              // Still return the token, but caller should check the score
              console.warn(`reCAPTCHA score (${score.toFixed(2)}) is below threshold (${minScore.toFixed(2)}) for action ${actionToExecute}`);
            } else {
              setVerificationStatus('success');
              setVerificationMessage(`Verification successful (score: ${score.toFixed(2)})`);
            }
          } else {
            setVerificationStatus('success');
            setVerificationMessage("Verification successful");
          }
          
          return newToken;
        }
        
        throw new Error("No token received from reCAPTCHA");
      } catch (err) {
        if (retries < maxRetries) {
          retries++;
          console.log(`reCAPTCHA retry attempt ${retries}/${maxRetries}`);
          // Exponential backoff before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          return await attemptExecution();
        }
        
        console.error("reCAPTCHA verification error after retries:", err);
        
        // Special handling for production domain errors
        if (isProdDomain && isProduction) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.error("Critical: reCAPTCHA verification failed on production domain:", {
            domain: currentDomain,
            action: customAction || action,
            error: errorMessage,
            time: new Date().toISOString()
          });
        }
        
        setVerificationStatus('error');
        setVerificationMessage(err instanceof Error ? err.message : "Verification failed");
        return null;
      }
    };
    
    return attemptExecution();
  }, [
    shouldSkip, isConfigured, token, tokenExpiryTime, action, execute, configStatus, 
    isProdDomain, isProduction, currentDomain, isDevelopment, score
  ]);

  // Reset verification state
  const resetVerification = useCallback(() => {
    setVerificationStatus('idle');
    setVerificationMessage(undefined);
    setVerificationScore(undefined);
    setVerificationTrustLevel(undefined);
  }, []);

  // Set a custom message with optional status
  const setCustomMessage = useCallback((message: string, status?: 'idle' | 'loading' | 'success' | 'error' | 'warning') => {
    setVerificationMessage(message);
    if (status) {
      setVerificationStatus(status);
    }
  }, []);

  // Add a skip verification method
  const skipVerification = useCallback(async (): Promise<string> => {
    if (isProdDomain && isProduction) {
      console.error("Critical: Attempted to bypass reCAPTCHA verification in production!");
      setVerificationStatus('error');
      setVerificationMessage("Cannot bypass verification in production");
      throw new Error("Cannot bypass verification in production environment");
    }
    
    console.warn("Bypassing reCAPTCHA verification");
    setVerificationStatus('warning');
    setVerificationMessage("Verification bypassed (not secure)");
    setVerificationScore(1.0); // Set a perfect score
    setVerificationTrustLevel(TrustLevel.HIGH);
    return "verification-bypassed-token-" + new Date().getTime();
  }, [isProdDomain, isProduction]);

  // Get site key from environment or config status
  const siteKey = typeof window !== 'undefined' && window.__env?.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    ? window.__env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  // Construct the context value
  const contextValue: ReCaptchaContextState = {
    isLoading,
    isConfigured,
    error,
    verificationStatus,
    verificationMessage,
    verificationScore,
    verificationTrustLevel,
    token,
    tokenTimestamp,
    tokenExpiryTime,
    action,
    siteKey,
    configStatus,
    isDevelopment,
    usingTestKeys,
    currentDomain,
    isProductionDomain: isProdDomain,
    executeVerification,
    resetVerification,
    setCustomMessage,
    skipVerification,
    validateScore,
    getTrustLevelForScore
  };

  return (
    <ReCaptchaContext.Provider value={contextValue}>
      {/* Render the reCAPTCHA component */}
      <RecaptchaComponent />
      {children}
    </ReCaptchaContext.Provider>
  );
}

/**
 * Custom hook to use the reCAPTCHA context
 */
export function useReCaptchaContext() {
  const context = useContext(ReCaptchaContext);
  if (context === undefined) {
    throw new Error('useReCaptchaContext must be used within a ReCaptchaProvider');
  }
  return context;
} 
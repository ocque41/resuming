"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useReCaptcha } from '@/components/ui/recaptcha-v3';
import { getRecaptchaConfigStatus, isDevelopmentDomain } from './domain-check';
import { RECAPTCHA_ACTIONS } from './actions';

// Define the shape of our context state
interface ReCaptchaContextState {
  // Status
  isLoading: boolean;
  isConfigured: boolean;
  error: Error | null;
  verificationStatus: 'idle' | 'loading' | 'success' | 'error' | 'warning';
  verificationMessage?: string;
  verificationScore?: number;
  
  // Tokens
  token: string | null;
  tokenTimestamp: number | null;
  tokenExpiryTime: number | null;

  // Configuration
  action: string;
  siteKey?: string;
  configStatus: ReturnType<typeof getRecaptchaConfigStatus>;

  // Methods
  executeVerification: (action?: string) => Promise<string | null>;
  resetVerification: () => void;
  setCustomMessage: (message: string, status?: 'idle' | 'loading' | 'success' | 'error' | 'warning') => void;
}

// Create the context with a default value
const ReCaptchaContext = createContext<ReCaptchaContextState | undefined>(undefined);

// Provider props
interface ReCaptchaProviderProps {
  children: ReactNode;
  defaultAction?: string;
  skipForDevelopment?: boolean;
  tokenRefreshInterval?: number;
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
}: ReCaptchaProviderProps) {
  // State for verification status
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'warning'>('idle');
  const [verificationMessage, setVerificationMessage] = useState<string | undefined>(undefined);
  const [verificationScore, setVerificationScore] = useState<number | undefined>(undefined);
  const [action, setAction] = useState<string>(defaultAction);
  
  // Token state
  const [tokenTimestamp, setTokenTimestamp] = useState<number | null>(null);
  const [tokenExpiryTime, setTokenExpiryTime] = useState<number | null>(null);
  
  // Configuration status
  const configStatus = getRecaptchaConfigStatus();
  const isDevDomain = isDevelopmentDomain();
  const shouldSkip = skipForDevelopment && (process.env.NODE_ENV === 'development' || isDevDomain);
  
  // Use our reCAPTCHA hook
  const {
    token,
    loading: isLoading,
    error,
    execute,
    RecaptchaComponent
  } = useReCaptcha({
    action,
    skipForDevelopment: shouldSkip
  });

  // Determine if reCAPTCHA is configured properly
  const isConfigured = !!(
    configStatus.hasSiteKey && 
    configStatus.hasSecretKey
  );
  
  // Update token timestamp whenever token changes
  useEffect(() => {
    if (token) {
      const now = Date.now();
      setTokenTimestamp(now);
      // reCAPTCHA tokens expire after 2 minutes
      setTokenExpiryTime(now + 120000);
      
      // If we have a valid token, update status
      setVerificationStatus('success');
      setVerificationMessage("Verification ready");
    }
  }, [token]);

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
      setVerificationMessage("reCAPTCHA is not properly configured");
    } else if (shouldSkip) {
      setVerificationStatus('warning');
      setVerificationMessage("reCAPTCHA verification skipped in development");
    } else if (configStatus.usingTestKeys && process.env.NODE_ENV === 'production') {
      setVerificationStatus('warning');
      setVerificationMessage("Using test keys in production. Not secure for real users.");
    } else {
      setVerificationStatus('idle');
      setVerificationMessage("Verification ready");
    }
  }, [isConfigured, shouldSkip, configStatus.usingTestKeys]);

  // Execute verification with optional custom action
  const executeVerification = useCallback(async (customAction?: string): Promise<string | null> => {
    if (shouldSkip) {
      console.log("Skipping reCAPTCHA verification in development");
      setVerificationStatus('warning');
      setVerificationMessage("Verification skipped in development");
      return "dev-mode-skip-token";
    }
    
    if (!isConfigured) {
      console.error("Cannot execute reCAPTCHA - not configured properly");
      setVerificationStatus('error');
      setVerificationMessage("reCAPTCHA is not properly configured");
      return null;
    }
    
    // If token exists and is not expired, return it
    if (token && tokenExpiryTime && Date.now() < tokenExpiryTime) {
      console.log("Using existing valid reCAPTCHA token");
      return token;
    }
    
    // Otherwise, get a new token
    setVerificationStatus('loading');
    setVerificationMessage("Verifying...");
    
    try {
      // If a custom action is provided, update the action
      if (customAction && customAction !== action) {
        setAction(customAction);
      }
      
      const newToken = await execute();
      if (newToken) {
        setVerificationStatus('success');
        setVerificationMessage("Verification successful");
        return newToken;
      } else {
        setVerificationStatus('error');
        setVerificationMessage("Verification failed");
        return null;
      }
    } catch (err) {
      console.error("reCAPTCHA verification error:", err);
      setVerificationStatus('error');
      setVerificationMessage(err instanceof Error ? err.message : "Verification failed");
      return null;
    }
  }, [shouldSkip, isConfigured, token, tokenExpiryTime, action, execute]);

  // Reset verification state
  const resetVerification = useCallback(() => {
    setVerificationStatus('idle');
    setVerificationMessage(undefined);
    setVerificationScore(undefined);
  }, []);

  // Set a custom message with optional status
  const setCustomMessage = useCallback((message: string, status?: 'idle' | 'loading' | 'success' | 'error' | 'warning') => {
    setVerificationMessage(message);
    if (status) {
      setVerificationStatus(status);
    }
  }, []);

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
    token,
    tokenTimestamp,
    tokenExpiryTime,
    action,
    siteKey,
    configStatus,
    executeVerification,
    resetVerification,
    setCustomMessage
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
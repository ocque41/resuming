'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Loader2 } from 'lucide-react';

// Default site key matching the one in .env
const DEFAULT_SITE_KEY = '6LdlnC8pAAAAAKgGryyYW0H5OUAhzs_WbYYHHUL5';

interface ReCaptchaProps {
  onChange: (token: string | null) => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
  tabIndex?: number;
  className?: string;
  onError?: () => void;
  onExpired?: () => void;
}

export default function ReCaptchaWrapper({
  onChange,
  theme = 'dark',
  size = 'normal',
  tabIndex,
  className = '',
  onError,
  onExpired,
}: ReCaptchaProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [siteKey, setSiteKey] = useState<string>('');
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Load the site key on component mount
  useEffect(() => {
    // First try to get from environment variable
    const envSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    if (envSiteKey) {
      console.log('ReCaptcha: Using site key from environment variable');
      setSiteKey(envSiteKey);
    } else {
      console.log('ReCaptcha: Falling back to default site key');
      setSiteKey(DEFAULT_SITE_KEY);
    }
    
    setIsLoading(false);
    
    // Log details for debugging
    if (typeof window !== 'undefined') {
      const keyDetails = {
        source: envSiteKey ? 'Environment variable' : 'Default fallback',
        length: (envSiteKey || DEFAULT_SITE_KEY).length,
        firstFive: (envSiteKey || DEFAULT_SITE_KEY).substring(0, 5),
        lastFive: (envSiteKey || DEFAULT_SITE_KEY).substring((envSiteKey || DEFAULT_SITE_KEY).length - 5),
      };
      
      console.log('ReCaptcha debug:', keyDetails);
      
      // Make debugging info globally available
      // @ts-ignore
      window.__RECAPTCHA_DEBUG__ = {
        ...keyDetails,
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  const handleChange = useCallback(
    (token: string | null) => {
      if (token) {
        console.log(`ReCaptcha token received (length: ${token.length})`);
      } else {
        console.log('ReCaptcha token cleared');
      }
      onChange(token);
    },
    [onChange]
  );

  const handleError = useCallback(() => {
    console.error('ReCaptcha error occurred');
    setHasError(true);
    if (onError) onError();
  }, [onError]);

  const handleExpired = useCallback(() => {
    console.log('ReCaptcha token expired');
    if (onExpired) onExpired();
  }, [onExpired]);

  const reset = useCallback(() => {
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
  }, []);

  // If still loading, show a loading indicator
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">Loading CAPTCHA...</span>
      </div>
    );
  }

  // If there was an error or no site key, show error message
  if (hasError || !siteKey) {
    return (
      <div className={`text-red-500 text-sm p-2 border border-red-300 rounded-md bg-red-50 ${className}`}>
        Failed to load CAPTCHA. Please refresh the page or try again later.
      </div>
    );
  }

  // Render the ReCAPTCHA component
  return (
    <div className={className}>
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        onChange={handleChange}
        onExpired={handleExpired}
        onError={handleError}
        theme={theme}
        size={size}
        tabindex={tabIndex}
      />
    </div>
  );
}

// Export the reset function as well to allow parent components to reset the CAPTCHA
export function useCaptcha() {
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  const reset = useCallback(() => {
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
  }, []);
  
  return { recaptchaRef, reset };
} 
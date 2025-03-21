'use client';

import { useEffect, useRef, useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface CaptchaWrapperProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  size?: 'normal' | 'compact' | 'invisible';
  theme?: 'light' | 'dark';
  className?: string;
}

export default function CaptchaWrapper({
  onVerify,
  onError,
  onExpire,
  size = 'normal',
  theme = 'dark',
  className = '',
}: CaptchaWrapperProps) {
  const [isReady, setIsReady] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);
  
  // Get the site key from environment variable
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || '';
  
  useEffect(() => {
    setIsReady(true);
  }, []);
  
  const handleVerify = (token: string) => {
    onVerify(token);
  };
  
  const handleError = (event: string) => {
    console.error('hCaptcha error:', event);
    if (onError) onError(event);
  };
  
  const handleExpire = () => {
    console.log('hCaptcha token expired');
    if (onExpire) onExpire();
  };
  
  // If component is not ready or no site key, return null
  if (!isReady || !siteKey) {
    return null;
  }
  
  return (
    <div className={`flex justify-center my-4 ${className}`}>
      <HCaptcha
        ref={captchaRef}
        sitekey={siteKey}
        onVerify={handleVerify}
        onError={handleError}
        onExpire={handleExpire}
        size={size}
        theme={theme}
      />
    </div>
  );
} 
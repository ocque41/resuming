import { NextResponse } from 'next/server';
import { isTestReCaptchaSiteKey, isTestReCaptchaSecretKey } from '@/lib/recaptcha/domain-check';

/**
 * Debug endpoint to check if reCAPTCHA environment variables are loaded
 * This is useful for verifying environment configuration in different environments
 * 
 * NOTE: This endpoint should be removed or secured in production
 */

// Get site and secret key info without revealing full values
const getSiteKeyInfo = (key: string | undefined) => {
  if (!key) return { defined: false };
  
  const length = key.length;
  const firstChars = key.substring(0, 6);
  const lastChars = key.substring(length - 4);
  const isTestKey = isTestReCaptchaSiteKey(key);
  const validFormat = key.length > 20; // Simple check for reasonable length
  
  return { 
    defined: true, 
    length, 
    firstChars, 
    lastChars, 
    isTestKey,
    validFormat
  };
};

// Get secret key info without revealing full value
const getSecretKeyInfo = (key: string | undefined) => {
  if (!key) return { defined: false };
  
  const length = key.length;
  const firstChars = key.substring(0, 6);
  const lastChars = key.substring(length - 4);
  const isTestKey = isTestReCaptchaSecretKey(key);
  const validFormat = key.length > 20; // Simple check for reasonable length
  
  return { 
    defined: true, 
    length, 
    firstChars, 
    lastChars, 
    isTestKey,
    validFormat
  };
};

export const GET = async () => {
  // Get reCAPTCHA keys info
  const siteKeyInfo = getSiteKeyInfo(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
  const secretKeyInfo = getSecretKeyInfo(process.env.RECAPTCHA_SECRET_KEY);
  
  // Get environment info
  const nodeEnv = process.env.NODE_ENV || 'development';
  const vercelEnv = process.env.VERCEL_ENV || 'development';
  const host = process.env.VERCEL_URL || 'localhost';
  const isProduction = nodeEnv === 'production' || vercelEnv === 'production';
  
  // Calculate overall status
  const allVariablesDefined = siteKeyInfo.defined && secretKeyInfo.defined;
  
  // Basic validation
  const areKeysValid = 
    siteKeyInfo.defined && 
    secretKeyInfo.defined && 
    siteKeyInfo.validFormat && 
    secretKeyInfo.validFormat;
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    siteKeyInfo,
    secretKeyInfo,
    envInfo: {
      nodeEnv,
      vercelEnv,
      host,
      isProduction
    },
    allVariablesDefined,
    areKeysValid
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json'
    }
  });
}; 
/**
 * Utility functions to check domain configuration for reCAPTCHA
 * 
 * This helps identify common issues with reCAPTCHA domain configuration
 * that might cause verification to fail.
 */

// Google's test keys that will always pass verification - useful for testing
const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

/**
 * Check if we're using Google's test keys
 * These keys always pass verification but should not be used in production
 */
export function isUsingTestKeys(): boolean {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  return siteKey === TEST_SITE_KEY || secretKey === TEST_SECRET_KEY;
}

/**
 * Get the current domain from various sources
 * This is important because reCAPTCHA is configured to work with specific domains
 */
export function getCurrentDomain(): string {
  // Try to get domain from environment variables
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL);
      return url.hostname;
    } catch (error) {
      console.warn('Invalid NEXT_PUBLIC_APP_URL format:', error);
    }
  }
  
  // Try VERCEL_URL for Vercel deployments
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL;
  }
  
  // If running in browser, get from location
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  
  // Last resort fallback
  return 'unknown-domain';
}

/**
 * Check if the domain is localhost or a development domain
 * This is important because reCAPTCHA behaves differently on localhost
 */
export function isDevelopmentDomain(): boolean {
  const domain = getCurrentDomain();
  return domain === 'localhost' || 
         domain === '127.0.0.1' || 
         domain.includes('.local') ||
         domain.endsWith('.ngrok.io') ||
         domain.includes('localhost:');
}

/**
 * Get detailed reCAPTCHA configuration status
 * 
 * @returns Object with configuration details
 */
export function getRecaptchaConfigStatus() {
  const hasSiteKey = !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const hasSecretKey = !!process.env.RECAPTCHA_SECRET_KEY;
  const domain = getCurrentDomain();
  const usingTestKeys = isUsingTestKeys();
  const isDevelopment = isDevelopmentDomain();
  const nodeEnv = process.env.NODE_ENV || 'unknown';
  
  return {
    // Basic configuration
    hasSiteKey,
    hasSecretKey,
    domain,
    usingTestKeys,
    isDevelopment,
    environment: nodeEnv,
    
    // Key information (partial for security)
    siteKeyLength: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.length || 0,
    secretKeyLength: process.env.RECAPTCHA_SECRET_KEY?.length || 0,
    siteKeyFirstChars: hasSiteKey ? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.substring(0, 6) + '...' : null,
    
    // Configuration status
    isProperlyConfigured: hasSiteKey && hasSecretKey && (!isDevelopment || usingTestKeys),
    potentialIssues: getPotentialIssues(hasSiteKey, hasSecretKey, usingTestKeys, isDevelopment, nodeEnv),
    timestamp: new Date().toISOString()
  };
}

/**
 * Get potential issues with reCAPTCHA configuration
 */
function getPotentialIssues(
  hasSiteKey: boolean, 
  hasSecretKey: boolean,
  usingTestKeys: boolean,
  isDevelopment: boolean,
  nodeEnv: string
): string[] {
  const issues: string[] = [];
  
  if (!hasSiteKey) {
    issues.push('Missing reCAPTCHA site key');
  }
  
  if (!hasSecretKey) {
    issues.push('Missing reCAPTCHA secret key');
  }
  
  if (usingTestKeys && nodeEnv === 'production') {
    issues.push('Using Google test keys in production');
  }
  
  if (isDevelopment && !usingTestKeys) {
    issues.push('Development domain without test keys (may need domain configuration)');
  }
  
  return issues;
}

/**
 * Check if reCAPTCHA is properly configured
 * 
 * @returns Whether reCAPTCHA is properly configured
 */
export function isRecaptchaConfigured(): boolean {
  const status = getRecaptchaConfigStatus();
  return status.isProperlyConfigured;
} 
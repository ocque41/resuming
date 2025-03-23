/**
 * Utility functions to check domain configuration for reCAPTCHA
 * 
 * This helps identify common issues with reCAPTCHA domain configuration
 * that might cause verification to fail.
 */

// Constants for Google's test keys
export const RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
export const RECAPTCHA_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

// Production domains registered with reCAPTCHA
export const PRODUCTION_DOMAINS = ['resuming.ai', 'www.resuming.ai'];

/**
 * Check if the test keys are being used
 * Google provides test keys that pass verification but should not be used in production
 */
export function isUsingTestKeys(): boolean {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  return siteKey === RECAPTCHA_TEST_SITE_KEY || secretKey === RECAPTCHA_TEST_SECRET_KEY;
}

/**
 * Check if the provided site key is Google's test key
 */
export const isTestReCaptchaSiteKey = (siteKey: string): boolean => {
  return siteKey === RECAPTCHA_TEST_SITE_KEY;
};

/**
 * Check if the provided secret key is Google's test key
 */
export const isTestReCaptchaSecretKey = (secretKey: string): boolean => {
  return secretKey === RECAPTCHA_TEST_SECRET_KEY;
};

/**
 * Get the current domain from various environment variables
 * This is a best-effort approach as exact domain can't always be determined server-side
 */
export function getCurrentDomain(): string {
  // Check various sources for domain info
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const siteUrl = process.env.SITE_URL;
  
  // Use SITE_URL if available as it's specifically set
  if (siteUrl) {
    return siteUrl;
  }
  
  // Parse from APP_URL if available
  if (appUrl) {
    try {
      const url = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`);
      return url.hostname;
    } catch (e) {
      console.error('Error parsing NEXT_PUBLIC_APP_URL:', e);
    }
  }
  
  // Use Vercel URL if deployed there
  if (vercelUrl) {
    return vercelUrl;
  }
  
  // Default for local development
  if (process.env.NODE_ENV === 'development') {
    return 'localhost';
  }
  
  // Fallback to production domain
  return PRODUCTION_DOMAINS[0];
}

/**
 * Formats a domain for display and comparison
 * Removes www. prefix and normalizes
 */
export function formatDomain(domain: string): string {
  if (!domain) return '';
  
  let formatted = domain.toLowerCase().trim();
  
  // Remove protocol if present
  if (formatted.startsWith('http://')) {
    formatted = formatted.substring(7);
  } else if (formatted.startsWith('https://')) {
    formatted = formatted.substring(8);
  }
  
  // Remove www. prefix for consistent comparison
  if (formatted.startsWith('www.')) {
    formatted = formatted.substring(4);
  }
  
  // Remove port and path
  formatted = formatted.split(':')[0];
  formatted = formatted.split('/')[0];
  
  return formatted;
}

/**
 * Check if the current domain is a development domain
 * Development domains don't need to be registered with reCAPTCHA
 */
export function isDevelopmentDomain(domain?: string): boolean {
  const domainToCheck = domain || getCurrentDomain();
  const formattedDomain = formatDomain(domainToCheck);
  
  // Check for local development domains
  const developmentDomains = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '[::1]', // IPv6 localhost
  ];
  
  // Check if domain ends with development TLDs
  const isDevelopmentTLD = 
    formattedDomain.endsWith('.local') || 
    formattedDomain.endsWith('.test') || 
    formattedDomain.endsWith('.example') || 
    formattedDomain.endsWith('.invalid') || 
    formattedDomain.endsWith('.localhost');
  
  return developmentDomains.includes(formattedDomain) || isDevelopmentTLD;
}

/**
 * Check if the domain is a registered production domain
 */
export function isProductionDomain(domain?: string): boolean {
  const domainToCheck = domain || getCurrentDomain();
  const formattedDomain = formatDomain(domainToCheck);
  
  // Check against normalized production domains
  const normalizedProductionDomains = PRODUCTION_DOMAINS.map(formatDomain);
  
  return normalizedProductionDomains.includes(formattedDomain);
}

/**
 * Check if domain is a Vercel preview deployment
 */
export function isVercelPreviewDomain(domain?: string): boolean {
  const domainToCheck = domain || getCurrentDomain();
  return domainToCheck.includes('vercel.app') && !domainToCheck.includes('-production');
}

/**
 * Get comprehensive status about the current reCAPTCHA configuration
 * This helps with debugging and provides actionable insights
 */
export function getRecaptchaConfigStatus() {
  // Check keys
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  const hasSiteKey = !!siteKey;
  const hasSecretKey = !!secretKey;
  
  // Check domain information
  const domain = getCurrentDomain();
  const formattedDomain = formatDomain(domain);
  const isDevelopment = isDevelopmentDomain(domain);
  const isProduction = isProductionDomain(domain);
  const isVercelPreview = isVercelPreviewDomain(domain);
  
  // Check if using test keys
  const usingTestKeys = isUsingTestKeys();
  
  // Environment info
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Get a list of potential issues
  const potentialIssues = getPotentialIssues(
    hasSiteKey,
    hasSecretKey,
    usingTestKeys,
    isDevelopment,
    isProduction,
    nodeEnv
  );
  
  // Check if the configuration is properly set up
  const isProperlyConfigured = (
    hasSiteKey && 
    hasSecretKey && 
    (nodeEnv !== 'production' || !usingTestKeys) && // No test keys in production
    (isDevelopment || isProduction) &&
    potentialIssues.length === 0
  );

  return {
    hasSiteKey,
    hasSecretKey,
    domain: formattedDomain,
    originalDomain: domain,
    usingTestKeys,
    isDevelopment,
    isProduction,
    isVercelPreview,
    allowedDomains: PRODUCTION_DOMAINS,
    environment: nodeEnv,
    isProperlyConfigured,
    potentialIssues,
    timestamp: new Date().toISOString()
  };
}

/**
 * Determine potential issues with the reCAPTCHA configuration
 * Returns a list of potential issues, empty if none
 */
function getPotentialIssues(
  hasSiteKey: boolean, 
  hasSecretKey: boolean,
  usingTestKeys: boolean,
  isDevelopment: boolean,
  isProduction: boolean,
  nodeEnv: string
): string[] {
  const issues: string[] = [];
  
  // Missing keys
  if (!hasSiteKey && !hasSecretKey) {
    issues.push('Both site key and secret key are missing');
  } else if (!hasSiteKey) {
    issues.push('Site key is missing');
  } else if (!hasSecretKey) {
    issues.push('Secret key is missing');
  }
  
  // Test keys in production
  if (usingTestKeys && nodeEnv === 'production') {
    issues.push('Using test keys in production environment');
  }
  
  // Domain issues
  if (!isDevelopment && !isProduction && nodeEnv === 'production') {
    issues.push(`Current domain is not registered. Allowed domains: ${PRODUCTION_DOMAINS.join(', ')}`);
  }
  
  return issues;
}

/**
 * Simplified check if reCAPTCHA is properly configured
 * Use getRecaptchaConfigStatus() for more detailed information
 */
export function isRecaptchaConfigured(): boolean {
  const status = getRecaptchaConfigStatus();
  return status.isProperlyConfigured;
}

/**
 * Checks if a domain matches or is a subdomain of an allowed domain
 */
export function isDomainAllowed(domain: string, allowedDomains: string[] = PRODUCTION_DOMAINS): boolean {
  const formattedDomain = formatDomain(domain);
  
  // Development domains are always allowed
  if (isDevelopmentDomain(domain)) {
    return true;
  }
  
  // Check for exact match or subdomain match
  return allowedDomains.some(allowedDomain => {
    const formattedAllowedDomain = formatDomain(allowedDomain);
    
    // Check if it's an exact match
    if (formattedDomain === formattedAllowedDomain) {
      return true;
    }
    
    // Check if it's a subdomain (domain ends with .allowedDomain)
    if (formattedAllowedDomain && formattedDomain.endsWith(`.${formattedAllowedDomain}`)) {
      return true;
    }
    
    return false;
  });
} 
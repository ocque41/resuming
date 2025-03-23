/**
 * Test script for checking reCAPTCHA environment variables
 * 
 * This script verifies that reCAPTCHA is properly configured in your environment.
 * It checks for:
 * 1. Presence of site key and secret key
 * 2. Correct length and format of keys
 * 3. Whether test keys are being used
 * 4. Domain configuration
 * 
 * Run with: node scripts/test-recaptcha-env.js
 */

require('dotenv').config();

// Constants for tests
const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // Google's test key
const PRODUCTION_SITE_KEY = '6LcX-vwqAAAAAMdAK0K7JlSyCqO6GOp27myEnlh2'; // User's site key
const EXPECTED_KEY_LENGTH = 40;
const SITE_KEY_REGEX = /^[0-9A-Za-z_-]{40}$/;
const SECRET_KEY_REGEX = /^[0-9A-Za-z_-]{40}$/;
const PRODUCTION_DOMAINS = ['resuming.ai', 'www.resuming.ai'];

/**
 * Check if a key is valid by testing length and format
 * @param {string} name Key name for display
 * @param {string} key The key to check
 * @param {string} testKey Test key to compare against
 * @param {RegExp} regex Pattern to validate the key
 * @returns {Object} Object with success status and messages
 */
function checkKey(name, key, testKey, regex) {
  // Check if key exists
  if (!key) {
    return {
      success: false,
      message: `${name} is not configured in the environment`,
      details: {
        exists: false,
        isTest: false,
        validFormat: false,
        validLength: false,
      }
    };
  }

  // Check if it's a test key
  const isTestKey = key === testKey;
  const validFormat = regex.test(key);
  const validLength = key.length === EXPECTED_KEY_LENGTH;
  
  // Only show prefix and suffix for logging
  const keyPrefix = key.substring(0, 6);
  const keySuffix = key.substring(key.length - 4);
  
  return {
    success: validFormat && validLength,
    message: isTestKey 
      ? `${name} is set to Google's test key (not for production use)`
      : `${name} is ${validFormat && validLength ? 'properly' : 'improperly'} configured`,
    details: {
      exists: true,
      isTest: isTestKey,
      validFormat,
      validLength,
      keyPrefix,
      keySuffix
    }
  };
}

/**
 * Get the application domain from various sources
 * @returns {string} The detected domain
 */
function getAppDomain() {
  // Try different environment variables
  const siteUrl = process.env.SITE_URL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_URL;
  
  // Use SITE_URL if set (most specific)
  if (siteUrl) {
    return formatDomain(siteUrl);
  }
  
  // Check app URL
  if (appUrl) {
    try {
      const url = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`);
      return formatDomain(url.hostname);
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Use Vercel URL for preview/production deployments
  if (vercelUrl) {
    return formatDomain(vercelUrl);
  }
  
  // Default for local development
  if (process.env.NODE_ENV === 'development') {
    return 'localhost';
  }
  
  // Fallback to first production domain
  return PRODUCTION_DOMAINS[0];
}

/**
 * Format domain by removing www. and protocol
 */
function formatDomain(domain) {
  if (!domain) return '';
  
  let formatted = domain.toLowerCase().trim();
  
  // Remove protocol
  if (formatted.startsWith('http://')) {
    formatted = formatted.substring(7);
  } else if (formatted.startsWith('https://')) {
    formatted = formatted.substring(8);
  }
  
  // Remove www.
  if (formatted.startsWith('www.')) {
    formatted = formatted.substring(4);
  }
  
  // Remove port and path
  formatted = formatted.split(':')[0];
  formatted = formatted.split('/')[0];
  
  return formatted;
}

/**
 * Check if a domain is a development domain
 */
function isDevelopmentDomain(domain) {
  const formatted = formatDomain(domain);
  
  return (
    formatted === 'localhost' ||
    formatted === '127.0.0.1' ||
    formatted.endsWith('.local') ||
    formatted.endsWith('.test')
  );
}

/**
 * Check if a domain is a production domain
 */
function isProductionDomain(domain) {
  const formatted = formatDomain(domain);
  return PRODUCTION_DOMAINS.map(d => formatDomain(d)).includes(formatted);
}

/**
 * Test reCAPTCHA configuration and provide a detailed report
 */
function testRecaptchaConfig() {
  console.log('reCAPTCHA Configuration Test');
  console.log('===========================');
  
  // Get keys from environment variables or fallbacks
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || PRODUCTION_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  // Get environment info
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  
  // Check each key
  const siteKeyResult = checkKey('Site key', siteKey, TEST_SITE_KEY, SITE_KEY_REGEX);
  const secretKeyResult = checkKey('Secret key', secretKey, TEST_SITE_KEY, SECRET_KEY_REGEX);
  
  // Check domain configuration
  const domain = getAppDomain();
  const isDevelopment = isDevelopmentDomain(domain);
  const isProdDomain = isProductionDomain(domain);
  
  console.log('\nEnvironment Information:');
  console.log('------------------------');
  console.log(`NODE_ENV: ${nodeEnv}`);
  console.log(`Current domain: ${domain}`);
  console.log(`Is development domain: ${isDevelopment}`);
  console.log(`Is production domain: ${isProdDomain}`);
  
  console.log('\nSite Key Check:');
  console.log('---------------');
  console.log(`Status: ${siteKeyResult.success ? 'VALID ✅' : 'INVALID ❌'}`);
  console.log(`Message: ${siteKeyResult.message}`);
  console.log(`Key format valid: ${siteKeyResult.details.validFormat ? 'Yes' : 'No'}`);
  console.log(`Using test key: ${siteKeyResult.details.isTest ? 'Yes (not for production)' : 'No'}`);
  
  console.log('\nSecret Key Check:');
  console.log('-----------------');
  console.log(`Status: ${secretKeyResult.success ? 'VALID ✅' : 'INVALID ❌'}`);
  console.log(`Message: ${secretKeyResult.message}`);
  console.log(`Key format valid: ${secretKeyResult.details.validFormat ? 'Yes' : 'No'}`);
  console.log(`Using test key: ${secretKeyResult.details.isTest ? 'Yes (not for production)' : 'No'}`);
  
  console.log('\nDomain Configuration Check:');
  console.log('---------------------------');
  console.log(`Detected domain: ${domain}`);
  console.log(`Allowed domains: ${PRODUCTION_DOMAINS.join(', ')}`);
  console.log(`Domain configuration: ${isProdDomain ? 'VALID ✅' : isDevelopment ? 'DEVELOPMENT ℹ️' : 'INVALID ❌'}`);
  
  const domainMessage = isProdDomain 
    ? `Domain '${domain}' is properly configured as a production domain` 
    : isDevelopment 
      ? `Domain '${domain}' is a development domain (no registration needed)` 
      : `Domain '${domain}' is NOT registered as an allowed domain. Add it to the reCAPTCHA admin console.`;
  
  console.log(`Message: ${domainMessage}`);
  
  // Overall status
  const isValid = (
    siteKeyResult.success && 
    secretKeyResult.success && 
    (isProdDomain || isDevelopment)
  );
  
  const isProperlyConfigured = isValid && !(isProduction && (siteKeyResult.details.isTest || secretKeyResult.details.isTest));
  
  console.log('\nOverall Configuration Status:');
  console.log('----------------------------');
  console.log(`Status: ${isProperlyConfigured ? 'VALID ✅' : 'INVALID ❌'}`);
  
  const issues = [];
  if (!siteKeyResult.success) issues.push("Invalid site key");
  if (!secretKeyResult.success) issues.push("Invalid secret key");
  if (isProduction && siteKeyResult.details.isTest) issues.push("Using test site key in production");
  if (isProduction && secretKeyResult.details.isTest) issues.push("Using test secret key in production");
  if (!isProdDomain && !isDevelopment) issues.push("Domain not properly configured");
  
  if (issues.length > 0) {
    console.log(`Issues found: ${issues.join(', ')}`);
  } else {
    console.log(`No issues found. reCAPTCHA is properly configured.`);
  }
  
  // Output JSON summary for programmatic use
  console.log('\nConfiguration Summary (JSON):');
  console.log('-----------------------------');
  
  const summary = {
    timestamp: new Date().toISOString(),
    environment: nodeEnv,
    domain: {
      current: domain,
      isProduction: isProdDomain,
      isDevelopment,
      allowed: PRODUCTION_DOMAINS
    },
    siteKey: {
      exists: siteKeyResult.details.exists,
      isValid: siteKeyResult.success,
      isTestKey: siteKeyResult.details.isTest
    },
    secretKey: {
      exists: secretKeyResult.details.exists,
      isValid: secretKeyResult.success,
      isTestKey: secretKeyResult.details.isTest
    },
    isValid: isProperlyConfigured,
    issues: issues.length > 0 ? issues : null
  };
  
  console.log(JSON.stringify(summary, null, 2));
  
  return summary;
}

// Run the test
testRecaptchaConfig(); 
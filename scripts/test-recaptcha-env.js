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

// Constants
const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
const USER_PROVIDED_SITE_KEY = '6LcX-vwqAAAAAMdAK0K7JlSyCqO6GOp27myEnlh2';
const SITE_KEY_REGEX = /^[a-zA-Z0-9_-]{40}$/;
const SECRET_KEY_REGEX = /^[a-zA-Z0-9_-]{40}$/;
const PRODUCTION_DOMAINS = ['resuming.ai', 'www.resuming.ai'];

// Helper functions
function checkKey(name, key, testKey, regex) {
  console.log(`\n=== Checking ${name} ===`);
  
  if (!key) {
    console.error(`❌ ${name} is not set!`);
    return false;
  }
  
  console.log(`✅ ${name} exists: ${key.substring(0, 6)}...${key.substring(key.length - 4)}`);
  console.log(`✅ ${name} length: ${key.length} characters`);
  
  if (key === testKey) {
    console.warn(`⚠️ WARNING: Using Google's test ${name.toLowerCase()}! This is not secure for production.`);
    return true;
  }
  
  if (key === USER_PROVIDED_SITE_KEY) {
    console.log(`✅ Using user-provided site key.`);
    return true;
  }
  
  if (!regex.test(key)) {
    console.warn(`⚠️ ${name} format may not be valid - expected 40 characters consisting of letters, numbers, underscores, and hyphens.`);
    return false;
  }
  
  return true;
}

function getAppDomain() {
  // Override for testing production domain
  const forceDomain = process.env.FORCE_DOMAIN;
  if (forceDomain) {
    return forceDomain;
  }
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const siteUrl = process.env.SITE_URL;
  
  if (appUrl) {
    try {
      // Parse URL to extract domain
      const url = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`);
      return url.hostname;
    } catch (e) {
      console.error('Error parsing APP_URL:', e.message);
    }
  }
  
  if (siteUrl) {
    return siteUrl;
  }
  
  if (vercelUrl) {
    return vercelUrl;
  }
  
  // Default to production domain if no other is found
  return PRODUCTION_DOMAINS[0];
}

function isDevelopmentDomain(domain) {
  const devDomains = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '[::1]'
  ];
  
  return devDomains.includes(domain) || 
    domain.endsWith('.local') || 
    domain.endsWith('.test') || 
    domain.endsWith('.example') || 
    domain.endsWith('.localhost');
}

function isProductionDomain(domain) {
  return PRODUCTION_DOMAINS.includes(domain);
}

// Main test function
function testRecaptchaConfig() {
  console.log('===== reCAPTCHA Configuration Test =====');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('=======================================');
  
  // Check site key
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const siteKeyValid = checkKey('Site Key', siteKey, TEST_SITE_KEY, SITE_KEY_REGEX);
  
  // Check secret key
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const secretKeyValid = checkKey('Secret Key', secretKey, TEST_SECRET_KEY, SECRET_KEY_REGEX);
  
  // Check domain configuration
  console.log('\n=== Checking Domain Configuration ===');
  const domain = getAppDomain();
  console.log(`Current domain: ${domain}`);
  
  if (isDevelopmentDomain(domain)) {
    console.log('✅ Development domain detected - no domain verification required for reCAPTCHA.');
  } else if (isProductionDomain(domain)) {
    console.log(`✅ Production domain detected: "${domain}" should be registered in the reCAPTCHA admin console.`);
  } else {
    console.warn(`⚠️ Unknown domain: "${domain}" - verify that this domain is registered in the reCAPTCHA admin console.`);
  }
  
  // Check if domain matches what's in .env
  if (process.env.SITE_URL && domain !== process.env.SITE_URL) {
    console.warn(`⚠️ Domain mismatch: Current domain "${domain}" doesn't match SITE_URL "${process.env.SITE_URL}" in .env file.`);
  }
  
  // Check environment variables
  console.log('\n=== Environment Variables ===');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV || 'not set'}`);
  console.log(`APP_URL: ${process.env.APP_URL || 'not set'}`);
  console.log(`NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || 'not set'}`);
  console.log(`VERCEL_URL: ${process.env.VERCEL_URL || 'not set'}`);
  console.log(`SITE_URL: ${process.env.SITE_URL || 'not set'}`);
  
  // Summary
  console.log('\n===== Test Summary =====');
  if (siteKeyValid && secretKeyValid) {
    console.log('✅ PASS: Both site key and secret key are properly configured.');
    
    if (siteKey === TEST_SITE_KEY || secretKey === TEST_SECRET_KEY) {
      console.warn('⚠️ WARNING: Using Google test keys. These are not secure for production!');
    }
    
    if (!isDevelopmentDomain(domain) && process.env.NODE_ENV === 'production') {
      console.log('ℹ️ REMINDER: Ensure your domain is registered in the reCAPTCHA admin console.');
    }
  } else {
    console.error('❌ FAIL: reCAPTCHA is not properly configured.');
    
    if (!siteKeyValid) {
      console.error('  - Site key is missing or invalid.');
    }
    
    if (!secretKeyValid) {
      console.error('  - Secret key is missing or invalid.');
    }
  }
  
  // Output full status
  const isProperlyConfigured = siteKeyValid && secretKeyValid;
  const usingTestKeys = siteKey === TEST_SITE_KEY || secretKey === TEST_SECRET_KEY;
  const isDevelopment = process.env.NODE_ENV === 'development' || isDevelopmentDomain(domain);
  const isProduction = isProductionDomain(domain) && process.env.NODE_ENV === 'production';
  
  console.log('\n=== Configuration Status Object ===');
  console.log(JSON.stringify({
    isProperlyConfigured,
    hasSiteKey: !!siteKey,
    hasSecretKey: !!secretKey,
    usingTestKeys,
    domain,
    isDevelopment,
    isProduction,
    environment: process.env.NODE_ENV || 'development',
    registeredDomains: PRODUCTION_DOMAINS,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log('\n===== Test Complete =====');
}

// Run the test
testRecaptchaConfig(); 
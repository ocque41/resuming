/**
 * Test script to validate reCAPTCHA configuration
 * This script checks that the environment variables are correctly set
 * and validates domain configuration.
 */
require('dotenv').config();

// Constants
const GOOGLE_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const GOOGLE_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
const PRODUCTION_DOMAINS = ['resuming.ai', 'www.resuming.ai'];

console.log('====================================');
console.log('reCAPTCHA Configuration Test');
console.log('====================================');

// Check environment
console.log(`\nEnvironment: ${process.env.NODE_ENV || 'development'}`);

// Check site key
const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
console.log(`\n[Site Key]`);
console.log(`Exists: ${!!siteKey ? '✅ YES' : '❌ NO'}`);

if (siteKey) {
  const isTestKey = siteKey === GOOGLE_TEST_SITE_KEY;
  const keyLength = siteKey.length;
  const keyValid = keyLength === 40;
  const keyFirstChars = siteKey.substring(0, 6);
  const keyLastChars = siteKey.substring(keyLength - 4);
  
  console.log(`Length: ${keyLength} characters ${keyValid ? '✅' : '❌'}`);
  console.log(`Format: ${keyValid ? '✅ Valid' : '❌ Invalid'} (should be 40 characters)`);
  console.log(`Test key: ${isTestKey ? '⚠️ YES - not for production' : '✅ NO'}`);
  console.log(`Key preview: ${keyFirstChars}...${keyLastChars}`);
}

// Check secret key
const secretKey = process.env.RECAPTCHA_SECRET_KEY;
console.log(`\n[Secret Key]`);
console.log(`Exists: ${!!secretKey ? '✅ YES' : '❌ NO'}`);

if (secretKey) {
  const isTestKey = secretKey === GOOGLE_TEST_SECRET_KEY;
  const keyLength = secretKey.length;
  const keyValid = keyLength === 40;
  const keyFirstChars = secretKey.substring(0, 6);
  const keyLastChars = secretKey.substring(keyLength - 4);
  
  console.log(`Length: ${keyLength} characters ${keyValid ? '✅' : '❌'}`);
  console.log(`Format: ${keyValid ? '✅ Valid' : '❌ Invalid'} (should be 40 characters)`);
  console.log(`Test key: ${isTestKey ? '⚠️ YES - not for production' : '✅ NO'}`);
  console.log(`Key preview: ${keyFirstChars}...${keyLastChars}`);
}

// Check domain configuration
console.log(`\n[Domain Configuration]`);
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const siteUrl = process.env.SITE_URL;
const vercelUrl = process.env.VERCEL_URL;

console.log(`SITE_URL: ${siteUrl || 'Not set'}`);
console.log(`NEXT_PUBLIC_APP_URL: ${appUrl || 'Not set'}`);
console.log(`VERCEL_URL: ${vercelUrl || 'Not set'}`);

// Get current domain
const currentDomain = siteUrl || 
                    (appUrl ? (function() {
                      try {
                        return new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).hostname;
                      } catch (e) {
                        return appUrl;
                      }
                    })() : '') || 
                    vercelUrl || 
                    'localhost';

console.log(`Current domain: ${currentDomain}`);

// Check if current domain is registered
const isProductionDomain = PRODUCTION_DOMAINS.includes(currentDomain);
const isDevelopmentDomain = ['localhost', '127.0.0.1'].includes(currentDomain) || 
                          currentDomain.endsWith('.local') || 
                          currentDomain.endsWith('.test');

console.log(`Production domain: ${isProductionDomain ? '✅ YES' : '❌ NO'}`);
console.log(`Development domain: ${isDevelopmentDomain ? '✅ YES' : '❌ NO'}`);

// Determine if the configuration is valid
const siteKeyIsTest = siteKey === GOOGLE_TEST_SITE_KEY;
const secretKeyIsTest = secretKey === GOOGLE_TEST_SECRET_KEY;
const configValid = (!!siteKey && !!secretKey) && 
                  ((process.env.NODE_ENV === 'production' && !siteKeyIsTest && !secretKeyIsTest) || 
                   process.env.NODE_ENV !== 'production') &&
                  (isProductionDomain || isDevelopmentDomain);

console.log(`\n[Overall Status]`);
console.log(`Configuration valid: ${configValid ? '✅ YES' : '❌ NO'}`);

// Check for specific issues
const issues = [];

if (!siteKey) issues.push('Missing site key');
if (!secretKey) issues.push('Missing secret key');
if (siteKey === GOOGLE_TEST_SITE_KEY && process.env.NODE_ENV === 'production') {
  issues.push('Using Google test site key in production');
}
if (secretKey === GOOGLE_TEST_SECRET_KEY && process.env.NODE_ENV === 'production') {
  issues.push('Using Google test secret key in production');
}
if (!isProductionDomain && !isDevelopmentDomain && process.env.NODE_ENV === 'production') {
  issues.push(`Domain "${currentDomain}" is not registered. Allowed domains: ${PRODUCTION_DOMAINS.join(', ')}`);
}

if (issues.length > 0) {
  console.log('\n[Issues Detected]');
  issues.forEach(issue => console.log(`- ❌ ${issue}`));
} else {
  console.log('No issues detected ✅');
}

console.log('\n====================================');
console.log('Test completed');
console.log('====================================');

// Exit with appropriate status code
process.exit(configValid ? 0 : 1); 
// Script to test reCAPTCHA environment variables
// Run with: node scripts/test-recaptcha-env.js

require('dotenv').config();

console.log('\n===== RECAPTCHA ENVIRONMENT VARIABLE TEST =====\n');

// Check for site key
const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY exists:', !!siteKey);
if (siteKey) {
  console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY length:', siteKey.length);
  console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY first 6 chars:', siteKey.substring(0, 6));
  console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY last 4 chars:', siteKey.substring(siteKey.length - 4));
}

// Check for secret key
const secretKey = process.env.RECAPTCHA_SECRET_KEY;
console.log('\nRECAPTCHA_SECRET_KEY exists:', !!secretKey);
if (secretKey) {
  console.log('RECAPTCHA_SECRET_KEY length:', secretKey.length);
  console.log('RECAPTCHA_SECRET_KEY first 6 chars:', secretKey.substring(0, 6));
  console.log('RECAPTCHA_SECRET_KEY last 4 chars:', secretKey.substring(secretKey.length - 4));
}

// Google's test keys
const googleTestSiteKey = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const googleTestSecretKey = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

console.log('\n--- Key Validation ---');
console.log('Using Google test site key:', siteKey === googleTestSiteKey);
console.log('Using Google test secret key:', secretKey === googleTestSecretKey);

// Check key format
console.log('\n--- Format Validation ---');
const siteKeyFormat = /^[0-9A-Za-z_-]{40}$/.test(siteKey || '');
const secretKeyFormat = /^[0-9A-Za-z_-]{40}$/.test(secretKey || '');
console.log('Site key format appears valid:', siteKeyFormat);
console.log('Secret key format appears valid:', secretKeyFormat);

// Check application environment
console.log('\n--- Environment ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL_ENV:', process.env.VERCEL_ENV || 'Not set');
console.log('APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'Not set');
console.log('VERCEL_URL:', process.env.VERCEL_URL || 'Not set');

console.log('\n=== TEST COMPLETE ===\n'); 
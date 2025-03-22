// Test script to verify reCAPTCHA configuration
require('dotenv').config();

console.log('reCAPTCHA Configuration Test');
console.log('--------------------------');
console.log('Environment:', process.env.NODE_ENV);
console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY exists:', !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
  console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY length:', process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length);
  console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY first 5 chars:', process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 5));
  console.log('NEXT_PUBLIC_RECAPTCHA_SITE_KEY last 5 chars:', process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length - 5));
}

console.log('RECAPTCHA_SECRET_KEY exists:', !!process.env.RECAPTCHA_SECRET_KEY);
if (process.env.RECAPTCHA_SECRET_KEY) {
  console.log('RECAPTCHA_SECRET_KEY length:', process.env.RECAPTCHA_SECRET_KEY.length);
  console.log('RECAPTCHA_SECRET_KEY first 5 chars:', process.env.RECAPTCHA_SECRET_KEY.substring(0, 5));
  console.log('RECAPTCHA_SECRET_KEY last 5 chars:', process.env.RECAPTCHA_SECRET_KEY.substring(process.env.RECAPTCHA_SECRET_KEY.length - 5));
}

// Check if keys match Google's test keys
const googleTestSiteKey = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const googleTestSecretKey = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

console.log('\nValidation:');
console.log('Is using Google test site key:', process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY === googleTestSiteKey);
console.log('Is using Google test secret key:', process.env.RECAPTCHA_SECRET_KEY === googleTestSecretKey);

// Check key lengths
const validKeyLength = 40;
console.log('\nKey Length Validation:');
console.log('Site key length is valid:', process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.length === validKeyLength);
console.log('Secret key length is valid:', process.env.RECAPTCHA_SECRET_KEY?.length === validKeyLength);

console.log('\nDomain Settings:');
console.log('Note: Make sure your domain is properly configured in the reCAPTCHA admin console');
console.log('Current domain:', process.env.NEXT_PUBLIC_APP_URL || 'Not set'); 
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * GET handler for checking if reCAPTCHA is correctly configured for the domain
 */
export async function GET(request: NextRequest) {
  // Get the request headers and URL information
  const headers = Object.fromEntries(request.headers.entries());
  const url = new URL(request.url);
  const host = url.host;
  const origin = url.origin;
  const referer = request.headers.get('referer') || 'No referer';
  
  // Get the environment variables related to reCAPTCHA
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 'Not set';
  const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY ? 'Set (hidden)' : 'Not set';
  
  // Get other relevant environment variables
  const vercelUrl = process.env.VERCEL_URL || 'Not set';
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'Not set';
  const nodeEnv = process.env.NODE_ENV || 'Not set';
  
  // Check if we're running in a local development environment
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  
  // For local development, sometimes we need to test with the test keys
  const isUsingTestKeys = recaptchaSiteKey === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
  
  let recaptchaStatus = 'Unknown';
  let recaptchaMessage = '';
  let allowedDomains: string[] = [];
  
  // Attempt to get reCAPTCHA site key info from Google (only works for test keys)
  // This is only for diagnostic purposes - real production keys won't return this info
  try {
    if (isUsingTestKeys) {
      recaptchaStatus = 'Using Google test keys (6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI)';
      recaptchaMessage = 'Test keys will always pass verification but should not be used in production';
      allowedDomains = ['All domains (test key)'];
    } else if (isLocalhost) {
      recaptchaStatus = 'Local development';
      recaptchaMessage = 'For local development, ensure your reCAPTCHA key is configured for localhost or 127.0.0.1';
      allowedDomains = ['localhost', '127.0.0.1'];
    } else {
      recaptchaStatus = 'Production environment';
      recaptchaMessage = 'Ensure your reCAPTCHA key is configured for this domain';
      
      // We can't actually know the allowed domains without Google's admin API
      allowedDomains = [host];
    }
  } catch (error) {
    console.error('Error checking reCAPTCHA configuration:', error);
    recaptchaStatus = 'Error checking configuration';
    recaptchaMessage = error instanceof Error ? error.message : String(error);
  }
  
  // Compile the response
  const response = {
    recaptcha: {
      siteKey: recaptchaSiteKey.substring(0, 8) + '...',
      secretKey: recaptchaSecretKey,
      status: recaptchaStatus,
      message: recaptchaMessage,
      isUsingTestKeys,
      supportedBrowsers: [
        'Chrome', 'Firefox', 'Safari', 'Edge',
        'Chrome for Android', 'iOS Safari'
      ]
    },
    environment: {
      nodeEnv,
      vercelUrl,
      nextPublicAppUrl,
      isVercel: !!process.env.VERCEL,
      isLocalhost
    },
    request: {
      host,
      origin,
      referer,
      userAgent: headers['user-agent'] || 'Unknown',
      acceptLanguage: headers['accept-language'] || 'Unknown',
      isSecure: url.protocol === 'https:',
      method: request.method
    },
    domains: {
      current: host,
      allowedDomains,
      recommendations: isLocalhost
        ? ['Configure reCAPTCHA for localhost or use test keys during development']
        : ['Ensure domain is added to reCAPTCHA configuration in Google Console']
    }
  };
  
  return NextResponse.json(response);
} 
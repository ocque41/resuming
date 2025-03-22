import { NextRequest, NextResponse } from 'next/server';
import { getRecaptchaConfigStatus } from '@/lib/recaptcha/domain-check';

/**
 * API endpoint to check reCAPTCHA configuration
 * This allows the client to verify if the reCAPTCHA keys are properly set
 * without exposing sensitive information
 */
export async function GET(request: NextRequest) {
  // Get the reCAPTCHA site key from environment variables
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const secretKeyExists = !!process.env.RECAPTCHA_SECRET_KEY;
  
  // Determine the current domain
  const domain = request.headers.get('host') || 
                process.env.NEXT_PUBLIC_APP_URL || 
                process.env.VERCEL_URL || 
                '';
  
  // Check if site key is defined 
  const isSiteKeyConfigured = !!siteKey;

  // Get more detailed configuration status
  const configStatus = getRecaptchaConfigStatus();
  
  // Create a configuration object with safe information (no full keys exposed)
  const config = {
    isSiteKeyConfigured,
    secretKeyExists,
    siteKeyLength: siteKey?.length || 0,
    siteKeyPrefix: siteKey ? `${siteKey.substring(0, 6)}...` : null,
    domain,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    // Include a sanitized version of the config status
    configStatus: {
      hasSiteKey: configStatus.hasSiteKey,
      hasSecretKey: configStatus.hasSecretKey,
      domain: configStatus.domain,
      usingTestKeys: configStatus.usingTestKeys,
      isDevelopment: configStatus.isDevelopment,
      environment: configStatus.environment,
      isProperlyConfigured: configStatus.isProperlyConfigured,
      potentialIssues: configStatus.potentialIssues,
    }
  };
  
  // Google's test key - indicate if we're using it
  const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
  const isUsingTestKey = siteKey === TEST_SITE_KEY;
  
  // Add CORS headers to ensure the endpoint can be accessed from different origins during testing
  const headers = new Headers();
  headers.append('Access-Control-Allow-Origin', '*');
  headers.append('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  return NextResponse.json(
    {
      status: 'ok',
      config,
      isUsingTestKey,
      // Make sure to always include the siteKey for client-side usage
      // This is critical for the reCAPTCHA widget to initialize
      siteKey: siteKey || '',
    },
    { 
      status: 200,
      headers
    }
  );
} 
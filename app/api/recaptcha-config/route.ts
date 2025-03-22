import { NextRequest, NextResponse } from 'next/server';

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
  
  // Create a configuration object with safe information (no full keys exposed)
  const config = {
    isSiteKeyConfigured,
    secretKeyExists,
    siteKeyLength: siteKey?.length || 0,
    siteKeyPrefix: siteKey ? `${siteKey.substring(0, 6)}...` : null,
    domain,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };
  
  // Google's test key - indicate if we're using it
  const TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
  const isUsingTestKey = siteKey === TEST_SITE_KEY;
  
  return NextResponse.json({
    status: 'ok',
    config,
    isUsingTestKey,
    // Include the full site key only if it's the test key or we're in development
    siteKey: isUsingTestKey || process.env.NODE_ENV === 'development' ? siteKey : undefined
  });
} 
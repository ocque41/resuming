import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Tests a reCAPTCHA site key by checking its validity and origin info
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteKey } = body;
    
    if (!siteKey) {
      return NextResponse.json(
        { error: 'Site key is required' },
        { status: 400 }
      );
    }
    
    // Check if it's Google's test key (always valid)
    const isGoogleTestKey = siteKey === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
    
    if (isGoogleTestKey) {
      return NextResponse.json({
        valid: true,
        isTestKey: true,
        message: 'This is Google\'s test key which always passes verification',
        warning: 'Test keys should not be used in production',
        status: 'test_key',
        domains: ['All domains'],
        allowedOrigins: ['All origins']
      });
    }
    
    // For actual keys, we can check some basic formatting but can't fully validate
    // without access to Google's admin API (which requires admin privileges)
    const validFormat = /^[0-9A-Za-z_-]{40}$/.test(siteKey);
    
    // Check if it's our own environment key
    const isEnvKey = siteKey === process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    
    const url = new URL(request.url);
    const host = url.host;
    const origin = url.origin;
    
    return NextResponse.json({
      valid: validFormat,
      isTestKey: false,
      isEnvKey,
      message: validFormat 
        ? 'The key format appears valid, but full validation requires testing with the reCAPTCHA widget'
        : 'The key format appears invalid. reCAPTCHA site keys are typically 40 characters',
      format: validFormat ? 'valid' : 'invalid',
      keyLength: siteKey.length,
      expectedLength: 40,
      request: {
        host,
        origin
      }
    });
  } catch (error) {
    console.error('Error testing reCAPTCHA site key:', error);
    
    return NextResponse.json(
      { 
        error: 'Error testing reCAPTCHA site key',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
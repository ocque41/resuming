import { NextResponse } from 'next/server';

export async function GET() {
  // Only show this in development for security
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development mode' }, { status: 403 });
  }

  return NextResponse.json({
    hasClientId: !!process.env.COGNITO_CLIENT_ID,
    hasClientSecret: !!process.env.COGNITO_CLIENT_SECRET,
    hasUserPoolId: !!process.env.COGNITO_USER_POOL_ID,
    hasRegion: !!process.env.COGNITO_REGION,
    envKeys: Object.keys(process.env).filter(key => key.startsWith('COGNITO_')),
    region: process.env.COGNITO_REGION,
  }, { status: 200 });
} 
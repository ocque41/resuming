// app/api/auth/dropbox/callback/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  console.log("Dropbox callback received code:", code, "state:", state);
  
  // For testing purposes, simply return the code.
  return NextResponse.json({ code, state });
}

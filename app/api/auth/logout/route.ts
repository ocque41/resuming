import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Clear the session cookie
    (await cookies()).delete('session');
    
    // Redirect to login page
    return NextResponse.redirect(new URL('/login', process.env.BASE_URL || 'http://localhost:3000'));
  } catch (error) {
    console.error('Error logging out:', error);
    return NextResponse.redirect(
      new URL('/login?error=logout-failed', process.env.BASE_URL || 'http://localhost:3000')
    );
  }
} 
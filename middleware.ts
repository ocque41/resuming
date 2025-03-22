import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';
import { DbOperationError } from '@/lib/db/error-handler';

const protectedRoutes = '/dashboard';

// Function to determine if an error is database-related
const isDatabaseError = (error: unknown): boolean => {
  if (error instanceof DbOperationError) return true;
  
  if (error instanceof Error) {
    const errorMsg = error.message.toLowerCase();
    return (
      errorMsg.includes('database') ||
      errorMsg.includes('pg:') ||
      errorMsg.includes('postgres') ||
      errorMsg.includes('column') ||
      errorMsg.includes('sql') ||
      errorMsg.includes('db')
    );
  }
  
  return false;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);

  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  let res = NextResponse.next();

  if (sessionCookie) {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const maxAgeInSeconds = 24 * 60 * 60; // 1 day in seconds
      
      res.cookies.set('session', await signToken({
        ...parsed,
        expires: expiresInOneDay.toISOString(),
      }), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: maxAgeInSeconds,
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.cookies.delete('session');
      if (isProtectedRoute) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  try {
    // For actual authentication middleware, use Next.js auth solutions
    // This is a simplified example to demonstrate error handling
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // If it's a database error, handle it specially
    if (isDatabaseError(error)) {
      console.error('Database error caught in middleware:', error);
      
      // Check if this is an API route
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { 
            error: 'Database error', 
            message: 'There was an issue with our database. Our team has been notified.'
          },
          { status: 503 }
        );
      }
      
      // For page requests, redirect to a maintenance page
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
    
    // Pass through other errors to be handled by Next.js
    throw error;
  }
}

export const config = {
  matcher: [
    // Apply to all routes except static files, api routes we don't want to intercept, etc.
    '/((?!_next/static|_next/image|favicon.ico|maintenance).*)',
  ],
};

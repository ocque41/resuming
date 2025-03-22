import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { addOrUpdateNotionUser } from '@/lib/notion/notion';
import { newsletterSubscriptionLimiter } from '@/lib/rate-limiting/upstash';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    // Apply rate limiting based on email
    const rateLimitResult = await newsletterSubscriptionLimiter(`${email}:unsubscribe`);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Too many unsubscribe attempts. Please try again later.',
          reset: rateLimitResult.reset.toISOString()
        },
        { status: 429 }
      );
    }
    
    // Check if user exists in our system
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    // Integration with Notion - update subscription status to false
    try {
      // Keep their current plan, just update the subscribed status to false
      await addOrUpdateNotionUser(email, undefined, false);
    } catch (notionError) {
      console.error('Error updating Notion for unsubscription:', notionError);
      // Continue even if Notion update fails
    }
    
    // If user exists in our system, we could update their preferences here
    if (existingUser.length > 0) {
      // Update user preferences in our database if needed
      // For now, we're just using Notion as our source of truth
    }
    
    return NextResponse.json(
      { 
        message: 'Successfully unsubscribed from newsletter',
        unsubscribed: true
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error unsubscribing from newsletter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
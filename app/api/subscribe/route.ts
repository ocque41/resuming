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
    
    // Apply rate limiting based on email and IP address
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await newsletterSubscriptionLimiter(`${email}:${ip}`);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: rateLimitResult.error || 'Too many subscription attempts. Please try again later.',
          reset: rateLimitResult.reset.toISOString()
        },
        { status: 429 }
      );
    }
    
    // Check if user already exists in our system
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    // Integration with Notion
    try {
      // Plan stays as 'Free' unless already set to something else
      // isSubscribed is true for newsletter subscriptions
      await addOrUpdateNotionUser(email, 'Free', true);
    } catch (notionError) {
      console.error('Error updating Notion for subscription:', notionError);
      // Continue even if Notion update fails
    }
    
    // If user exists in our system, we could update their preferences here
    if (existingUser.length > 0) {
      // Update user preferences in our database if needed
      // For now, we're just using Notion as our source of truth
    }
    
    return NextResponse.json(
      { 
        message: 'Successfully subscribed to newsletter',
        subscribed: true
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
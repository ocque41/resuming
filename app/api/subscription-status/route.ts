import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_SECRET,
});

const databaseId = process.env.NOTION_DB;

export async function GET() {
  try {
    // Get user session using the proper helper
    const session = await getSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user ID from session
    const userId = session.user.id;
    
    // Get the user's email from the database
    const userResult = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userEmail = userResult[0].email;
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }
    
    // Initialize Notion client
    const notionSecret = process.env.NOTION_SECRET;
    const notionDatabaseId = process.env.NOTION_NEWSLETTER_DATABASE_ID || process.env.NOTION_DB;

    if (!notionSecret || !notionDatabaseId) {
      console.error('Notion configuration missing');
      return NextResponse.json(
        { subscribed: false },
        { status: 200 }
      );
    }

    const notion = new Client({
      auth: notionSecret,
    });
    
    // Query Notion database for the user
    const response = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        property: 'Email',
        rich_text: {
          equals: userEmail,
        },
      },
    });

    if (response.results.length > 0) {
      // User found in Notion database
      const page = response.results[0] as any;
      const subscribedProperty = page.properties['Subscribed'];
      
      // Check if user is subscribed
      const isSubscribed = subscribedProperty?.checkbox || false;
      
      return NextResponse.json(
        { subscribed: isSubscribed },
        { status: 200 }
      );
    } else {
      // User not found in Notion
      return NextResponse.json(
        { subscribed: false },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error checking subscription status:', error);
    // Default to not subscribed in case of errors
    return NextResponse.json(
      { subscribed: false },
      { status: 200 }
    );
  }
} 
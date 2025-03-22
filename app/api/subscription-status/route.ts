import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getUser } from '@/lib/db/queries.server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';
import { getSession } from '@/lib/auth/session';

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

    // Get the user ID from session - used for logging
    const userId = session.user.id;
    
    // We need to get the user's email from the database since it's not in the session
    // For now, we'll assume we have an email from another source
    let userEmail = '';
    
    // Initialize Notion client
    const notionSecret = process.env.NOTION_SECRET;
    const notionDatabaseId = process.env.NOTION_NEWSLETTER_DATABASE_ID;

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
    
    // Query the users table to get the email
    // This would typically come from a database query using the user ID
    
    // Let's use a placeholder query for now - in a real implementation,
    // you would get the user's email from your database
    // For example: const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    // userEmail = user.email;
    
    // For demo purposes only - this should be replaced with actual user data
    userEmail = 'user@example.com';
    
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
import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';

/**
 * Add a new user to the Notion database
 */
export async function addUserToNotion(userData: { 
  email: string;
  signupDate?: Date;
  verified?: boolean;
  planName?: string;
  signupIP?: string;
}) {
  try {
    if (!NOTION_DATABASE_ID) {
      console.error('NOTION_DATABASE_ID not set in environment variables');
      return null;
    }

    const response = await notion.pages.create({
      parent: {
        database_id: NOTION_DATABASE_ID,
      },
      properties: {
        Email: {
          title: [
            {
              text: {
                content: userData.email,
              },
            },
          ],
        },
        'Signup Date': {
          date: {
            start: (userData.signupDate || new Date()).toISOString(),
          },
        },
        'Verified': {
          checkbox: userData.verified || false,
        },
        'Plan': {
          select: {
            name: userData.planName || 'Free',
          },
        },
        'IP Address': {
          rich_text: [
            {
              text: {
                content: userData.signupIP || 'Unknown',
              },
            },
          ],
        },
      },
    });

    return response;
  } catch (error) {
    console.error('Error adding user to Notion:', error);
    return null;
  }
}

/**
 * Update user verification status in Notion
 */
export async function updateUserVerificationInNotion(email: string, verified: boolean) {
  try {
    if (!NOTION_DATABASE_ID) {
      console.error('NOTION_DATABASE_ID not set in environment variables');
      return false;
    }

    // First, find the page by email
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Email',
        title: {
          equals: email,
        },
      },
    });

    if (response.results.length === 0) {
      console.error(`No user found with email: ${email}`);
      return false;
    }

    const pageId = response.results[0].id;

    // Update the verification status
    await notion.pages.update({
      page_id: pageId,
      properties: {
        'Verified': {
          checkbox: verified,
        },
        'Verification Date': {
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    });

    return true;
  } catch (error) {
    console.error('Error updating user verification in Notion:', error);
    return false;
  }
}

/**
 * Update user plan in Notion
 */
export async function updateUserPlanInNotion(email: string, planName: string) {
  try {
    if (!NOTION_DATABASE_ID) {
      console.error('NOTION_DATABASE_ID not set in environment variables');
      return false;
    }

    // First, find the page by email
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Email',
        title: {
          equals: email,
        },
      },
    });

    if (response.results.length === 0) {
      console.error(`No user found with email: ${email}`);
      return false;
    }

    const pageId = response.results[0].id;

    // Update the plan
    await notion.pages.update({
      page_id: pageId,
      properties: {
        'Plan': {
          select: {
            name: planName,
          },
        },
        'Plan Update Date': {
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    });

    return true;
  } catch (error) {
    console.error('Error updating user plan in Notion:', error);
    return false;
  }
}

export default notion; 
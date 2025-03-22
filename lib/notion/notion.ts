import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_SECRET,
});

const databaseId = process.env.NOTION_DB;

/**
 * Adds a new user email to the Notion database
 * @param email - User's email
 * @param planName - User's plan name (Free or Moonlighting)
 * @param status - Email verification status
 * @returns result of the database operation
 */
export async function addUserToNotion(
  email: string,
  planName: string = 'Free',
  status: 'Pending' | 'Verified' = 'Pending'
) {
  try {
    if (!databaseId) {
      throw new Error('Notion database ID not configured');
    }

    const response = await notion.pages.create({
      parent: {
        database_id: databaseId,
      },
      properties: {
        Email: {
          title: [
            {
              text: {
                content: email,
              },
            },
          ],
        },
        Plan: {
          select: {
            name: planName,
          },
        },
        Status: {
          select: {
            name: status,
          },
        },
        Joined: {
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    });

    return response;
  } catch (error) {
    console.error('Error adding user to Notion:', error);
    // Don't throw the error to avoid breaking the sign-up flow
    // Just log it and return null
    return null;
  }
}

/**
 * Updates a user's verification status in Notion
 * @param email - User's email to update
 * @param status - New verification status
 */
export async function updateUserVerificationStatus(
  email: string,
  status: 'Pending' | 'Verified'
) {
  try {
    if (!databaseId) {
      throw new Error('Notion database ID not configured');
    }

    // First, query to find the page with the matching email
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Email',
        title: {
          equals: email,
        },
      },
    });

    if (response.results.length === 0) {
      console.warn(`User with email ${email} not found in Notion database`);
      return null;
    }

    // Update the user's status
    const pageId = response.results[0].id;
    const updateResponse = await notion.pages.update({
      page_id: pageId,
      properties: {
        Status: {
          select: {
            name: status,
          },
        },
      },
    });

    return updateResponse;
  } catch (error) {
    console.error('Error updating user verification status in Notion:', error);
    return null;
  }
} 
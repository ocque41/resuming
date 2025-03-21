import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { env } from '@/lib/env/server';

// Initialize the Notion client
const notionClient = new Client({
  auth: env.NOTION_API_KEY,
});

// Database IDs
const USER_DB_ID = env.NOTION_USER_DATABASE_ID;
const FEEDBACK_DB_ID = env.NOTION_FEEDBACK_DATABASE_ID;

/**
 * Adds a user to the Notion users database
 * @param email User's email address
 * @param isVerified Whether the email is verified
 * @returns The page ID if successful, null otherwise
 */
export async function addUserToNotion(
  email: string,
  isVerified: boolean = false,
): Promise<string | null> {
  if (!USER_DB_ID) {
    console.warn('Notion user database ID not configured');
    return null;
  }

  try {
    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      console.log(`User ${email} already exists in Notion`);
      return existingUser.id;
    }

    // Add the user to Notion
    const response = await notionClient.pages.create({
      parent: {
        database_id: USER_DB_ID,
      },
      properties: {
        Email: {
          type: 'email',
          email: email,
        },
        'Email Verified': {
          type: 'checkbox',
          checkbox: isVerified,
        },
        'Sign-up Date': {
          type: 'date',
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    });

    console.log(`Added user ${email} to Notion`);
    return response.id;
  } catch (error) {
    console.error('Error adding user to Notion:', error);
    return null;
  }
}

/**
 * Finds a user in the Notion database by email
 * @param email User's email address
 * @returns The user page object if found, null otherwise
 */
export async function findUserByEmail(email: string) {
  if (!USER_DB_ID) {
    console.warn('Notion user database ID not configured');
    return null;
  }

  try {
    const response = await notionClient.databases.query({
      database_id: USER_DB_ID,
      filter: {
        property: 'Email',
        email: {
          equals: email,
        },
      },
    });

    if (response.results.length > 0) {
      return response.results[0];
    }
    return null;
  } catch (error) {
    console.error('Error finding user in Notion:', error);
    return null;
  }
}

/**
 * Updates a user's email verification status in Notion
 * @param email User's email
 * @param isVerified Whether the email is verified
 * @returns true if successful, false otherwise
 */
export async function updateUserVerificationStatus(
  email: string,
  isVerified: boolean,
): Promise<boolean> {
  try {
    // Find the user by email to get their page ID
    const user = await findUserByEmail(email);
    if (!user) {
      console.log(`User with email ${email} not found in Notion`);
      return false;
    }

    // Update the verification status
    await notionClient.pages.update({
      page_id: user.id,
      properties: {
        'Email Verified': {
          type: 'checkbox',
          checkbox: isVerified,
        },
      },
    });

    console.log(`Updated verification status for ${email} to ${isVerified}`);
    return true;
  } catch (error) {
    console.error('Error updating user verification status:', error);
    return false;
  }
}

/**
 * Adds feedback to the Notion feedback database
 * @param email User's email
 * @param feedback Feedback text
 * @param type Type of feedback (e.g., "bug", "feature", "general")
 * @returns The page ID if successful, null otherwise
 */
export async function addFeedbackToNotion(
  email: string,
  feedback: string,
  type: string = 'general',
): Promise<string | null> {
  if (!FEEDBACK_DB_ID) {
    console.warn('Notion feedback database ID not configured');
    return null;
  }

  try {
    const response = await notionClient.pages.create({
      parent: {
        database_id: FEEDBACK_DB_ID,
      },
      properties: {
        Email: {
          type: 'email',
          email: email,
        },
        Feedback: {
          type: 'rich_text',
          rich_text: [
            {
              text: {
                content: feedback,
              },
            },
          ],
        },
        Type: {
          type: 'select',
          select: {
            name: type,
          },
        },
        Date: {
          type: 'date',
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    });

    console.log(`Added feedback from ${email} to Notion`);
    return response.id;
  } catch (error) {
    console.error('Error adding feedback to Notion:', error);
    return null;
  }
}

export { notionClient }; 
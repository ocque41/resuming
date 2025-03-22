import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { env } from '@/lib/env/server';

// Initialize the Notion client
let notionClient: Client | null = null;

try {
  notionClient = new Client({
    auth: env.NOTION_API_KEY,
  });
} catch (error) {
  console.error('Failed to initialize Notion client:', error);
}

// Database IDs
const USER_DB_ID = env.NOTION_USER_DATABASE_ID;
const FEEDBACK_DB_ID = env.NOTION_FEEDBACK_DATABASE_ID;

/**
 * Execute a Notion API call with timeout protection
 * @param apiCall Function that performs the Notion API call
 * @param timeoutMs Timeout in milliseconds
 * @returns Result of the API call or error
 */
async function withTimeout<T>(apiCall: () => Promise<T>, timeoutMs = 5000): Promise<{
  success: boolean;
  data?: T;
  error?: any;
}> {
  if (!notionClient) {
    console.warn('Notion client not initialized, skipping operation');
    return { success: false, error: 'Notion service not available' };
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.error('Notion API call timed out after', timeoutMs, 'ms');
      resolve({ success: false, error: 'Timeout calling Notion API' });
    }, timeoutMs);

    apiCall()
      .then((data) => {
        clearTimeout(timeoutId);
        resolve({ success: true, data });
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('Error calling Notion API:', error);
        resolve({ success: false, error });
      });
  });
}

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

    // Add the user to Notion with timeout protection
    const client = notionClient as Client;
    const result = await withTimeout(() => 
      client.pages.create({
        parent: {
          database_id: USER_DB_ID!,
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
      })
    );

    if (!result.success) {
      console.warn(`Failed to add user ${email} to Notion, but continuing`);
      return null;
    }

    console.log(`Added user ${email} to Notion`);
    return result.data?.id || null;
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
  if (!USER_DB_ID || !notionClient) {
    console.warn('Notion configuration not available');
    return null;
  }

  try {
    const client = notionClient as Client;
    const result = await withTimeout(() => 
      client.databases.query({
        database_id: USER_DB_ID!,
        filter: {
          property: 'Email',
          email: {
            equals: email,
          },
        },
      })
    );

    if (!result.success || !result.data) {
      return null;
    }

    if (result.data.results.length > 0) {
      return result.data.results[0];
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
  if (!notionClient) {
    console.warn('Notion client not initialized');
    return false;
  }

  try {
    // Find the user by email to get their page ID
    const user = await findUserByEmail(email);
    if (!user) {
      console.log(`User with email ${email} not found in Notion`);
      return false;
    }

    // Update the verification status with timeout protection
    const client = notionClient as Client;
    const result = await withTimeout(() => 
      client.pages.update({
        page_id: user.id,
        properties: {
          'Email Verified': {
            type: 'checkbox',
            checkbox: isVerified,
          },
        },
      })
    );

    if (!result.success) {
      console.warn(`Failed to update verification status for ${email}, but continuing`);
      return false;
    }

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
  if (!FEEDBACK_DB_ID || !notionClient) {
    console.warn('Notion feedback configuration not available');
    return null;
  }

  try {
    const client = notionClient as Client;
    const result = await withTimeout(() => 
      client.pages.create({
        parent: {
          database_id: FEEDBACK_DB_ID!,
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
      })
    );

    if (!result.success || !result.data) {
      console.warn(`Failed to add feedback from ${email} to Notion, but continuing`);
      return null;
    }

    console.log(`Added feedback from ${email} to Notion`);
    return result.data.id;
  } catch (error) {
    console.error('Error adding feedback to Notion:', error);
    return null;
  }
}

export { notionClient }; 
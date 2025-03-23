import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_SECRET,
});

const databaseId = process.env.NOTION_DB;

/**
 * Adds a new user email to the Notion database or updates an existing one
 * @param email - User's email
 * @param planName - User's plan name (Free or Moonlighting)
 * @param isSubscribed - Whether the user is subscribed to the newsletter
 * @param status - Email verification status
 * @returns result of the database operation
 */
export async function addOrUpdateNotionUser(
  email: string,
  planName: string = 'Free',
  isSubscribed: boolean = false,
  status: 'Pending' | 'Verified' = 'Pending'
) {
  try {
    if (!databaseId) {
      console.warn('Notion database ID not configured');
      return null;
    }

    if (!email) {
      console.warn('Email is required for Notion integration');
      return null;
    }

    // First check if the user already exists
    let response;
    try {
      response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Email',
          title: {
            equals: email,
          },
        },
      });
    } catch (error: any) {
      // Check if this is a property not found error
      if (error.message && error.message.includes('Email is expected to be')) {
        // Try with different property types (rich_text or title)
        try {
          response = await notion.databases.query({
            database_id: databaseId,
            filter: {
              property: 'Email',
              rich_text: {
                equals: email,
              },
            },
          });
        } catch (innerError) {
          console.error('Failed to query Notion with either title or rich_text filter:', innerError);
          return null;
        }
      } else {
        console.error('Error querying Notion database:', error);
        return null;
      }
    }

    // Get the database schema to check available properties
    let dbSchema;
    try {
      dbSchema = await notion.databases.retrieve({
        database_id: databaseId,
      });
    } catch (error) {
      console.error('Error retrieving Notion database schema:', error);
      // Continue with best effort
      dbSchema = { properties: {} };
    }

    const properties = dbSchema.properties || {};

    // Check which properties exist in the database
    const hasEmailProperty = !!properties.Email;
    const hasPlanProperty = !!properties.Plan;
    const hasStatusProperty = !!properties.Status;
    const hasSubscribedProperty = !!properties.Subscribed;
    const hasJoinedProperty = !!properties.Joined;

    // Determine the type of each property
    const emailPropertyType = hasEmailProperty ? properties.Email.type : 'title';
    const planPropertyType = hasPlanProperty ? properties.Plan.type : 'select';
    const statusPropertyType = hasStatusProperty ? properties.Status.type : 'select';
    const subscribedPropertyType = hasSubscribedProperty ? properties.Subscribed.type : 'checkbox';
    const joinedPropertyType = hasJoinedProperty ? properties.Joined.type : 'date';

    // User exists, update their record
    if (response && response.results && response.results.length > 0) {
      const pageId = response.results[0].id;
      
      // Build the properties object based on what's available
      const updateProps: any = {};

      // Only include properties that exist in the schema
      if (hasPlanProperty) {
        updateProps.Plan = {
          [planPropertyType]: planPropertyType === 'select' ? { name: planName } : planName,
        };
      }
      
      if (hasStatusProperty) {
        updateProps.Status = {
          [statusPropertyType]: statusPropertyType === 'select' ? { name: status } : status,
        };
      }
      
      if (hasSubscribedProperty) {
        updateProps.Subscribed = {
          [subscribedPropertyType]: subscribedPropertyType === 'checkbox' ? isSubscribed : (isSubscribed ? 'Yes' : 'No'),
        };
      }
      
      try {
        const updateResponse = await notion.pages.update({
          page_id: pageId,
          properties: updateProps,
        });

        return updateResponse;
      } catch (error) {
        console.error('Error updating Notion record:', error);
        // Return a partial success since the user record exists
        return { success: false, exists: true, error };
      }
    } 
    // User doesn't exist, create new record
    else {
      // Build the properties object based on what's available
      const createProps: any = {};
      
      // Email is required - adapt to the property type
      if (emailPropertyType === 'title') {
        createProps.Email = {
          title: [
            {
              text: {
                content: email,
              },
            },
          ],
        };
      } else if (emailPropertyType === 'rich_text') {
        createProps.Email = {
          rich_text: [
            {
              text: {
                content: email,
              },
            },
          ],
        };
      } else {
        // If we can't determine the type, default to title
        createProps.Email = {
          title: [
            {
              text: {
                content: email,
              },
            },
          ],
        };
      }
      
      // Only include properties that exist in the schema
      if (hasPlanProperty) {
        createProps.Plan = {
          [planPropertyType]: planPropertyType === 'select' ? { name: planName } : planName,
        };
      }
      
      if (hasStatusProperty) {
        createProps.Status = {
          [statusPropertyType]: statusPropertyType === 'select' ? { name: status } : status,
        };
      }
      
      if (hasSubscribedProperty) {
        createProps.Subscribed = {
          [subscribedPropertyType]: subscribedPropertyType === 'checkbox' ? isSubscribed : (isSubscribed ? 'Yes' : 'No'),
        };
      }
      
      if (hasJoinedProperty) {
        createProps.Joined = {
          [joinedPropertyType]: joinedPropertyType === 'date' ? { start: new Date().toISOString() } : new Date().toISOString(),
        };
      }
      
      try {
        const createResponse = await notion.pages.create({
          parent: {
            database_id: databaseId,
          },
          properties: createProps,
        });

        return createResponse;
      } catch (error) {
        console.error('Error creating Notion record:', error);
        return { success: false, error };
      }
    }
  } catch (error) {
    console.error('Error adding/updating user in Notion:', error);
    // Don't throw the error to avoid breaking the flow
    // Just log it and return null
    return null;
  }
}

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
  // Use the more comprehensive function
  return addOrUpdateNotionUser(email, planName, false, status);
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
      console.warn('Notion database ID not configured');
      return null;
    }

    if (!email) {
      console.warn('Email is required for Notion integration');
      return null;
    }

    // First, query to find the page with the matching email
    let response;
    try {
      response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Email',
          title: {
            equals: email,
          },
        },
      });
    } catch (error: any) {
      // Check if this is a property not found error
      if (error.message && error.message.includes('Email is expected to be')) {
        // Try with different property types (rich_text or title)
        try {
          response = await notion.databases.query({
            database_id: databaseId,
            filter: {
              property: 'Email',
              rich_text: {
                equals: email,
              },
            },
          });
        } catch (innerError) {
          console.error('Failed to query Notion with either title or rich_text filter:', innerError);
          return null;
        }
      } else {
        console.error('Error querying Notion database:', error);
        return null;
      }
    }

    if (!response || !response.results || response.results.length === 0) {
      console.warn(`User with email ${email} not found in Notion database`);
      return null;
    }

    // Get the database schema to check if the Status property exists
    let dbSchema;
    try {
      dbSchema = await notion.databases.retrieve({
        database_id: databaseId,
      });
    } catch (error) {
      console.error('Error retrieving Notion database schema:', error);
      // Continue with best effort
      dbSchema = { properties: {} };
    }

    const properties = dbSchema.properties || {};
    const hasStatusProperty = !!properties.Status;
    
    if (!hasStatusProperty) {
      console.warn('Status property not found in Notion database');
      return null;
    }

    const statusPropertyType = properties.Status.type || 'select';
    
    // Update the user's status
    const pageId = response.results[0].id;
    
    try {
      const updateResponse = await notion.pages.update({
        page_id: pageId,
        properties: {
          Status: statusPropertyType === 'select' 
            ? { select: { name: status } }
            : statusPropertyType === 'rich_text' 
              ? { rich_text: [{ text: { content: status } }] }
              : { select: { name: status } },
        },
      });

      return updateResponse;
    } catch (error) {
      console.error('Error updating Status in Notion:', error);
      return null;
    }
  } catch (error) {
    console.error('Error updating user verification status in Notion:', error);
    return null;
  }
} 
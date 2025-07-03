import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_SECRET,
});

const databaseId = process.env.NOTION_DB;

/**
 * Adds a new user email to the Notion database or updates an existing one
 * @param email - User's email
 * @param planName - User's plan name (e.g. Pro)
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
    console.log(`[NOTION] Adding/updating user: ${email}, Plan: ${planName}, Subscribed: ${isSubscribed}, Status: ${status}`);
    
    if (!process.env.NOTION_SECRET || !databaseId) {
      console.warn('[NOTION] Notion configuration missing. NOTION_SECRET or NOTION_DB not set');
      return null;
    }

    if (!email) {
      console.warn('[NOTION] Email is required for Notion integration');
      return null;
    }

    // First check if the user already exists
    let response;
    let existingUser = false;
    
    try {
      console.log(`[NOTION] Querying database for email: ${email}`);
      
      // Try with title filter first
      response = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Email',
          title: {
            equals: email,
          },
        },
      });
      
      // If we get results, user exists
      if (response && response.results && response.results.length > 0) {
        existingUser = true;
        console.log(`[NOTION] Found user with email as title property: ${email}`);
      } else {
        // If no results, try with rich_text filter
        response = await notion.databases.query({
          database_id: databaseId,
          filter: {
            property: 'Email',
            rich_text: {
              equals: email,
            },
          },
        });
        
        // If we get results with rich_text, user exists
        if (response && response.results && response.results.length > 0) {
          existingUser = true;
          console.log(`[NOTION] Found user with email as rich_text property: ${email}`);
        } else {
          console.log(`[NOTION] User not found, will create new: ${email}`);
        }
      }
    } catch (error) {
      console.error('[NOTION] Error querying Notion database:', error);
      // Continue with best effort - assume user doesn't exist
      response = { results: [] };
    }

    // Get the database schema to check available properties
    let dbSchema;
    try {
      console.log(`[NOTION] Retrieving database schema`);
      dbSchema = await notion.databases.retrieve({
        database_id: databaseId,
      });
      console.log(`[NOTION] Successfully retrieved schema. Available properties:`, 
        Object.keys(dbSchema.properties || {}).join(', '));
    } catch (error) {
      console.error('[NOTION] Error retrieving Notion database schema:', error);
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

    console.log(`[NOTION] Property availability - Email: ${hasEmailProperty}, Plan: ${hasPlanProperty}, Status: ${hasStatusProperty}, Subscribed: ${hasSubscribedProperty}, Joined: ${hasJoinedProperty}`);

    // Determine the type of each property if it exists
    const emailPropertyType = hasEmailProperty ? properties.Email.type : 'title';
    const planPropertyType = hasPlanProperty ? properties.Plan.type : 'select';
    const statusPropertyType = hasStatusProperty ? properties.Status.type : 'select';
    const subscribedPropertyType = hasSubscribedProperty ? properties.Subscribed.type : 'checkbox';
    const joinedPropertyType = hasJoinedProperty ? properties.Joined.type : 'date';

    console.log(`[NOTION] Property types - Email: ${emailPropertyType}, Plan: ${planPropertyType}, Status: ${statusPropertyType}, Subscribed: ${subscribedPropertyType}, Joined: ${joinedPropertyType}`);

    // User exists, update their record
    if (existingUser && response.results.length > 0) {
      const pageId = response.results[0].id;
      
      console.log(`[NOTION] Updating existing user with ID: ${pageId}`);
      
      // Build the properties object based on what's available
      const updateProps: any = {};

      // Only include properties that exist in the schema
      if (hasPlanProperty && planName) {
        updateProps.Plan = planPropertyType === 'select' 
          ? { select: { name: planName } }
          : { [planPropertyType]: planName };
      }
      
      if (hasStatusProperty) {
        updateProps.Status = statusPropertyType === 'select' 
          ? { select: { name: status } }
          : { [statusPropertyType]: status };
      }
      
      if (hasSubscribedProperty) {
        updateProps.Subscribed = subscribedPropertyType === 'checkbox' 
          ? { checkbox: isSubscribed }
          : { [subscribedPropertyType]: isSubscribed ? 'Yes' : 'No' };
      }
      
      console.log(`[NOTION] Update properties prepared:`, JSON.stringify(updateProps));

      try {
        // Update the page
        const updateResponse = await notion.pages.update({
          page_id: pageId,
          properties: updateProps,
        });
        
        console.log(`[NOTION] Successfully updated user: ${email}`);
        return updateResponse;
      } catch (updateError) {
        console.error(`[NOTION] Error updating user ${email}:`, updateError);
        
        // If update failed, try once more with more basic properties
        try {
          const simpleProps: any = {};
          
          if (hasPlanProperty && planName) {
            simpleProps.Plan = { select: { name: planName } };
          }
          
          if (hasSubscribedProperty) {
            simpleProps.Subscribed = { checkbox: isSubscribed };
          }
          
          if (Object.keys(simpleProps).length > 0) {
            console.log(`[NOTION] Retrying with simplified properties:`, JSON.stringify(simpleProps));
            const retryResponse = await notion.pages.update({
              page_id: pageId,
              properties: simpleProps,
            });
            
            console.log(`[NOTION] Successfully updated user with simplified properties: ${email}`);
            return retryResponse;
          }
        } catch (retryError) {
          console.error(`[NOTION] Retry update also failed for ${email}:`, retryError);
        }
        
        return null;
      }
    } 
    // User doesn't exist, create a new record
    else {
      console.log(`[NOTION] Creating new user: ${email}`);
      
      // Default the date to now
      const now = new Date().toISOString();
      
      // Build the properties object for creating a new user
      const createProps: any = {
        // Required: Email property
        Email: emailPropertyType === 'title' 
          ? { title: [{ text: { content: email } }] }
          : { [emailPropertyType]: email },
      };
      
      // Add optional properties if they exist in the schema
      if (hasPlanProperty && planName) {
        createProps.Plan = planPropertyType === 'select' 
          ? { select: { name: planName } }
          : { [planPropertyType]: planName };
      }
      
      if (hasStatusProperty) {
        createProps.Status = statusPropertyType === 'select' 
          ? { select: { name: status } }
          : { [statusPropertyType]: status };
      }
      
      if (hasSubscribedProperty) {
        createProps.Subscribed = subscribedPropertyType === 'checkbox' 
          ? { checkbox: isSubscribed }
          : { [subscribedPropertyType]: isSubscribed ? 'Yes' : 'No' };
      }
      
      if (hasJoinedProperty) {
        createProps.Joined = joinedPropertyType === 'date' 
          ? { date: { start: now } }
          : { [joinedPropertyType]: now };
      }
      
      console.log(`[NOTION] Create properties prepared:`, JSON.stringify(createProps));
      
      try {
        // Create the page
        const createResponse = await notion.pages.create({
          parent: { database_id: databaseId },
          properties: createProps,
        });
        
        console.log(`[NOTION] Successfully created user: ${email}`);
        return createResponse;
      } catch (createError) {
        console.error(`[NOTION] Error creating user ${email}:`, createError);
        
        // If creation failed, try once more with just the essential properties
        try {
          // Essential properties for creation
          const essentialProps: any = {
            Email: emailPropertyType === 'title' 
              ? { title: [{ text: { content: email } }] }
              : { rich_text: [{ text: { content: email } }] },
          };
          
          // Try to add Subscribed as it's one of our main concerns
          if (hasSubscribedProperty) {
            essentialProps.Subscribed = { checkbox: isSubscribed };
          }
          
          console.log(`[NOTION] Retrying with essential properties:`, JSON.stringify(essentialProps));
          const retryResponse = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: essentialProps,
          });
          
          console.log(`[NOTION] Successfully created user with essential properties: ${email}`);
          return retryResponse;
        } catch (retryError) {
          console.error(`[NOTION] Retry creation also failed for ${email}:`, retryError);
          return null;
        }
      }
    }
  } catch (error) {
    console.error(`[NOTION] Unexpected error for ${email}:`, error);
    return null;
  }
}

/**
 * Adds a new user email to the Notion database
 * @param email - User's email
 * @param planName - User's plan name (e.g. Pro)
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
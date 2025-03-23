import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_SECRET,
});

const databaseId = process.env.NOTION_DB;

/**
 * Checks if the Notion database has the required properties
 * @param dbId - The database ID to check
 * @returns An object containing the validity of each required property
 */
async function checkNotionDatabaseSchema(dbId: string) {
  try {
    const dbResponse = await notion.databases.retrieve({
      database_id: dbId,
    });
    
    const properties = dbResponse.properties;
    
    // Check for required properties and their types
    return {
      hasEmailProperty: properties['Email'] && properties['Email'].type === 'title',
      hasPlanProperty: properties['Plan'] && properties['Plan'].type === 'select',
      hasStatusProperty: properties['Status'] && properties['Status'].type === 'select',
      hasSubscribedProperty: properties['Subscribed'] && properties['Subscribed'].type === 'checkbox',
      hasJoinedProperty: properties['Joined'] && properties['Joined'].type === 'date',
    };
  } catch (error) {
    console.error('Error checking Notion database schema:', error);
    return {
      hasEmailProperty: false,
      hasPlanProperty: false,
      hasStatusProperty: false, 
      hasSubscribedProperty: false,
      hasJoinedProperty: false,
    };
  }
}

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
    if (!process.env.NOTION_SECRET) {
      console.warn('Notion secret key is not configured');
      return null;
    }

    if (!databaseId) {
      console.warn('Notion database ID not configured');
      return null;
    }

    // Check if the database has the required properties
    const schemaCheck = await checkNotionDatabaseSchema(databaseId);
    
    if (!schemaCheck.hasEmailProperty) {
      console.error('Notion database does not have a valid Email property');
      return null;
    }

    // First check if the user already exists
    let query;
    
    try {
      query = {
        database_id: databaseId,
        filter: {
          property: 'Email',
          title: {
            equals: email,
          },
        },
      };
      
      const response = await notion.databases.query(query);
      
      // User exists, update their record
      if (response.results.length > 0) {
        const pageId = response.results[0].id;
        
        // Build properties object based on available schema
        const properties: any = {};
        
        if (schemaCheck.hasPlanProperty) {
          properties.Plan = {
            select: {
              name: planName,
            },
          };
        }
        
        if (schemaCheck.hasStatusProperty) {
          properties.Status = {
            select: {
              name: status,
            },
          };
        }
        
        if (schemaCheck.hasSubscribedProperty) {
          properties.Subscribed = {
            checkbox: isSubscribed,
          };
        }
        
        // Only update if we have properties to update
        if (Object.keys(properties).length > 0) {
          const updateResponse = await notion.pages.update({
            page_id: pageId,
            properties,
          });
          
          return updateResponse;
        }
        
        return response.results[0];
      } 
      // User doesn't exist, create new record
      else {
        // Build properties object based on available schema
        const properties: any = {};
        
        // Email is required for creating a page
        if (schemaCheck.hasEmailProperty) {
          properties.Email = {
            title: [
              {
                text: {
                  content: email,
                },
              },
            ],
          };
        } else {
          throw new Error('Cannot create user without Email property');
        }
        
        if (schemaCheck.hasPlanProperty) {
          properties.Plan = {
            select: {
              name: planName,
            },
          };
        }
        
        if (schemaCheck.hasStatusProperty) {
          properties.Status = {
            select: {
              name: status,
            },
          };
        }
        
        if (schemaCheck.hasSubscribedProperty) {
          properties.Subscribed = {
            checkbox: isSubscribed,
          };
        }
        
        if (schemaCheck.hasJoinedProperty) {
          properties.Joined = {
            date: {
              start: new Date().toISOString(),
            },
          };
        }
        
        const createResponse = await notion.pages.create({
          parent: {
            database_id: databaseId,
          },
          properties,
        });
        
        return createResponse;
      }
    } catch (queryError) {
      console.error('Error querying Notion database:', queryError);
      // Try a simpler approach as fallback
      try {
        // Fallback: Just create a simple page with email
        const createResponse = await notion.pages.create({
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
          },
        });
        
        return createResponse;
      } catch (fallbackError) {
        console.error('Error with fallback Notion creation:', fallbackError);
        return null;
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
    if (!process.env.NOTION_SECRET) {
      console.warn('Notion secret key is not configured');
      return null;
    }
    
    if (!databaseId) {
      console.warn('Notion database ID not configured');
      return null;
    }

    // Check if the database has the required properties
    const schemaCheck = await checkNotionDatabaseSchema(databaseId);
    
    if (!schemaCheck.hasEmailProperty) {
      console.error('Notion database does not have a valid Email property');
      return null;
    }
    
    if (!schemaCheck.hasStatusProperty) {
      console.error('Notion database does not have a valid Status property');
      return null;
    }

    // First, query to find the page with the matching email
    try {
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
      console.error('Error querying or updating Notion database:', error);
      return null;
    }
  } catch (error) {
    console.error('Error updating user verification status in Notion:', error);
    return null;
  }
} 
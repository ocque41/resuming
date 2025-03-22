/**
 * Database initialization module for application startup.
 * This module ensures the database schema is compatible with the application.
 */

/**
 * Run startup checks during application initialization
 */
export async function initializeDatabase() {
  if (typeof window !== 'undefined') {
    // This function should only run on the server
    return;
  }
  
  try {
    console.log('Initializing database...');
    
    // Call the startup API to run schema validation
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/startup`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Database initialization completed successfully');
    } else {
      console.error('❌ Database initialization failed:', result);
    }
    
    return result;
  } catch (error) {
    console.error('Error initializing database:', error);
    // Don't throw - allow the application to continue even if initialization fails
    return { success: false, error: 'Failed to initialize database' };
  }
}

// Attempt initialization when this module is imported
initializeDatabase().catch(console.error); 
// Script to add admin column to users table
require('dotenv').config();
const postgres = require('postgres');

async function applyMigration() {
  console.log('Applying admin column migration...');

  // Create a postgres client
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL environment variable is not set');
    process.exit(1);
  }

  const client = postgres(process.env.POSTGRES_URL);

  try {
    // Add admin column to users table if it doesn't exist
    await client`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT FALSE;
    `;
    console.log('Added admin column to users table');

    // Add index for faster queries
    await client`
      CREATE INDEX IF NOT EXISTS users_admin_idx ON users(admin);
    `;
    console.log('Added index on admin column');

    // Set admin status for specific user
    await client`
      UPDATE users SET admin = TRUE WHERE email = 'ocquema@hotmail.com';
    `;
    console.log('Set admin status for user: ocquema@hotmail.com');

    console.log('Admin column migration applied successfully!');
  } catch (error) {
    console.error('Error applying admin column migration:', error);
    process.exit(1);
  } finally {
    // Close the client
    await client.end();
  }
}

// Run the migration
applyMigration()
  .then(() => {
    console.log('Admin column migration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Admin column migration script failed:', error);
    process.exit(1);
  }); 
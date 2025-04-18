# Database Migration: Add Metadata Column to job_status Table

This migration adds a missing `metadata` column to the `job_status` table, which is needed for the CV tailoring job process.

## The Problem

The error occurs because the `job_status` table schema in the database is missing the `metadata` column, although it is defined in the Drizzle schema file.

Error: `Error: column "metadata" of relation "job_status" does not exist`

## Solution

We've provided several ways to run this migration:

### Option 1: Using Node.js (Recommended for Development)

```bash
# Make sure you have PostgreSQL client library installed
npm install pg dotenv

# Set up environment variables (DATABASE_URL)
# Run the migration script
node lib/db/apply-migration.js
```

### Option 2: Using Shell Script (For Unix/Linux/Mac systems)

```bash
# Make sure PostgreSQL client tools are installed
# Set DATABASE_URL environment variable
export DATABASE_URL=your_postgres_connection_string

# Make the script executable
chmod +x lib/db/apply-migration.sh

# Run the migration
./lib/db/apply-migration.sh
```

### Option 3: Direct SQL

You can run this SQL command directly on your database:

```sql
ALTER TABLE job_status ADD COLUMN IF NOT EXISTS metadata JSONB;
```

### Option 4: Using Vercel CLI (For Production)

```bash
# Install dependencies
npm install pg dotenv

# Pull environment variables
npx vercel env pull .env.local

# Run the migration script
node lib/db/migrations/vercel-add-metadata.js
```

## Verification

After running the migration, you can verify the column was added by running:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'job_status' AND column_name = 'metadata';
```

If the query returns a result, the migration was successful.

## Note

This is a one-time fix. Once the migration is applied, the system should work correctly. 
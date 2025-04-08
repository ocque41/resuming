#!/bin/bash

# Apply the migration to add the metadata column to job_status table
echo "Applying migration to add metadata column to job_status table..."

# Get the database URL from environment variable
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

# Apply the migration using psql
psql "$DATABASE_URL" -c "ALTER TABLE job_status ADD COLUMN IF NOT EXISTS metadata JSONB;"

# Check if the command was successful
if [ $? -eq 0 ]; then
  echo "✅ Migration applied successfully!"
else
  echo "❌ Failed to apply migration"
  exit 1
fi

# Verify the column was added
result=$(psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'job_status' AND column_name = 'metadata'")

if [ -n "$result" ]; then
  echo "✅ Metadata column successfully added to job_status table"
else
  echo "❌ Failed to add metadata column"
  exit 1
fi

echo "Migration complete!"
exit 0 
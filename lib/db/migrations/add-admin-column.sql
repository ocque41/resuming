-- Add admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT FALSE;

-- Create index on admin column for faster admin queries
CREATE INDEX IF NOT EXISTS users_admin_idx ON users(admin); 
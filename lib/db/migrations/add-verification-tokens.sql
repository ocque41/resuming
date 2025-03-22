-- Add emailVerified column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP;

-- Create verification_tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

-- Add index on email and token for faster lookups
CREATE INDEX IF NOT EXISTS verification_tokens_email_idx ON verification_tokens(email);
CREATE INDEX IF NOT EXISTS verification_tokens_token_idx ON verification_tokens(token); 
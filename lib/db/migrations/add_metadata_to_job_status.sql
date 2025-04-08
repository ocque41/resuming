-- Add metadata column to job_status table
ALTER TABLE job_status ADD COLUMN IF NOT EXISTS metadata JSONB; 
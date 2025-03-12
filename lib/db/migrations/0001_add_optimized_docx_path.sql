-- Migration: Add optimized_docx_path column to cvs table
ALTER TABLE "cvs" ADD COLUMN IF NOT EXISTS "optimized_docx_path" TEXT; 
/**
 * Environment variables utility
 * 
 * This module provides type-safe access to environment variables.
 */

export const env = {
  // Base URL of the application
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  
  // Authentication
  AUTH_SECRET: process.env.AUTH_SECRET || 'your-development-secret',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // Email settings
  EMAIL_FROM: process.env.EMAIL_FROM || 'CV Optimizer <noreply@example.com>',
  
  // SMTP configuration
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_SECURE: process.env.SMTP_SECURE || 'false',
  
  // Resend API (https://resend.com)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  
  // Notion integrations settings
  NOTION_API_KEY: process.env.NOTION_API_KEY || '',
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID || '',
  
  // reCAPTCHA settings
  RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '',
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',
  
  // Determine if running in production
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV === 'development',
}; 
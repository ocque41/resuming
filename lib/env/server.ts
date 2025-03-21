import { z } from 'zod';

// Define a schema for environment variables
const serverEnvSchema = z.object({
  // Database
  POSTGRES_URL: z.string().min(1),
  
  // Authentication
  AUTH_SECRET: z.string().min(1),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  
  // Email
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional().default('onboarding@resuming.ai'),
  
  // Notion
  NOTION_API_KEY: z.string().min(1).optional(),
  NOTION_USER_DATABASE_ID: z.string().min(1).optional(),
  NOTION_FEEDBACK_DATABASE_ID: z.string().min(1).optional(),
  
  // App Configuration
  BASE_URL: z.string().url().optional().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Captcha
  HCAPTCHA_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: z.string().min(1).optional(),
});

// Process the environment variables
function processEnv(env: NodeJS.ProcessEnv) {
  // Parse environment variables with defaults for optional values
  return serverEnvSchema.parse({
    // Database
    POSTGRES_URL: env.POSTGRES_URL,
    
    // Authentication
    AUTH_SECRET: env.AUTH_SECRET,
    
    // Stripe
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    
    // Email
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    
    // Notion
    NOTION_API_KEY: env.NOTION_SECRET, // Map from NOTION_SECRET to NOTION_API_KEY
    NOTION_USER_DATABASE_ID: env.NOTION_DB, // Map from NOTION_DB
    NOTION_FEEDBACK_DATABASE_ID: env.NOTION_FEEDBACK_DB,
    
    // App Configuration
    BASE_URL: env.BASE_URL,
    NODE_ENV: env.NODE_ENV,
    
    // Captcha
    HCAPTCHA_SECRET_KEY: env.HCAPTCHA_SECRET_KEY,
    NEXT_PUBLIC_HCAPTCHA_SITE_KEY: env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
  });
}

// Export validated environment variables
export const env = processEnv(process.env);

// Export the schema type
export type ServerEnv = z.infer<typeof serverEnvSchema>; 
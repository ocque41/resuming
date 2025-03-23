import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Redis client if available
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Key prefix for email tracking
const EMAIL_KEY_PREFIX = 'email:status:';
const EMAIL_FAILURES_KEY = 'email:failures:count';
const EMAIL_SUCCESS_KEY = 'email:success:count';

/**
 * Track an email sending attempt
 * @param emailId - The ID of the sent email
 * @param email - The recipient's email address
 * @param type - The type of email sent
 * @param success - Whether the attempt was successful
 */
export async function trackEmailSent(
  emailId: string | undefined,
  email: string,
  type: 'verification' | 'confirmation' | 'reset' | 'invite' | 'other',
  success: boolean
) {
  try {
    if (!redis) return;
    
    const now = new Date().toISOString();
    
    // Increment the appropriate counter
    await redis.incr(success ? EMAIL_SUCCESS_KEY : EMAIL_FAILURES_KEY);
    
    // If we have an email ID, store more details
    if (emailId) {
      const key = `${EMAIL_KEY_PREFIX}${emailId}`;
      await redis.set(key, JSON.stringify({
        id: emailId,
        recipient: email,
        type,
        status: success ? 'sent' : 'failed',
        timestamp: now,
      }));
      
      // Set expiration for 30 days
      await redis.expire(key, 60 * 60 * 24 * 30);
    }
  } catch (error) {
    console.error('[EMAIL-MONITOR] Error tracking email:', error);
    // Fail silently - monitoring should not break core functionality
  }
}

/**
 * Check if an email was delivered
 * @param emailId - The ID of the email to check
 * @returns The delivery status of the email
 */
export async function checkEmailDelivery(emailId: string) {
  try {
    const { data, error } = await resend.emails.get(emailId);
    
    if (error) {
      console.error('[EMAIL-MONITOR] Error checking email delivery:', error);
      return { delivered: false, error };
    }
    
    // Update Redis with the latest status if available
    if (redis && data) {
      const key = `${EMAIL_KEY_PREFIX}${emailId}`;
      const existingData = await redis.get<string>(key) as string | null;
      const parsedExisting = existingData ? JSON.parse(existingData) : {};
      
      await redis.set(key, JSON.stringify({
        ...parsedExisting,
        lastChecked: new Date().toISOString(),
        deliveryStatus: data.last_event || 'unknown',
        delivered: data.last_event === 'delivered',
      }));
    }
    
    return { 
      delivered: data?.last_event === 'delivered', 
      status: data?.last_event || 'unknown',
      data 
    };
  } catch (error) {
    console.error('[EMAIL-MONITOR] Exception checking email delivery:', error);
    return { delivered: false, error };
  }
}

/**
 * Get statistics about sent emails
 * @returns Statistics about email sending success and failure
 */
export async function getEmailStatistics() {
  try {
    if (!redis) {
      return { success: 0, failures: 0, total: 0, success_rate: 0 };
    }
    
    const [successCountStr, failureCountStr] = await Promise.all([
      redis.get<string>(EMAIL_SUCCESS_KEY) as Promise<string | null>,
      redis.get<string>(EMAIL_FAILURES_KEY) as Promise<string | null>,
    ]);
    
    const success = parseInt(successCountStr || '0', 10);
    const failures = parseInt(failureCountStr || '0', 10);
    const total = success + failures;
    const success_rate = total > 0 ? (success / total) * 100 : 0;
    
    return { success, failures, total, success_rate };
  } catch (error) {
    console.error('[EMAIL-MONITOR] Error getting email statistics:', error);
    return { success: 0, failures: 0, total: 0, success_rate: 0 };
  }
} 
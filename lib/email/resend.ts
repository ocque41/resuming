import { Resend } from 'resend';
import { trackEmailSent } from './monitor';
import { createVerificationEmail } from './templates/verification-email';
import { createConfirmationEmail } from './templates/confirmation-email';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Maximum number of retry attempts for email sending
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // 1 second delay between retries

// Sender email configuration
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'hi@resuming.ai';
const FROM_EMAIL_WITH_NAME = `Resuming.ai <${DEFAULT_FROM_EMAIL}>`;

/**
 * Send an email with retry mechanism
 * @param options - Email options
 * @returns The result of the email sending operation
 */
async function sendEmailWithRetry(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  type?: 'verification' | 'confirmation' | 'reset' | 'invite' | 'other';
}) {
  let lastError = null;
  const emailType = options.type || 'other';
  const { type, ...emailOptions } = options; // Extract type from options
  
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`[EMAIL] Attempt ${attempt} of ${MAX_RETRY_ATTEMPTS} to send email to ${options.to}`);
      
      const { data, error } = await resend.emails.send(emailOptions);
      
      if (error) {
        console.error(`[EMAIL] Error on attempt ${attempt}:`, error);
        lastError = error;
        
        // If this wasn't the last attempt, wait before retrying
        if (attempt < MAX_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
          continue;
        }
        
        // Track failure on last attempt
        if (attempt === MAX_RETRY_ATTEMPTS) {
          await trackEmailSent(undefined, options.to, emailType, false);
        }
      } else {
        // Success, track and return data
        console.log(`[EMAIL] Successfully sent email on attempt ${attempt}`, { id: data?.id });
        await trackEmailSent(data?.id, options.to, emailType, true);
        return { success: true, data };
      }
    } catch (error) {
      console.error(`[EMAIL] Exception on attempt ${attempt}:`, error);
      lastError = error;
      
      // If this wasn't the last attempt, wait before retrying
      if (attempt < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        continue;
      }
      
      // Track failure on last attempt
      if (attempt === MAX_RETRY_ATTEMPTS) {
        await trackEmailSent(undefined, options.to, emailType, false);
      }
    }
  }
  
  return { success: false, error: lastError };
}

/**
 * Send a verification email to a user
 * @param email - Recipient email
 * @param verificationToken - Token for email verification
 * @returns result of the email sending operation
 */
export async function sendVerificationEmail(email: string, verificationToken: string) {
  try {
    console.log(`[EMAIL] Preparing verification email to ${email}`);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Generate the verification email content using our template
    const htmlContent = createVerificationEmail(email, verificationToken, baseUrl);
    
    console.log(`[EMAIL] Using sender: ${FROM_EMAIL_WITH_NAME}`);

    return await sendEmailWithRetry({
      from: FROM_EMAIL_WITH_NAME,
      to: email,
      subject: 'Verify your email address - Resuming.ai',
      type: 'verification',
      html: htmlContent,
    });
  } catch (error) {
    console.error('[EMAIL] Exception sending verification email:', error);
    await trackEmailSent(undefined, email, 'verification', false);
    return { success: false, error };
  }
}

/**
 * Send a welcome/confirmation email to a new user
 * @param email - Recipient email
 * @returns result of the email sending operation
 */
export async function sendConfirmationEmail(email: string) {
  try {
    console.log(`[EMAIL] Preparing confirmation email to ${email}`);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Generate the confirmation email content using our template
    const htmlContent = createConfirmationEmail(email, baseUrl);
    
    console.log(`[EMAIL] Using sender: ${FROM_EMAIL_WITH_NAME}`);

    return await sendEmailWithRetry({
      from: FROM_EMAIL_WITH_NAME,
      to: email,
      subject: 'Welcome to Resuming.ai!',
      type: 'confirmation',
      html: htmlContent,
    });
  } catch (error) {
    console.error('[EMAIL] Exception sending confirmation email:', error);
    await trackEmailSent(undefined, email, 'confirmation', false);
    return { success: false, error };
  }
}

/**
 * Check the status of a sent email
 * @param emailId - The ID of the email to check
 * @returns Information about the email status
 */
export async function checkEmailStatus(emailId: string) {
  try {
    const { data, error } = await resend.emails.get(emailId);
    
    if (error) {
      console.error('[EMAIL] Error checking email status:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('[EMAIL] Exception checking email status:', error);
    return { success: false, error };
  }
} 
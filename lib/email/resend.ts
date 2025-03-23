import { Resend } from 'resend';
import { trackEmailSent } from './monitor';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Maximum number of retry attempts for email sending
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // 1 second delay between retries

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
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    // Using a verified sender format with name + verified email address
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const formattedFrom = `Resuming.ai <${fromEmail}>`;
    
    console.log(`[EMAIL] Using sender: ${formattedFrom}`);

    return await sendEmailWithRetry({
      from: formattedFrom,
      to: email,
      subject: 'Verify your email address - Resuming.ai',
      type: 'verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #F9F6EE;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${baseUrl}/white.png" alt="Resuming.ai Logo" style="width: 150px;">
          </div>
          
          <div style="background-color: #111111; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #222222;">
            <h1 style="color: #F9F6EE; font-size: 24px; margin-bottom: 20px; font-weight: bold;">Verify your email address</h1>
            
            <p style="color: #C5C2BA; line-height: 1.6; margin-bottom: 25px;">
              Thank you for creating an account with Resuming.ai. To complete your registration and access all features, please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="display: inline-block; background-color: #B4916C; color: #050505; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; text-align: center;">
                Verify My Email
              </a>
            </div>
            
            <p style="color: #C5C2BA; line-height: 1.6; margin-bottom: 10px;">
              If you didn't create an account with us, you can safely ignore this email.
            </p>
            
            <p style="color: #C5C2BA; line-height: 1.6; font-size: 12px; margin-top: 30px;">
              If the button doesn't work, copy and paste this URL into your browser:
              <br>
              <a href="${verificationUrl}" style="color: #B4916C; word-break: break-all;">${verificationUrl}</a>
            </p>
          </div>
          
          <div style="text-align: center; color: #8A8782; font-size: 12px; margin-top: 20px;">
            <p>© ${new Date().getFullYear()} Resuming.ai. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      `,
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
    const dashboardUrl = `${baseUrl}/dashboard`;
    const pricingUrl = `${baseUrl}/dashboard/pricing`;

    // Using a verified sender format with name + verified email address
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const formattedFrom = `Resuming.ai <${fromEmail}>`;
    
    console.log(`[EMAIL] Using sender: ${formattedFrom}`);

    return await sendEmailWithRetry({
      from: formattedFrom,
      to: email,
      subject: 'Welcome to Resuming.ai!',
      type: 'confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #F9F6EE;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${baseUrl}/white.png" alt="Resuming.ai Logo" style="width: 150px;">
          </div>
          
          <div style="background-color: #111111; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #222222;">
            <h1 style="color: #F9F6EE; font-size: 24px; margin-bottom: 20px; font-weight: bold;">Welcome to Resuming.ai!</h1>
            
            <p style="color: #C5C2BA; line-height: 1.6; margin-bottom: 25px;">
              Thank you for joining Resuming.ai. We're excited to help you optimize your resume and land your dream job!
            </p>
            
            <p style="color: #C5C2BA; line-height: 1.6; margin-bottom: 25px;">
              Your account has been successfully created. Please note that you'll need to verify your email to access all features of your account.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; background-color: #B4916C; color: #050505; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; text-align: center; margin-right: 10px;">
                Go to Dashboard
              </a>
              <a href="${pricingUrl}" style="display: inline-block; background-color: #222222; color: #F9F6EE; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; text-align: center;">
                View Plans
              </a>
            </div>
            
            <p style="color: #C5C2BA; line-height: 1.6; margin-bottom: 10px;">
              If you have any questions or need assistance, please don't hesitate to contact our support team.
            </p>
          </div>
          
          <div style="text-align: center; color: #8A8782; font-size: 12px; margin-top: 20px;">
            <p>© ${new Date().getFullYear()} Resuming.ai. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      `,
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
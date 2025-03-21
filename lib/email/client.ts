import { Resend } from 'resend';
import { env } from '@/lib/env/server';

// Initialize the Resend client with the API key from environment
const resend = new Resend(env.RESEND_API_KEY);

// The email address to send emails from
const fromEmail = env.EMAIL_FROM;

/**
 * Send a confirmation email to a new user
 */
export async function sendConfirmationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name?: string;
  token: string;
}) {
  try {
    // Base URL for the confirmation link
    const baseUrl = env.BASE_URL;
    const confirmationLink = `${baseUrl}/verify-email?token=${token}`;
    
    const userName = name || email.split('@')[0] || 'there';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Verify your email for Resuming',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #F9F6EE; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${baseUrl}/white.png" alt="Resuming Logo" width="120" />
          </div>
          
          <h1 style="color: #F9F6EE; font-size: 24px; margin-bottom: 20px;">Confirm your email address</h1>
          
          <p style="margin-bottom: 20px; line-height: 1.5; color: #C5C2BA;">
            Hi ${userName},
          </p>
          
          <p style="margin-bottom: 20px; line-height: 1.5; color: #C5C2BA;">
            Thanks for signing up for Resuming! To complete your registration and access all features, please verify your email address.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmationLink}" style="display: inline-block; background-color: #B4916C; color: #050505; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center;">
              Verify Email Address
            </a>
          </div>
          
          <p style="margin-bottom: 20px; line-height: 1.5; color: #C5C2BA;">
            If you didn't sign up for Resuming, please ignore this email or contact our support team if you have any concerns.
          </p>
          
          <div style="border-top: 1px solid #333333; margin-top: 30px; padding-top: 20px; font-size: 14px; color: #8A8782;">
            <p>&copy; ${new Date().getFullYear()} Resuming. All rights reserved.</p>
            <p>This link will expire in 24 hours.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending confirmation email:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
}

/**
 * Send a welcome email to a user after they verify their email
 */
export async function sendWelcomeEmail({
  email,
  name,
}: {
  email: string;
  name?: string;
}) {
  try {
    const baseUrl = env.BASE_URL;
    const userName = name || email.split('@')[0] || 'there';
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Welcome to Resuming!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #F9F6EE; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${baseUrl}/white.png" alt="Resuming Logo" width="120" />
          </div>
          
          <h1 style="color: #F9F6EE; font-size: 24px; margin-bottom: 20px;">Welcome to Resuming!</h1>
          
          <p style="margin-bottom: 20px; line-height: 1.5; color: #C5C2BA;">
            Hi ${userName},
          </p>
          
          <p style="margin-bottom: 20px; line-height: 1.5; color: #C5C2BA;">
            Thank you for verifying your email! Your account is now fully activated and you can start using all the features of Resuming.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/dashboard" style="display: inline-block; background-color: #B4916C; color: #050505; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center;">
              Go to Dashboard
            </a>
          </div>
          
          <p style="margin-bottom: 20px; line-height: 1.5; color: #C5C2BA;">
            If you have any questions or need assistance, please don't hesitate to contact our support team.
          </p>
          
          <div style="border-top: 1px solid #333333; margin-top: 30px; padding-top: 20px; font-size: 14px; color: #8A8782;">
            <p>&copy; ${new Date().getFullYear()} Resuming. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}

export { resend }; 
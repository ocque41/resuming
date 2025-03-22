import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a verification email to a user
 * @param email - Recipient email
 * @param verificationToken - Token for email verification
 * @returns result of the email sending operation
 */
export async function sendVerificationEmail(email: string, verificationToken: string) {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    const { data, error } = await resend.emails.send({
      from: 'noreply@resuming.ai',
      to: email,
      subject: 'Verify your email address - Resuming.ai',
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

    if (error) {
      console.error('Error sending verification email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Exception sending verification email:', error);
    return { success: false, error };
  }
} 
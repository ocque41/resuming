import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a verification email to a new user
 */
export async function sendVerificationEmail(email: string, verificationToken: string) {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    
    const response = await resend.emails.send({
      from: 'Resuming <noreply@resuming.ai>',
      to: email,
      subject: 'Verify your Resuming account',
      html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Resuming Account</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f9f9f9;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #050505;
              color: #F9F6EE;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 1px solid #333333;
            }
            .content {
              padding: 30px 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #B4916C;
              color: #050505;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              font-size: 12px;
              color: #8A8782;
              padding: 20px;
              border-top: 1px solid #333333;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Resuming!</h1>
            </div>
            <div class="content">
              <p>Thank you for creating an account with Resuming. To activate your account and get started, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>If you didn't create this account, you can safely ignore this email.</p>
              
              <p>This verification link will expire in 24 hours.</p>
              
              <p>If you're having trouble clicking the button, copy and paste the following URL into your web browser:</p>
              <p style="word-break: break-all; font-size: 12px;">${verificationUrl}</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Resuming. All rights reserved.</p>
              <p>Our address: Resuming AI, Inc.</p>
            </div>
          </div>
        </body>
      </html>
      `,
    });
    
    return response;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return null;
  }
}

/**
 * Send a welcome email to a newly verified user
 */
export async function sendWelcomeEmail(email: string) {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    const response = await resend.emails.send({
      from: 'Resuming <noreply@resuming.ai>',
      to: email,
      subject: 'Welcome to Resuming!',
      html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Resuming</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f9f9f9;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #050505;
              color: #F9F6EE;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 1px solid #333333;
            }
            .content {
              padding: 30px 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #B4916C;
              color: #050505;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              font-size: 12px;
              color: #8A8782;
              padding: 20px;
              border-top: 1px solid #333333;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Resuming!</h1>
            </div>
            <div class="content">
              <p>Your email has been verified and your account is now active. Thank you for joining Resuming!</p>
              
              <p>With your account, you can now:</p>
              <ul>
                <li>Upload and optimize your CV</li>
                <li>Analyze your documents for insights</li>
                <li>Generate job descriptions</li>
                <li>Match your CV against job descriptions</li>
                <li>And much more!</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="${baseUrl}/dashboard" class="button">Go to Your Dashboard</a>
              </div>
              
              <p>If you have any questions or need assistance, don't hesitate to contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Resuming. All rights reserved.</p>
              <p>Our address: Resuming AI, Inc.</p>
            </div>
          </div>
        </body>
      </html>
      `,
    });
    
    return response;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return null;
  }
}

export default resend; 
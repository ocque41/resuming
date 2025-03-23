import { createEmailLayout } from './email-layout';

/**
 * Generate verification email HTML content
 * 
 * @param email User's email address
 * @param verificationToken Verification token
 * @param baseUrl Base URL of the application
 * @returns HTML content for verification email
 */
export function createVerificationEmail(
  email: string, 
  verificationToken: string,
  baseUrl: string = process.env.BASE_URL || 'http://localhost:3000'
): string {
  // Create verification URL
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
  
  // Create body content with verification instructions
  const bodyContent = `
    <p>
      Thank you for creating an account with Resuming.ai. To complete your registration and access all features, please verify your email address by clicking the button below.
    </p>
    
    <p style="margin-top: 20px;">
      If you didn't create an account with us, you can safely ignore this email.
    </p>
    
    <p style="color: #C5C2BA; line-height: 1.6; font-size: 12px; margin-top: 30px;">
      If the button doesn't work, copy and paste this URL into your browser:
      <br>
      <a href="${verificationUrl}" style="color: #B4916C; word-break: break-all;">${verificationUrl}</a>
    </p>
  `;
  
  // Use the email layout component to generate the full HTML
  return createEmailLayout({
    previewText: 'Verify your email address to complete your Resuming.ai registration',
    heading: 'Verify your email address',
    bodyContent,
    ctaText: 'Verify My Email',
    ctaUrl: verificationUrl,
    baseUrl
  });
} 
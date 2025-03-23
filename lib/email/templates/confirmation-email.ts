import { createEmailLayout } from './email-layout';

/**
 * Generate welcome/confirmation email HTML content
 * 
 * @param email User's email address
 * @param baseUrl Base URL of the application
 * @returns HTML content for welcome email
 */
export function createConfirmationEmail(
  email: string,
  baseUrl: string = process.env.BASE_URL || 'http://localhost:3000'
): string {
  // URLs for the CTA buttons
  const dashboardUrl = `${baseUrl}/dashboard`;
  const pricingUrl = `${baseUrl}/dashboard/pricing`;
  
  // Create body content with welcome message
  const bodyContent = `
    <p>
      Thank you for joining Resuming.ai. We're excited to help you optimize your resume and land your dream job!
    </p>
    
    <p style="margin-top: 20px;">
      Your account has been successfully created. Please note that you'll need to verify your email to access all features of your account.
    </p>
  `;
  
  // Use the email layout component to generate the full HTML
  return createEmailLayout({
    previewText: 'Welcome to Resuming.ai! Get started with your account',
    heading: 'Welcome to Resuming.ai!',
    bodyContent,
    ctaText: 'Go to Dashboard',
    ctaUrl: dashboardUrl,
    secondaryCtaText: 'View Plans',
    secondaryCtaUrl: pricingUrl,
    baseUrl
  });
} 
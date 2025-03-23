/**
 * Email Layout Component
 * 
 * A reusable layout for all transactional emails that follows our brand guidelines.
 * This component provides a consistent structure with customizable content.
 */

export interface EmailLayoutProps {
  previewText?: string;
  heading: string;
  bodyContent: string;
  ctaText?: string;
  ctaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  footerContent?: string;
  baseUrl?: string;
  year?: number;
}

export function createEmailLayout({
  previewText = '',
  heading,
  bodyContent,
  ctaText,
  ctaUrl,
  secondaryCtaText,
  secondaryCtaUrl,
  footerContent = 'If you have any questions or need assistance, please don\'t hesitate to contact our support team.',
  baseUrl = process.env.BASE_URL || 'http://localhost:3000',
  year = new Date().getFullYear()
}: EmailLayoutProps): string {
  // Ensure baseUrl doesn't end with a slash
  const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  // Create absolute URL for logo
  const logoUrl = `${sanitizedBaseUrl}/white.png`;
  
  // Pre-header text (visible in email clients preview)
  const preHeader = previewText ? 
    `<div style="display: none; max-height: 0px; overflow: hidden;">${previewText}</div>` : 
    '';

  // Primary CTA button
  const primaryCta = ctaText && ctaUrl ? 
    `<a href="${ctaUrl}" style="display: inline-block; background-color: #B4916C; color: #050505; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; text-align: center; margin-right: ${secondaryCtaText ? '10px' : '0'};">
      ${ctaText}
    </a>` : 
    '';

  // Secondary CTA button (optional)
  const secondaryCta = secondaryCtaText && secondaryCtaUrl ? 
    `<a href="${secondaryCtaUrl}" style="display: inline-block; background-color: #222222; color: #F9F6EE; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; text-align: center;">
      ${secondaryCtaText}
    </a>` : 
    '';

  // CTA container (only shown if at least one CTA exists)
  const ctaContainer = (primaryCta || secondaryCta) ? 
    `<div style="text-align: center; margin: 30px 0;">
      ${primaryCta}
      ${secondaryCta}
    </div>` : 
    '';

  return `
    ${preHeader}
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #F9F6EE;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${logoUrl}" alt="Resuming.ai Logo" style="width: 150px; height: auto; display: inline-block;" border="0">
      </div>
      
      <div style="background-color: #111111; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #222222;">
        <h1 style="color: #F9F6EE; font-size: 24px; margin-bottom: 20px; font-weight: bold;">${heading}</h1>
        
        <div style="color: #C5C2BA; line-height: 1.6; margin-bottom: 25px;">
          ${bodyContent}
        </div>
        
        ${ctaContainer}
        
        <p style="color: #C5C2BA; line-height: 1.6; margin-bottom: 10px;">
          ${footerContent}
        </p>
      </div>
      
      <div style="text-align: center; color: #8A8782; font-size: 12px; margin-top: 20px;">
        <p>© ${year} Resuming.ai. All rights reserved.</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  `;
} 
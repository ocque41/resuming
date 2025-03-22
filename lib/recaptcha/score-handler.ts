/**
 * Advanced score-based decision logic for reCAPTCHA v3
 * 
 * This utility allows for more nuanced handling of reCAPTCHA scores
 * to take different actions based on the trustworthiness level.
 */

// Define trustworthiness levels based on reCAPTCHA score ranges
export enum TrustLevel {
  HIGH = 'high',       // Very likely human (0.8 - 1.0)
  MEDIUM = 'medium',   // Probably human (0.5 - 0.8)
  LOW = 'low',         // Possibly bot (0.3 - 0.5)
  VERY_LOW = 'veryLow' // Likely bot (0.0 - 0.3)
}

/**
 * Get the trust level based on a reCAPTCHA score
 * 
 * @param score The reCAPTCHA score (0.0 to 1.0)
 * @returns The corresponding trust level
 */
export function getTrustLevel(score: number): TrustLevel {
  if (score >= 0.8) return TrustLevel.HIGH;
  if (score >= 0.5) return TrustLevel.MEDIUM;
  if (score >= 0.3) return TrustLevel.LOW;
  return TrustLevel.VERY_LOW;
}

/**
 * Handle a reCAPTCHA score with different callbacks for each trust level
 * 
 * @param score The reCAPTCHA score (0.0 to 1.0)
 * @param handlers Object containing handlers for different trust levels
 * @returns The result of the executed handler
 */
export function handleScoreWithTrustLevel<T>(
  score: number,
  handlers: {
    [key in TrustLevel]?: () => T;
  } & {
    default: () => T;
  }
): T {
  const trustLevel = getTrustLevel(score);
  return (handlers[trustLevel] || handlers.default)();
}

/**
 * Types of additional verification that might be required based on score
 */
export enum VerificationType {
  NONE = 'none',                 // No additional verification needed
  ADDITIONAL_FIELDS = 'fields',  // Ask for additional form fields
  EMAIL_CODE = 'email',          // Send verification code via email
  PHONE_CODE = 'phone',          // Send verification code via SMS
  CAPTCHA_CHECKBOX = 'captcha',  // Show reCAPTCHA v2 checkbox
  BLOCK = 'block'                // Block the request entirely
}

/**
 * Get the recommended verification type based on reCAPTCHA score and action
 * 
 * @param score The reCAPTCHA score (0.0 to 1.0)
 * @param action The action being verified (e.g., 'signup', 'login')
 * @returns The recommended verification type
 */
export function getRecommendedVerification(score: number, action: string): VerificationType {
  // Different verification strategies based on action
  if (action === 'signup') {
    return handleScoreWithTrustLevel(score, {
      [TrustLevel.HIGH]: () => VerificationType.NONE,
      [TrustLevel.MEDIUM]: () => VerificationType.ADDITIONAL_FIELDS,
      [TrustLevel.LOW]: () => VerificationType.EMAIL_CODE,
      [TrustLevel.VERY_LOW]: () => VerificationType.BLOCK,
      default: () => VerificationType.CAPTCHA_CHECKBOX
    });
  }
  
  if (action === 'login') {
    return handleScoreWithTrustLevel(score, {
      [TrustLevel.HIGH]: () => VerificationType.NONE,
      [TrustLevel.MEDIUM]: () => VerificationType.NONE,
      [TrustLevel.LOW]: () => VerificationType.EMAIL_CODE,
      [TrustLevel.VERY_LOW]: () => VerificationType.CAPTCHA_CHECKBOX,
      default: () => VerificationType.ADDITIONAL_FIELDS
    });
  }
  
  if (action === 'password_reset') {
    return handleScoreWithTrustLevel(score, {
      [TrustLevel.HIGH]: () => VerificationType.EMAIL_CODE, // Always verify for password reset
      [TrustLevel.MEDIUM]: () => VerificationType.EMAIL_CODE,
      [TrustLevel.LOW]: () => VerificationType.CAPTCHA_CHECKBOX,
      [TrustLevel.VERY_LOW]: () => VerificationType.BLOCK,
      default: () => VerificationType.EMAIL_CODE
    });
  }
  
  // Default behavior for other actions
  return handleScoreWithTrustLevel(score, {
    [TrustLevel.HIGH]: () => VerificationType.NONE,
    [TrustLevel.MEDIUM]: () => VerificationType.NONE,
    [TrustLevel.LOW]: () => VerificationType.CAPTCHA_CHECKBOX,
    [TrustLevel.VERY_LOW]: () => VerificationType.BLOCK,
    default: () => VerificationType.ADDITIONAL_FIELDS
  });
}

/**
 * Determines if an additional verification should be performed
 * based on the current reCAPTCHA score and action
 * 
 * @param score The reCAPTCHA score (0.0 to 1.0)
 * @param action The action being verified
 * @returns Whether additional verification is needed
 */
export function needsAdditionalVerification(score: number, action: string): boolean {
  const verificationType = getRecommendedVerification(score, action);
  return verificationType !== VerificationType.NONE;
}

/**
 * Log suspicious activity for monitoring and analysis
 * 
 * @param action The action being performed
 * @param score The reCAPTCHA score
 * @param ip Optional IP address of the request
 * @param userId Optional user ID
 */
export function logSuspiciousActivity(
  action: string,
  score: number,
  ip?: string,
  userId?: string | number
): void {
  // This would typically write to a database or monitoring system
  console.warn(`Suspicious activity detected: action=${action}, score=${score}, ip=${ip || 'unknown'}, userId=${userId || 'unknown'}`);
  
  // For very suspicious activity, you might want to trigger alerts
  if (score < 0.2) {
    console.error(`POTENTIAL ATTACK: Very low trust score for ${action}: ${score}`);
    // Here you would typically integrate with your security monitoring system
  }
} 
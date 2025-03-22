/**
 * Constants for reCAPTCHA v3 actions
 * 
 * This file defines standard action names for reCAPTCHA v3 verification
 * to ensure consistency across the application.
 */

// Define standard reCAPTCHA actions used in the application
export const RECAPTCHA_ACTIONS = {
  // Auth actions
  SIGNUP: 'signup',
  LOGIN: 'login',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  
  // User actions
  PROFILE_UPDATE: 'profile_update',
  ACCOUNT_DELETION: 'account_deletion',
  
  // Content actions
  FORM_SUBMISSION: 'form_submission',
  COMMENT_SUBMISSION: 'comment_submission',
  MESSAGE_SEND: 'message_send',
  
  // Payment actions
  CHECKOUT: 'checkout',
  SUBSCRIPTION: 'subscription',
  
  // Default fallback action
  GENERIC: 'generic_action'
};

/**
 * Minimum acceptable scores for different actions
 * A higher threshold means more security but might reject more legitimate users
 */
const ACTION_SCORE_THRESHOLDS: Record<string, number> = {
  [RECAPTCHA_ACTIONS.SIGNUP]: 0.4,             // Balance between security and user acquisition
  [RECAPTCHA_ACTIONS.LOGIN]: 0.5,              // Slightly stricter than signup
  [RECAPTCHA_ACTIONS.PASSWORD_RESET]: 0.6,     // Stricter for security-sensitive operations
  [RECAPTCHA_ACTIONS.EMAIL_VERIFICATION]: 0.4,
  [RECAPTCHA_ACTIONS.PROFILE_UPDATE]: 0.5,
  [RECAPTCHA_ACTIONS.ACCOUNT_DELETION]: 0.7,   // High security for account deletion
  [RECAPTCHA_ACTIONS.FORM_SUBMISSION]: 0.3,    // Lower threshold for general form submissions
  [RECAPTCHA_ACTIONS.COMMENT_SUBMISSION]: 0.3,
  [RECAPTCHA_ACTIONS.MESSAGE_SEND]: 0.4,
  [RECAPTCHA_ACTIONS.CHECKOUT]: 0.6,           // Higher threshold for financial transactions
  [RECAPTCHA_ACTIONS.SUBSCRIPTION]: 0.6,
  // Default threshold for any other actions
  [RECAPTCHA_ACTIONS.GENERIC]: 0.5
};

/**
 * Get the minimum acceptable score for a specific action
 * 
 * @param action The reCAPTCHA action name
 * @returns The minimum acceptable score (0.0 to 1.0)
 */
export function getMinScoreForAction(action: string): number {
  return ACTION_SCORE_THRESHOLDS[action] || ACTION_SCORE_THRESHOLDS[RECAPTCHA_ACTIONS.GENERIC];
}

/**
 * Get a user-friendly error message for a failed reCAPTCHA verification
 * 
 * @param action The reCAPTCHA action that failed
 * @param score Optional score that was received
 * @returns A user-friendly error message
 */
export function getErrorMessageForAction(action: string, score?: number): string {
  // Generic messages that don't reveal too much about the verification process
  switch (action) {
    case RECAPTCHA_ACTIONS.SIGNUP:
      return "Our system couldn't verify you as a human. Please try again or contact support if this persists.";
    
    case RECAPTCHA_ACTIONS.LOGIN:
      return "For security reasons, we need additional verification. Please try again.";
    
    case RECAPTCHA_ACTIONS.PASSWORD_RESET:
      return "Security check failed. Please try again or use a different device.";
    
    case RECAPTCHA_ACTIONS.CHECKOUT:
    case RECAPTCHA_ACTIONS.SUBSCRIPTION:
      return "For your security, we couldn't process this transaction. Please try again.";
    
    default:
      return "Security verification failed. Please try again later.";
  }
}

/**
 * Check if a given score passes the threshold for an action
 * 
 * @param score The reCAPTCHA score (0.0 to 1.0)
 * @param action The action being verified
 * @returns Whether the score meets the minimum threshold
 */
export function scorePassesThreshold(score: number, action: string): boolean {
  const minScore = getMinScoreForAction(action);
  return score >= minScore;
} 
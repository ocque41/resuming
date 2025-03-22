# Email Verification System

This document provides an overview of the email verification system implemented in the Next.js SaaS starter, explaining its components, configuration, and usage.

## System Components

### 1. Database Schema
- `users` table includes an `email_verified` column to track verification status (timestamp when verified)
- `verification_tokens` table to store temporary tokens for email verification

### 2. Verification Token Service
Located in `lib/auth/verification.ts`, this service provides functions for:
- Creating verification tokens
- Validating tokens
- Marking emails as verified

### 3. Email Service
Located in `lib/email/resend.ts`, handles sending verification emails using the Resend API.

### 4. Verification Pages
- `app/verify-email/page.tsx`: Page that users land on when clicking verification links
- `app/verify-email/verify-email-client.tsx`: Client component handling verification UI states

### 5. API Endpoints
- `app/api/verify-email/route.ts`: Handles verification token validation
- `app/api/resend-verification/route.ts`: Handles resending verification emails

### 6. UI Components
- `components/EmailVerificationBanner.tsx`: Banner shown to users with unverified emails
- `components/EmailVerificationStatus.tsx`: Component for displaying verification status on settings pages
- `components/PremiumPageLayout.tsx`: Layout component that conditionally displays the verification banner

### 7. Integration with Third-Party Services
- Notion database integration for tracking verification status

## Required Environment Variables

```
# Authentication
AUTH_SECRET=your_auth_secret
NEXTAUTH_URL=your_app_url

# Email Service
RESEND_API_KEY=your_resend_api_key
BASE_URL=http://localhost:3000 # or your production URL

# Optional Notion Integration
NOTION_SECRET=your_notion_api_key
NOTION_DB=your_notion_database_id
```

## User Flow

### Registration Process
1. User signs up with email and password
2. System creates an account with `email_verified` set to `null`
3. System generates a verification token and sends an email with verification link
4. User receives an email with a link to verify their account
5. In the dashboard, unverified users see a verification banner

### Email Verification
1. User clicks the verification link in their email
2. They are directed to `/verify-email?token=TOKEN&email=EMAIL`
3. The verification page validates the token with the API
4. If valid, the system marks the email as verified and updates the UI
5. User can now access premium features that require verification

### Resending Verification
1. Users can request a new verification email from:
   - The verification banner in the dashboard
   - The email verification status component in the settings page
2. System generates a new token and sends a fresh verification email
3. Previous tokens for that email are invalidated

## Security Considerations

- Tokens are generated using secure random bytes
- Tokens have a default expiration of 24 hours
- Database includes indexes for efficient token lookup
- The verification flow is resistant to user enumeration attacks
- All API endpoints use proper validation and error handling

## Maintenance Tasks

- Consider setting up a cron job to remove expired tokens periodically
- Monitor token generation and verification rates for abuse
- Keep an eye on email delivery rates and bounces

## Code Examples

### Creating a Verification Token
```typescript
import { createVerificationToken } from "@/lib/auth/verification";

// During registration
const token = await createVerificationToken(userEmail);
await sendVerificationEmail(userEmail, token);
```

### Verifying an Email
```typescript
import { validateVerificationToken, markEmailAsVerified } from "@/lib/auth/verification";

// In API route
const isValid = await validateVerificationToken(email, token);
if (isValid) {
  await markEmailAsVerified(email);
  // Return success response
}
```

### Checking Verification Status
```tsx
// In React component
const { user } = useUser();
const isVerified = !!user?.emailVerified;

return (
  <div>
    {!isVerified && (
      <EmailVerificationBanner email={user.email} />
    )}
    {/* Rest of component */}
  </div>
);
``` 
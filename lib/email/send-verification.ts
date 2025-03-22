import { Resend } from 'resend';
import { VerificationEmail } from '@/components/emails/verification-email';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

type SendVerificationEmailParams = {
  email: string;
  token: string;
  name: string;
};

export async function sendVerificationEmail({
  email,
  token,
  name,
}: SendVerificationEmailParams) {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error('NEXT_PUBLIC_APP_URL environment variable is not set');
  }

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    const data = await resend.emails.send({
      from: 'Resuming.ai <noreply@resuming.ai>',
      to: email,
      subject: 'Verify your email address',
      react: VerificationEmail({
        name: name || 'there',
        verificationUrl,
      }),
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error };
  }
} 
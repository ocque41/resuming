import { Resend } from 'resend';
import { WelcomeEmail } from '@/components/emails/welcome-email';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(email: string, name?: string) {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error('NEXT_PUBLIC_APP_URL environment variable is not set');
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

  try {
    const data = await resend.emails.send({
      from: 'Resuming.ai <noreply@resuming.ai>',
      to: email,
      subject: 'Welcome to Resuming.ai!',
      react: WelcomeEmail({
        name: name || 'there',
        dashboardLink: dashboardUrl,
      }),
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error };
  }
} 
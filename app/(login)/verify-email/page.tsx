import EmailVerificationClient from './EmailVerificationClient';

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token || '';

  return <EmailVerificationClient token={token} />;
} 
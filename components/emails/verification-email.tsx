import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface VerificationEmailProps {
  name: string;
  verificationUrl: string;
}

export const VerificationEmail = ({
  name = 'there',
  verificationUrl
}: VerificationEmailProps) => {
  const previewText = `Verify your email address for Resuming.ai`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://resuming.ai/white.png"
            width="120"
            height="36"
            alt="Resuming.ai"
            style={logo}
          />
          <Heading style={heading}>Verify your email address</Heading>
          <Section>
            <Text style={paragraph}>Hi {name},</Text>
            <Text style={paragraph}>
              Thanks for signing up for Resuming.ai! Please verify your email address by clicking the button below.
            </Text>
            <Button style={{...button, padding: '12px 20px'}} href={verificationUrl}>
              Verify your email
            </Button>
            <Text style={paragraph}>
              This verification link will expire in 24 hours.
            </Text>
            <Text style={paragraph}>
              If you didn't sign up for an account, you can safely ignore this email.
            </Text>
            <Text style={paragraph}>
              Best regards,<br />
              The Resuming.ai Team
            </Text>
          </Section>
          <Text style={footer}>
            Resuming.ai - AI-powered resume optimization <br />
            <Link href="https://resuming.ai" style={link}>
              resuming.ai
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#050505',
  fontFamily: 'Arial, sans-serif',
  padding: '40px 0',
};

const container = {
  backgroundColor: '#111111',
  border: '1px solid #333333',
  borderRadius: '8px',
  margin: '0 auto',
  padding: '40px',
  width: '100%',
  maxWidth: '600px',
};

const logo = {
  margin: '0 auto 20px',
  display: 'block',
};

const heading = {
  color: '#F9F6EE',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px',
  textAlign: 'center' as const,
};

const paragraph = {
  color: '#C5C2BA',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px',
};

const button = {
  backgroundColor: '#B4916C',
  borderRadius: '4px',
  color: '#050505',
  display: 'inline-block',
  fontWeight: '600',
  marginBottom: '16px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};

const link = {
  color: '#B4916C',
  textDecoration: 'underline',
};

const footer = {
  color: '#999999',
  fontSize: '14px',
  margin: '40px 0 0',
  textAlign: 'center' as const,
}; 
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export const VerificationEmail = ({
  verificationLink = 'https://example.com/verify-email?token=123',
}: {
  verificationLink: string;
}) => (
  <Html>
    <Head />
    <Preview>Verify your email address for CV Optimizer</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoContainer}>
          <img
            src={`${process.env.NEXT_PUBLIC_APP_URL}/logo.png`}
            width="150"
            height="40"
            alt="CV Optimizer"
            style={logo}
          />
        </Section>
        <Heading style={h1}>Verify your email address</Heading>
        <Text style={text}>
          Thank you for signing up for CV Optimizer. Please verify your email address
          by clicking the button below:
        </Text>
        <Section style={buttonContainer}>
          <Button style={button} href={verificationLink}>
            Verify Email Address
          </Button>
        </Section>
        <Text style={text}>
          If you didn&apos;t sign up for CV Optimizer, you can safely ignore this email.
        </Text>
        <Text style={text}>
          Or copy and paste this URL into your browser:{' '}
          <Link href={verificationLink} style={link}>
            {verificationLink}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          &copy; {new Date().getFullYear()} CV Optimizer. All rights reserved.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default VerificationEmail;

const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
};

const logoContainer = {
  marginBottom: '24px',
};

const logo = {
  display: 'block',
  margin: '0 auto',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '30px 0',
  textAlign: 'center' as const,
};

const text = {
  color: '#444',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const buttonContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#B4916C',
  borderRadius: '4px',
  color: '#FFF',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 'bold',
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const link = {
  color: '#B4916C',
  textDecoration: 'underline',
};

const hr = {
  border: 'none',
  borderTop: '1px solid #ddd',
  margin: '32px 0',
};

const footer = {
  color: '#888',
  fontSize: '12px',
  margin: '0',
  textAlign: 'center' as const,
}; 
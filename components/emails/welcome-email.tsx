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
  Hr,
} from '@react-email/components';

export interface WelcomeEmailProps {
  name: string;
  dashboardLink: string;
}

export const WelcomeEmail = ({
  name = 'there',
  dashboardLink
}: WelcomeEmailProps) => {
  const previewText = `Welcome to Resuming.ai! Your account is now verified.`;

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
          <Heading style={heading}>Welcome to Resuming.ai!</Heading>
          <Section>
            <Text style={paragraph}>Hi {name},</Text>
            <Text style={paragraph}>
              Your email has been verified and your account is now active. Thank you for joining Resuming.ai!
            </Text>
            
            <Text style={paragraph}>
              With your account, you can now:
            </Text>
            
            <ul style={list as React.CSSProperties}>
              <li style={listItem as React.CSSProperties}>Upload and optimize your CV</li>
              <li style={listItem as React.CSSProperties}>Analyze your documents for insights</li>
              <li style={listItem as React.CSSProperties}>Generate job descriptions</li>
              <li style={listItem as React.CSSProperties}>Match your CV against job descriptions</li>
              <li style={listItem as React.CSSProperties}>And much more!</li>
            </ul>
            
            <Button style={{...button, padding: '12px 20px'}} href={dashboardLink}>
              Go to Your Dashboard
            </Button>
            
            <Text style={paragraph}>
              If you have any questions or need assistance, don't hesitate to contact our support team.
            </Text>
            
            <Text style={paragraph}>
              Best regards,<br />
              The Resuming.ai Team
            </Text>
          </Section>
          <Hr style={hr} />
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

const list = {
  color: '#C5C2BA',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px',
  paddingLeft: '20px',
};

const listItem = {
  margin: '8px 0',
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

const hr = {
  border: 'none',
  borderTop: '1px solid #333333',
  margin: '32px 0 16px',
};

const link = {
  color: '#B4916C',
  textDecoration: 'underline',
};

const footer = {
  color: '#8A8782',
  fontSize: '14px',
  margin: '16px 0 0',
  textAlign: 'center' as const,
}; 
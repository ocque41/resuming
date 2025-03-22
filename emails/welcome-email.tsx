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

export const WelcomeEmail = ({
  name = 'there',
  dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
}: {
  name?: string;
  dashboardLink?: string;
}) => (
  <Html>
    <Head />
    <Preview>Welcome to CV Optimizer!</Preview>
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
        <Heading style={h1}>Welcome, {name}!</Heading>
        <Text style={text}>
          Thank you for verifying your email address. Your account is now fully set up, and you can start using CV Optimizer to enhance your resume and job search process.
        </Text>
        <Section style={buttonContainer}>
          <Button style={button} href={dashboardLink}>
            Go to Dashboard
          </Button>
        </Section>
        <Text style={text}>
          Here's what you can do with CV Optimizer:
        </Text>
        <ul style={list}>
          <li style={listItem}>Upload your CV and get instant analysis</li>
          <li style={listItem}>Tailor your CV to specific job descriptions</li>
          <li style={listItem}>Create optimized cover letters</li>
          <li style={listItem}>Track your job applications</li>
        </ul>
        <Text style={text}>
          If you have any questions or need help getting started, don't hesitate to reach out to our support team.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          &copy; {new Date().getFullYear()} CV Optimizer. All rights reserved.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

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

const list = {
  color: '#444',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
  paddingLeft: '26px',
};

const listItem = {
  margin: '8px 0',
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
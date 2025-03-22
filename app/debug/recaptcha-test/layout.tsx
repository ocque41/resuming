import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'reCAPTCHA Debug | Internal Tools',
  description: 'Internal tool for debugging reCAPTCHA configuration',
  openGraph: {
    type: 'website',
    title: 'reCAPTCHA Debug',
    description: 'Internal tool for debugging reCAPTCHA configuration',
  },
};

export default function ReCaptchaDebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
} 
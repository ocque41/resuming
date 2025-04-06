import { Metadata } from 'next';

// Create a timestamp at build/render time
const timestamp = Date.now();

export const metadata: Metadata = {
  title: 'The Jobs Playground - The AI CV Optimizer and Document Analysis Platform',
  description: 'Just Press Enter. The AI CV Optimizer and Document Analysis Platform for all your document needs.',
  openGraph: {
    title: 'The Jobs Playground',
    description: 'The AI CV Optimizer and Document Analysis Platform',
    images: [
      {
        url: `https://resuming.ai/1.png?v=${timestamp}`,
        width: 1200,
        height: 630,
        alt: 'The Jobs Playground - AI CV Optimizer and Document Analysis Platform',
      },
    ],
    url: 'https://resuming.ai',
    siteName: 'The Jobs Playground',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Jobs Playground',
    description: 'The AI CV Optimizer and Document Analysis Platform',
    images: [`https://resuming.ai/1.png?v=${timestamp}`],
    creator: '@resumingai',
  },
}; 
import { Metadata } from 'next';

// Create a timestamp at build/render time
const timestamp = Date.now();

export const metadata: Metadata = {
  title: 'Resuming - The First Engineer-Recruiter AI Platform',
  description: 'Designed for technical professionals and emerging talent alike. Optimize your career today with AI-powered tools.',
  openGraph: {
    title: 'Resuming',
    description: 'The First Engineer-Recruiter AI Platform.',
    images: [
      {
        url: `https://resuming.ai/1.png?v=${timestamp}`,
        width: 1200,
        height: 630,
        alt: 'Resuming - AI Platform for Engineers and Recruiters',
      },
    ],
    url: 'https://resuming.ai',
    siteName: 'Resuming',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resuming',
    description: 'The First Engineer-Recruiter AI Platform.',
    images: [`https://resuming.ai/1.png?v=${timestamp}`],
    creator: '@resumingai',
  },
}; 
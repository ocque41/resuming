import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import localFont from 'next/font/local';
import { getUser } from '@/lib/db/queries.server';
import { ThemeProvider } from 'app/theme-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { Inter } from "next/font/google";
import Script from 'next/script';
import { TransitionCurtain } from '../components/TransitionCurtain';

export const metadata: Metadata = {
  title: 'Resuming - The First Engineer-Recruiter AI Platform | Optimize Your Technical Career',
  description: 'Resuming.ai offers AI-powered resume optimization, CV analysis, and career enhancement tools designed specifically for engineers and technical professionals.',
  keywords: 'CV, resume, job search, career, AI, optimization, analysis, engineer, recruiter, technical professionals, emerging talent',
  authors: [{ name: 'Resuming Team', url: 'https://resuming.ai' }],
  creator: 'Resuming.ai',
  publisher: 'Resuming.ai',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://resuming.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Resuming',
    description: 'The First Engineer - Recruiter AI Platform.',
    images: [
      {
        url: `https://resuming.ai/1.png?v=${Date.now()}`,
        width: 1200,
        height: 630,
        alt: 'Resuming - AI Platform for Engineers and Recruiters',
      },
    ],
    locale: 'en_US',
    type: 'website',
    siteName: 'Resuming',
    url: 'https://resuming.ai',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resuming',
    description: 'The First Engineer - Recruiter AI Platform.',
    images: [`https://resuming.ai/1.png?v=${Date.now()}`],
    creator: '@resumingai',
  },
  icons: {
    icon: '/favicon-for-app/favicon.ico',
    apple: '/favicon-for-app/favicon.ico',
    shortcut: '/favicon-for-app/favicon.ico',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  maximumScale: 1,
  viewportFit: 'cover',
};

// Define the fonts
const manrope = Manrope({ subsets: ['latin'] });
const safiroFont = localFont({
  src: './fonts/Safiro-Medium.otf',
  variable: '--font-safiro',
  display: 'swap',
});
const bornaFont = localFont({
  src: './fonts/Borna-Medium.otf',
  variable: '--font-borna',
  display: 'swap',
});
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userPromise = getUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.className} ${safiroFont.variable} ${bornaFont.variable} ${inter.className}`}
    >
      <head>
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta name="revisit-after" content="7 days" />
        <meta name="rating" content="general" />
        <meta name="googlebot" content="index,follow" />
        <meta name="google" content="notranslate" />
        <meta name="google-site-verification" content="your-verification-code" />
        <meta name="msvalidate.01" content="your-bing-verification-code" />
        <meta name="application-name" content="Resuming" />
        <link rel="canonical" href="https://resuming.ai" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Facebook and WhatsApp specific */}
        <meta property="og:image:secure_url" content={`https://resuming.ai/1.png?v=${Date.now()}`} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:updated_time" content={new Date().toISOString()} />
        <meta property="fb:app_id" content="resumingapp" />

        <link
          rel="stylesheet"
          href="https://unpkg.com/franken-ui@1.1.0/dist/css/core.min.css"
        />
        <Script
          src="https://unpkg.com/franken-ui@1.1.0/dist/js/core.iife.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://unpkg.com/franken-ui@1.1.0/dist/js/icon.iife.js"
          strategy="afterInteractive"
        />
        <Script id="franken-ui-init" strategy="afterInteractive">
          {`
            document.addEventListener("uikit:init", () => {
              // Initialize Franken UI components here
              console.log("Franken UI initialized");
            });
          `}
        </Script>

        {/* AI-specific meta tags */}
        <meta name="ai-content-type" content="ai-platform, career-tools, resume-optimization, job-matching" />
        <meta name="ai-audience" content="engineers, developers, technical professionals, recruiters, hiring managers" />
        <meta name="ai-use-case" content="resume optimization, job matching, skills analysis, career advancement" />
        <meta name="ai-features" content="resume analysis, job matching, skills assessment, ai recommendations" />
        <meta name="ai-data-policy" content="user-data-protected, privacy-first, gdpr-compliant" />
      </head>
      <body className="min-h-[100dvh] bg-[#050505] font-borna">
        <TransitionCurtain />
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider defaultTheme="dark" storageKey="app-theme">
              {children}
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

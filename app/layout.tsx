import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import localFont from 'next/font/local';
import { getUser } from '@/lib/db/queries.server';
import { ThemeProvider } from 'app/theme-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { Inter } from "next/font/google";
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Resuming.ai - The First Engineer-Recruiter AI Platform',
  description: 'Designed for technical professionals and emerging talent alike, our platform leverages advanced AI to perfect resumes, analyze documents, and connect you with the right career opportunities.',
  keywords: 'CV, resume, job search, career, AI, optimization, analysis, engineer, recruiter, technical professionals, emerging talent',
  authors: [{ name: 'Resuming.ai Team' }],
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
    title: 'Resuming.ai - The First Engineer-Recruiter AI Platform',
    description: 'Designed for technical professionals and emerging talent alike, our platform leverages advanced AI to perfect resumes, analyze documents, and connect you with the right career opportunities.',
    url: 'https://resuming.ai',
    siteName: 'Resuming.ai',
    images: [
      {
        url: '/1.png',
        width: 1200,
        height: 630,
        alt: 'Resuming.ai - The First Engineer-Recruiter AI Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resuming.ai - The First Engineer-Recruiter AI Platform',
    description: 'Designed for technical professionals and emerging talent alike, our platform leverages advanced AI to perfect resumes, analyze documents, and connect you with the right career opportunities.',
    images: ['/1.png'],
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
        <link
          rel="stylesheet"
          href="https://unpkg.com/franken-ui@1.1.0/dist/css/core.min.css"
        />
        <script src="https://unpkg.com/franken-ui@1.1.0/dist/js/core.iife.js" />
        <script src="https://unpkg.com/franken-ui@1.1.0/dist/js/icon.iife.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener("uikit:init", () => {
                // Initialize Franken UI components here
                console.log("Franken UI initialized");
              });
            `,
          }}
        />
      </head>
      <body className="min-h-[100dvh] bg-[#050505] font-borna">
        <I18nProvider>
          <ThemeProvider defaultTheme="dark" storageKey="app-theme">
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

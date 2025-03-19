import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import localFont from 'next/font/local';
import { UserProvider } from '@/lib/auth';
import { getUser } from '@/lib/db/queries.server';
import { ThemeProvider } from 'app/theme-provider';
import { I18nProvider } from '@/components/i18n-provider';
import { Inter } from "next/font/google";

export const metadata: Metadata = {
  title: 'CV Optimizer - AI-powered CV Analysis & Optimization',
  description: 'AI-powered CV Analysis & Optimization unlocking exclusive career opportunities.',
  keywords: 'CV, resume, job search, career, AI, optimization, analysis',
  authors: [{ name: 'CV Optimizer Team' }],
  creator: 'CV Optimizer',
  publisher: 'CV Optimizer',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://cvoptimizer.com'), // Replace with your actual domain
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'CV Optimizer - AI-powered CV Analysis & Optimization',
    description: 'AI-powered CV Analysis & Optimization unlocking exclusive career opportunities.',
    url: 'https://cvoptimizer.com', // Replace with your actual domain
    siteName: 'CV Optimizer',
    images: [
      {
        url: '/9.webp', // Using the same image as the hero
        width: 1200,
        height: 630,
        alt: 'CV Optimizer - AI-powered CV Analysis & Optimization',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CV Optimizer - AI-powered CV Analysis & Optimization',
    description: 'AI-powered CV Analysis & Optimization unlocking exclusive career opportunities.',
    images: ['/9.webp'], // Using the same image as the hero
    creator: '@cvoptimizer', // Replace with your actual Twitter handle
  },
  icons: {
    icon: '/Screenshot 2025-03-04 230224.png',
    apple: '/Screenshot 2025-03-04 230224.png',
    shortcut: '/Screenshot 2025-03-04 230224.png',
  },
  manifest: '/manifest.json', // You'll need to create this file for PWA support
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
            <UserProvider userPromise={userPromise}>
              <main className="flex-grow">{children}</main>
            </UserProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

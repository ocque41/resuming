import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { UserProvider } from '@/lib/auth';
import { getUser } from '@/lib/db/queries';
import { MainNav } from '@/components/ui/main-nav';
import { ThemeProvider } from './theme-provider';

export const metadata: Metadata = {
  title: 'Next.js SaaS Starter',
  description: 'Get started quickly with Next.js, Postgres, and Stripe.',
};

export const viewport: Viewport = {
  maximumScale: 1,
  viewportFit: 'cover',
};

const manrope = Manrope({ subsets: ['latin'] });

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
      className={manrope.className}
    >
      <head>
        <script src="https://unpkg.com/franken-ui@1.1.0/dist/js/core.iife.js"></script>
        <script src="https://unpkg.com/franken-ui@1.1.0/dist/js/icon.iife.js"></script>
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
      <body className="min-h-[100dvh]">
        <ThemeProvider defaultTheme="light" storageKey="app-theme">
          <UserProvider userPromise={userPromise}>
            <MainNav />
            {children}
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

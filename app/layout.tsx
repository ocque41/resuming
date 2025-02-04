import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { UserProvider } from '@/lib/auth';
import { getUser } from '@/lib/db/queries';
import { MainNav } from '@/components/ui/main-nav';
import { MainNav } from '@/components/ui/main-nav';

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
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/franken-ui@latest/dist/franken-ui.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/franken-ui@latest/dist/franken-ui.min.js" defer></script>
      </head>
      <body className="min-h-[100dvh] bg-gray-50">
        <UserProvider userPromise={userPromise}>
          <MainNav />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}

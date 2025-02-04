import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Zen_Kaku_Gothic_New } from 'next/font/google';
import { UserProvider } from '@/lib/auth';
import { getUser } from '@/lib/db/queries';
import { MainNav } from '@/components/ui/main-nav';
import { ThemeProvider } from 'app/theme-provider';
import { I18nProvider } from '@/components/i18n-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const zenKaku = Zen_Kaku_Gothic_New({ 
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-zen-kaku'
});

export const metadata: Metadata = {
  title: 'Resuming - AI Powered CV Optimizer',
  description: 'AI powered CV Optimizer and job matching for job acquiring and creation.',
};

export const viewport: Viewport = {
  maximumScale: 1,
  viewportFit: 'cover',
};

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
      className={`${inter.variable} ${zenKaku.variable}`}
    >
      <body className="min-h-[100dvh] bg-[#FAF6ED] font-inter">
        <I18nProvider>
          <ThemeProvider defaultTheme="light" storageKey="app-theme">
            <UserProvider userPromise={userPromise}>
              <MainNav />
              <main className="flex-grow">
                {children}
              </main>
            </UserProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

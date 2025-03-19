// Type declarations for Next.js
import { Metadata } from 'next';

// Override the PageProps type to make it compatible with our page components
declare module 'next' {
  interface PageProps {
    params: {
      [key: string]: string;
    };
    searchParams?: { [key: string]: string | string[] | undefined };
  }
}

export {}; 
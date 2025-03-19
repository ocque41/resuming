// global.d.ts
declare module 'next' {
  export type Metadata = {
    title?: string | null;
    description?: string | null;
    keywords?: string | string[] | null;
    authors?: Array<{ name: string; url?: string }> | null;
    creator?: string | null;
    publisher?: string | null;
    formatDetection?: {
      email?: boolean;
      address?: boolean;
      telephone?: boolean;
    };
    metadataBase?: URL | null;
    alternates?: {
      canonical?: string;
      languages?: Record<string, string>;
      media?: Record<string, string>;
      types?: Record<string, string>;
    };
    openGraph?: {
      title?: string;
      description?: string;
      url?: string;
      siteName?: string;
      images?: Array<{
        url: string;
        width?: number;
        height?: number;
        alt?: string;
      }>;
      locale?: string;
      type?: string;
    };
    twitter?: {
      card?: string;
      title?: string;
      description?: string;
      images?: string[];
      creator?: string;
    };
    icons?: {
      icon?: string;
      apple?: string;
      shortcut?: string;
    };
    manifest?: string;
  };
  
  export type Viewport = {
    width?: string | number;
    height?: string | number;
    initialScale?: number;
    minimumScale?: number;
    maximumScale?: number;
    userScalable?: boolean;
    viewportFit?: 'auto' | 'cover' | 'contain';
    interactiveWidget?: 'resizes-visual' | 'resizes-content' | 'overlays-content';
  };
} 
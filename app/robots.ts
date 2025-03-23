// Define the robots type without using MetadataRoute
type RobotsEntry = {
  rules: {
    userAgent: string;
    allow?: string | string[];
    disallow?: string | string[];
  }[];
  sitemap?: string;
  host?: string;
};

export default function robots(): RobotsEntry {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/_next/',
          '/dashboard/*', // Protect user data
        ],
      }
    ],
    sitemap: 'https://resuming.ai/sitemap.xml',
  }
} 
// Define the sitemap entry type without using MetadataRoute
type SitemapEntry = {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

export default function sitemap(): Array<SitemapEntry> {
  const baseUrl = 'https://resuming.ai'
  
  // Core pages
  const routes = [
    '',
    '/login',
    '/signup',
    '/pricing',
    '/about',
    '/features',
    '/contact',
    '/blog',
    '/terms',
    '/privacy',
    '/dashboard',
    '/dashboard/documents'
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  return routes
} 
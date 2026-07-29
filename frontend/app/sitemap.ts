import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // These are the static routes in the application
  const routes = [
    '',
    '/login',
    '/dashboard',
    '/dashboard/categories',
    '/dashboard/employees',
    '/dashboard/trends',
    '/dashboard/anomalies',
    '/dashboard/data',
    '/dashboard/ai',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
    changeFrequency: 'daily',
    priority: route === '' || route === '/dashboard' ? 1 : 0.8,
  }));
}

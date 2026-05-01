export const dynamic = 'force-dynamic';

import type { MetadataRoute } from 'next';
  import { getBlogPosts } from '@/lib/notion';
  const cozumlerSlugs = [
    'toplanti-ingilizcesi',
    'sunum-teknikleri',
    'eposta-yazimi',
    'muzakere-ve-ikna',
    'telaffuz-ve-akicilik',
    'yoneticiler-icin',
    'ik-profesyonelleri',
    'satis-ekipleri',
    'teknik-ekipler',
    'finans-ingilizcesi',
    'teknoloji-ingilizcesi',
    'saglik-ingilizcesi',
    'hukuk-ingilizcesi',
  ];

  const BASE_URL = 'https://www.sphereenglish.com';

  export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const today = new Date().toISOString();

    const staticUrls: MetadataRoute.Sitemap = [
      {
        url: BASE_URL,
        lastModified: today,
        changeFrequency: 'weekly',
        priority: 1.0,
      },
      {
        url: `${BASE_URL}/home`,
        lastModified: today,
        changeFrequency: 'weekly',
        priority: 1.0,
      },
      {
        url: `${BASE_URL}/hakkimizda`,
        lastModified: today,
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/nasil-calisir`,
        lastModified: today,
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: `${BASE_URL}/cozumler`,
        lastModified: today,
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        url: `${BASE_URL}/blog`,
        lastModified: today,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: `${BASE_URL}/iletisim`,
        lastModified: today,
        changeFrequency: 'monthly',
        priority: 0.7,
      },
    ];

    const cozumlerUrls: MetadataRoute.Sitemap = cozumlerSlugs.map((slug) => ({
      url: `${BASE_URL}/cozumler/${slug}`,
      lastModified: today,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));

    let blogUrls: MetadataRoute.Sitemap = [];
    try {
      const posts = await getBlogPosts();
      blogUrls = posts.map((post) => ({
        url: `${BASE_URL}/blog/${post.slug}`,
        lastModified: post.date || today,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
    } catch {
      // Notion erişilemezse blog URL\'leri atla
    }

    return [...staticUrls, ...cozumlerUrls, ...blogUrls];
  }
  
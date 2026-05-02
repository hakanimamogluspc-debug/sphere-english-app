export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { MetadataRoute } from 'next';
import { getBlogPosts } from '@/lib/notion';
import {
  fetchAllSolutionSlugs,
  fetchPublishedBlogPosts,
} from '@/payload/api';

const BASE_URL = 'https://www.sphereenglish.com';

const FALLBACK_SOLUTION_SLUGS = [
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date().toISOString();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: today, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/home`, lastModified: today, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/hakkimizda`, lastModified: today, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/nasil-calisir`, lastModified: today, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/cozumler`, lastModified: today, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: today, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/iletisim`, lastModified: today, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/ai-studio`, lastModified: today, changeFrequency: 'monthly', priority: 0.7 },
  ];

  // Solutions: prefer Payload, fall back to hardcoded list
  let solutionSlugs: string[] = [];
  try {
    solutionSlugs = await fetchAllSolutionSlugs();
  } catch (err) {
    console.warn('[sitemap] Payload solutions unavailable, using fallback list:', err);
  }
  if (solutionSlugs.length === 0) {
    solutionSlugs = FALLBACK_SOLUTION_SLUGS;
  }

  const cozumlerUrls: MetadataRoute.Sitemap = solutionSlugs.map((slug) => ({
    url: `${BASE_URL}/cozumler/${slug}`,
    lastModified: today,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Blog posts: merge Payload (CMS) + Notion (legacy), Payload wins on slug
  const [cmsResult, notionResult] = await Promise.allSettled([
    fetchPublishedBlogPosts(),
    getBlogPosts(),
  ]);

  const blogEntries: { slug: string; date: string }[] = [];
  const blogSlugSeen = new Set<string>();

  if (cmsResult.status === 'fulfilled' && cmsResult.value) {
    for (const p of cmsResult.value as any[]) {
      if (p.slug && !blogSlugSeen.has(p.slug)) {
        blogSlugSeen.add(p.slug);
        blogEntries.push({ slug: p.slug, date: p.date || today });
      }
    }
  } else if (cmsResult.status === 'rejected') {
    console.warn('[sitemap] Payload blog posts unavailable:', cmsResult.reason);
  }

  if (notionResult.status === 'fulfilled' && notionResult.value) {
    for (const p of notionResult.value) {
      if (p.slug && !blogSlugSeen.has(p.slug)) {
        blogSlugSeen.add(p.slug);
        blogEntries.push({ slug: p.slug, date: p.date || today });
      }
    }
  } else if (notionResult.status === 'rejected') {
    console.warn('[sitemap] Notion blog posts unavailable:', notionResult.reason);
  }

  const blogUrls: MetadataRoute.Sitemap = blogEntries.map(({ slug, date }) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: date,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticUrls, ...cozumlerUrls, ...blogUrls];
}

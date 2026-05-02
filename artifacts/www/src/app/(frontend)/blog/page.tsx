export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — İş İngilizcesi & Kurumsal Eğitim Rehberi',
  description:
    'İş dünyasında İngilizce, kurumsal dil eğitimi, kariyer gelişimi ve sektör haberleri hakkında uzman içerikler. Sphere English Blog.',
  alternates: { canonical: 'https://www.sphereenglish.com/blog' },
  openGraph: {
    title: 'Blog | Sphere English — İş İngilizcesi Rehberi',
    description:
      'İş dünyasında İngilizce ve kurumsal eğitim üzerine uzman içerikler, ipuçları ve güncel haberler.',
    url: 'https://www.sphereenglish.com/blog',
    images: [{ url: '/assets/blog_cover_english.svg', width: 1200, height: 630 }],
  },
};

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getBlogPosts, BlogPost } from '@/lib/notion';
import { fetchPublishedBlogPosts } from '@/payload/api';

const categoryColors: Record<string, string> = {
  'İngilizce': 'bg-[#1B365D] text-white',
  'Eğitim': 'bg-[#1B365D] text-white',
  'Kariyer': 'bg-[#1B365D] text-white',
  'Haberler': 'bg-[#1B365D] text-white',
};

const DEFAULT_COVER = '/assets/blog_cover_education.svg';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function normalizePayloadPost(p: any): BlogPost {
  const cover = p.cover && typeof p.cover === 'object' ? (p.cover.sizes?.card?.url || p.cover.url || '') : '';
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    summary: p.summary || '',
    category: p.category || '',
    status: p.status || 'Published',
    cover: cover || `/assets/blog/${p.slug}.svg`,
    date: p.date || '',
    author: p.author || 'Sphere English',
  };
}

function BlogCard({ post }: { post: BlogPost }) {
  const coverImage = post.cover || DEFAULT_COVER;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden transition-all duration-300 border border-gray-100 shadow-[0_4px_20px_rgba(27,54,93,0.08)] hover:shadow-[0_8px_32px_rgba(27,54,93,0.18)]"
    >
      <div className="relative h-48 overflow-hidden bg-[#1B365D]">
        <img
          src={coverImage}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {post.category && (
          <span
            className={`absolute top-3 left-3 text-xs font-semibold px-3 py-1 rounded-md tracking-wide ${categoryColors[post.category] || 'bg-[#1B365D] text-white'}`}
          >
            {post.category}
          </span>
        )}
      </div>
      <div className="p-6">
        <h2 className="text-lg font-bold text-[#1B365D] mb-2 group-hover:text-[#00BCD4] transition-colors line-clamp-2 leading-snug">
          {post.title}
        </h2>
        {post.summary && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-3 leading-relaxed">{post.summary}</p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
          <span className="font-medium text-[#1B365D] opacity-70">{post.author}</span>
          {post.date && <span>{formatDate(post.date)}</span>}
        </div>
      </div>
    </Link>
  );
}

export default async function BlogPage() {
  let posts: BlogPost[] = [];
  let error: string | null = null;

  // Fetch BOTH sources in parallel and merge.
  // Payload (CMS) wins on slug collision; Notion fills in legacy posts.
  const [cmsResult, notionResult] = await Promise.allSettled([
    fetchPublishedBlogPosts(),
    getBlogPosts(),
  ]);

  const cmsPosts: BlogPost[] =
    cmsResult.status === 'fulfilled' && cmsResult.value
      ? cmsResult.value.map(normalizePayloadPost)
      : [];

  const notionPosts: BlogPost[] =
    notionResult.status === 'fulfilled' && notionResult.value
      ? notionResult.value
      : [];

  if (cmsResult.status === 'rejected') {
    console.warn('[blog] Payload fetch failed:', cmsResult.reason);
  }
  if (notionResult.status === 'rejected') {
    console.warn('[blog] Notion fetch failed:', notionResult.reason);
  }

  // Merge: CMS first (wins on slug), then Notion (fills gaps)
  const slugSeen = new Set<string>();
  const merged: BlogPost[] = [];
  for (const p of cmsPosts) {
    if (p.slug && !slugSeen.has(p.slug)) {
      slugSeen.add(p.slug);
      merged.push(p);
    }
  }
  for (const p of notionPosts) {
    if (p.slug && !slugSeen.has(p.slug)) {
      slugSeen.add(p.slug);
      merged.push(p);
    }
  }

  // Sort by date desc (newest first); posts without dates go last.
  merged.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  posts = merged;

  if (posts.length === 0 && cmsResult.status === 'rejected' && notionResult.status === 'rejected') {
    error = 'Blog yazıları yüklenirken bir hata oluştu.';
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header />

      <section className="pt-32 pb-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <span className="inline-block text-xs font-semibold tracking-widest text-[#00BCD4] uppercase mb-4">Blog</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1B365D] mb-4 leading-tight">
            İngilizce & Eğitim<br />
            <span className="text-[#00BCD4]">Dünyasından Haberler</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto">
            Dil öğrenimi, kariyer gelişimi ve kurumsal eğitim hakkında uzman içerikler.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {posts.length === 0 && error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-600 font-medium mb-1">Bağlantı Hatası</p>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400 font-medium">Henüz yayınlanmış blog yazısı yok.</p>
              <p className="text-gray-300 text-sm mt-1">/admin panelinden Blog Yazıları ekleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export const dynamic = 'force-dynamic';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getBlogPostBySlug, getPageBlocks, BlogBlock } from '@/lib/notion';
import { fetchBlogPostBySlug } from '@/payload/api';
import { LexicalContent } from '@/payload/lexical-render';

interface PageProps {
  params: Promise<{ slug: string }>;
}

type UnifiedPost = {
  source: 'cms' | 'notion';
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  cover: string;
  date: string;
  author: string;
  // CMS richText (Lexical) OR Notion blocks
  cmsContent?: any;
  notionBlocks?: BlogBlock[];
};

async function loadPost(slug: string): Promise<UnifiedPost | null> {
  // 1) Try Payload CMS
  try {
    const cms = await fetchBlogPostBySlug(slug);
    if (cms && (cms as any).status === 'Published') {
      const c: any = cms;
      const coverObj = c.cover && typeof c.cover === 'object' ? c.cover : null;
      const coverUrl = coverObj?.sizes?.tablet?.url || coverObj?.url || '';
      return {
        source: 'cms',
        id: c.id,
        title: c.title,
        slug: c.slug,
        summary: c.summary || '',
        category: c.category || '',
        cover: coverUrl,
        date: c.date || '',
        author: c.author || 'Sphere English',
        cmsContent: c.content,
      };
    }
  } catch (err) {
    console.warn('[blog/slug] Payload fetch failed, trying Notion:', err);
  }

  // 2) Fallback to Notion
  try {
    const notionPost = await getBlogPostBySlug(slug);
    if (!notionPost) return null;
    const allBlocks = await getPageBlocks(notionPost.id);
    const blocks = allBlocks.filter((block) => {
      const lower = (block.content?.trim() || '').toLowerCase();
      return !(
        lower.startsWith('meta başlık') ||
        lower.startsWith('meta aciklama') ||
        lower.startsWith('meta açıklama') ||
        lower.startsWith('url slug') ||
        lower.startsWith('seo title') ||
        lower.startsWith('meta title') ||
        lower.startsWith('meta description')
      );
    });
    return {
      source: 'notion',
      id: notionPost.id,
      title: notionPost.title,
      slug: notionPost.slug,
      summary: notionPost.summary,
      category: notionPost.category,
      cover: notionPost.cover,
      date: notionPost.date,
      author: notionPost.author,
      notionBlocks: blocks,
    };
  } catch (err) {
    console.warn('[blog/slug] Notion fetch failed:', err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const post = await loadPost(slug);
    if (!post) return { title: 'Blog Yazısı Bulunamadı' };
    return {
      title: post.title,
      description: post.summary || post.title,
      alternates: { canonical: `https://www.sphereenglish.com/blog/${slug}` },
      openGraph: {
        title: post.title,
        description: post.summary || post.title,
        url: `https://www.sphereenglish.com/blog/${slug}`,
        type: 'article',
        publishedTime: post.date,
        images: post.cover ? [{ url: post.cover, width: 1200, height: 630 }] : [],
      },
    };
  } catch {
    return { title: 'Blog | Sphere English' };
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderNotionBlock(block: BlogBlock): React.ReactNode {
  switch (block.type) {
    case 'heading_1':
      return <h1 key={block.id} className="text-3xl font-bold text-gray-900 mt-10 mb-4">{block.content}</h1>;
    case 'heading_2':
      return <h2 key={block.id} className="text-2xl font-bold text-gray-900 mt-8 mb-3">{block.content}</h2>;
    case 'heading_3':
      return <h3 key={block.id} className="text-xl font-semibold text-gray-800 mt-6 mb-2">{block.content}</h3>;
    case 'paragraph':
      return block.content ? (
        <p key={block.id} className="text-gray-700 leading-relaxed mb-4">{block.content}</p>
      ) : (
        <div key={block.id} className="mb-4" />
      );
    case 'bulleted_list_item':
      return <li key={block.id} className="text-gray-700 leading-relaxed mb-1 ml-4 list-disc">{block.content}</li>;
    case 'numbered_list_item':
      return <li key={block.id} className="text-gray-700 leading-relaxed mb-1 ml-4 list-decimal">{block.content}</li>;
    case 'quote':
      return (
        <blockquote key={block.id} className="border-l-4 border-blue-400 pl-5 py-2 my-6 bg-blue-50 rounded-r-lg">
          <p className="text-gray-700 italic leading-relaxed">{block.content}</p>
        </blockquote>
      );
    case 'code':
      return (
        <pre key={block.id} className="bg-gray-900 text-green-300 rounded-xl p-5 my-6 overflow-x-auto text-sm font-mono">
          <code>{block.content}</code>
        </pre>
      );
    case 'divider':
      return <hr key={block.id} className="my-8 border-gray-200" />;
    case 'image':
      return block.content ? (
        <figure key={block.id} className="my-8">
          <img src={block.content} alt="Blog görseli" className="w-full rounded-xl object-cover" />
        </figure>
      ) : null;
    case 'callout':
      return (
        <div key={block.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 my-6 flex gap-3">
          <span className="text-xl">💡</span>
          <p className="text-gray-700 leading-relaxed">{block.content}</p>
        </div>
      );
    default:
      return block.content ? (
        <p key={block.id} className="text-gray-700 leading-relaxed mb-4">{block.content}</p>
      ) : null;
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary || post.title,
    image: post.cover || 'https://www.sphereenglish.com/assets/images/hero_online_english_lesson.png',
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Organization',
      name: post.author || 'Sphere English',
      url: 'https://www.sphereenglish.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Sphere English',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.sphereenglish.com/assets/images/logo-1774019980261.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.sphereenglish.com/blog/${slug}`,
    },
    articleSection: post.category || 'Eğitim',
    inLanguage: 'tr-TR',
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Header />

      <main className="pt-28 pb-20">
        <div className="max-w-2xl mx-auto px-6">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors mb-8">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Blog&apos;a Dön
          </Link>

          <div className="mb-6">
            {post.category && (
              <span className="inline-block text-xs font-semibold tracking-widest text-blue-600 uppercase mb-3">
                {post.category}
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
              {post.title}
            </h1>
            {post.summary && (
              <p className="text-lg text-gray-500 leading-relaxed mb-6">{post.summary}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-400 pb-6 border-b border-gray-100">
              <span className="font-medium text-gray-600">{post.author}</span>
              {post.date && (
                <>
                  <span>·</span>
                  <span>{formatDate(post.date)}</span>
                </>
              )}
            </div>
          </div>

          {post.cover && (
            <div className="mb-8 rounded-2xl overflow-hidden">
              <img src={post.cover} alt={post.title} className="w-full h-64 object-cover" />
            </div>
          )}

          <article className="prose-content">
            {post.source === 'cms' && post.cmsContent ? (
              <LexicalContent content={post.cmsContent} />
            ) : post.source === 'notion' && post.notionBlocks && post.notionBlocks.length > 0 ? (
              post.notionBlocks.map(renderNotionBlock)
            ) : (
              <p className="text-gray-400 text-center py-10">İçerik bulunamadı.</p>
            )}
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

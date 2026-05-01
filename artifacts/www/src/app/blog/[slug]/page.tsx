export const dynamic = 'force-dynamic';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getBlogPostBySlug, getPageBlocks, BlogBlock } from '@/lib/notion';

  import type { Metadata } from 'next';
  import { getBlogPostBySlug as getBlogPostBySlugMeta } from '@/lib/notion';

  export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    try {
      const { slug } = await params;
      const post = await getBlogPostBySlugMeta(slug);
      if (!post) return { title: 'Blog Yazısı Bulunamadı' };
      return {
        title: post.title,
        description: post.excerpt || post.title,
        alternates: { canonical: `https://www.sphereenglish.com/blog/${slug}` },
        openGraph: {
          title: post.title,
          description: post.excerpt || post.title,
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

  

interface PageProps {
  params: Promise<{ slug: string }>;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderBlock(block: BlogBlock, index: number): React.ReactNode {
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
      return (
        <li key={block.id} className="text-gray-700 leading-relaxed mb-1 ml-4 list-disc">
          {block.content}
        </li>
      );
    case 'numbered_list_item':
      return (
        <li key={block.id} className="text-gray-700 leading-relaxed mb-1 ml-4 list-decimal">
          {block.content}
        </li>
      );
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

  let post = null;
  let blocks: BlogBlock[] = [];
  let error: string | null = null;

  try {
    post = await getBlogPostBySlug(slug);
    if (!post) notFound();
    const allBlocks = await getPageBlocks(post.id);
    // Filter out SEO metadata blocks that should not appear in visible content
    blocks = allBlocks.filter((block) => {
      const content = block.content?.trim() || '';
      const lower = content.toLowerCase();
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
  } catch (err: any) {
    error = err?.message || 'Blog yazısı yüklenirken bir hata oluştu.';
  }

  if (!post && !error) notFound();

  return (
    <div className="min-h-screen bg-white font-sans">
      <Header />

      <main className="pt-28 pb-20">
        <div className="max-w-2xl mx-auto px-6">
          {/* Back */}
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors mb-8">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Blog&apos;a Dön
          </Link>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-600 font-medium mb-1">Hata</p>
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : post ? (
            <>
              {/* Meta */}
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

              {/* Cover */}
              {post.cover && (
                <div className="mb-8 rounded-2xl overflow-hidden">
                  <img
                    src={post.cover}
                    alt={post.title}
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <article className="prose-content">
                {blocks.length === 0 ? (
                  <p className="text-gray-400 text-center py-10">İçerik yükleniyor...</p>
                ) : (
                  blocks.map((block, index) => renderBlock(block, index))
                )}
              </article>
            </>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}

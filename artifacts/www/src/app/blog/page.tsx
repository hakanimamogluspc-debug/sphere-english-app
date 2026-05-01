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

const categoryColors: Record<string, string> = {
  'İngilizce': 'bg-[#1B365D] text-white',
  'Eğitim': 'bg-[#1B365D] text-white',
  'Kariyer': 'bg-[#1B365D] text-white',
  'Haberler': 'bg-[#1B365D] text-white',
};

const categoryCovers: Record<string, string> = {
  'İngilizce': '/assets/blog_cover_english.svg',
  'Eğitim': '/assets/blog_cover_education.svg',
  'Kariyer': '/assets/blog_cover_career.svg',
  'Haberler': '/assets/blog_cover_news.svg',
};

const DEFAULT_COVER = '/assets/blog_cover_education.svg';

// Inline SVG fallbacks for categories without generated SVGs
function CareerCoverSVG() {
  return (
    <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="careerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B365D" />
          <stop offset="100%" stopColor="#0f2040" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#careerGrad)" />
      {/* Dot grid */}
      {[40,80,120,160,200,240,280,320,360].map(x =>
        [30,70,110,150,190].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#C4B9AC" opacity="0.2" />
        ))
      )}
      {/* Bar chart */}
      <rect x="80" y="130" width="28" height="40" rx="3" fill="#C4B9AC" opacity="0.4" />
      <rect x="120" y="110" width="28" height="60" rx="3" fill="#C4B9AC" opacity="0.5" />
      <rect x="160" y="85" width="28" height="85" rx="3" fill="#00BCD4" opacity="0.7" />
      <rect x="200" y="65" width="28" height="105" rx="3" fill="#00BCD4" opacity="0.9" />
      {/* Upward arrow */}
      <polyline points="75,145 115,120 155,95 195,70 235,45" stroke="#00BCD4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <polygon points="235,45 225,55 245,55" fill="#00BCD4" />
      {/* Briefcase icon */}
      <rect x="290" y="75" width="60" height="45" rx="5" fill="none" stroke="white" strokeWidth="2" opacity="0.8" />
      <rect x="305" y="68" width="30" height="12" rx="3" fill="none" stroke="white" strokeWidth="2" opacity="0.8" />
      <line x1="290" y1="95" x2="350" y2="95" stroke="white" strokeWidth="2" opacity="0.5" />
      {/* Professional silhouette */}
      <circle cx="320" cy="145" r="10" fill="#C4B9AC" opacity="0.6" />
      <path d="M305 170 Q320 155 335 170" stroke="#C4B9AC" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  );
}

function NewsCoverSVG() {
  return (
    <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="newsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B365D" />
          <stop offset="100%" stopColor="#1a3460" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#newsGrad)" />
      {/* Diagonal lines */}
      {[-50,-20,10,40,70,100,130,160,190,220,250,280,310,340,370,400].map((x, i) => (
        <line key={i} x1={x} y1="0" x2={x + 50} y2="200" stroke="#C4B9AC" strokeWidth="0.5" opacity="0.1" />
      ))}
      {/* Newspaper layout */}
      <rect x="60" y="40" width="180" height="130" rx="6" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" />
      <rect x="70" y="50" width="160" height="20" rx="2" fill="white" opacity="0.15" />
      <rect x="70" y="78" width="100" height="6" rx="2" fill="#C4B9AC" opacity="0.4" />
      <rect x="70" y="90" width="120" height="6" rx="2" fill="#C4B9AC" opacity="0.3" />
      <rect x="70" y="102" width="90" height="6" rx="2" fill="#C4B9AC" opacity="0.3" />
      <rect x="70" y="114" width="110" height="6" rx="2" fill="#C4B9AC" opacity="0.3" />
      <rect x="70" y="126" width="80" height="6" rx="2" fill="#C4B9AC" opacity="0.2" />
      {/* Megaphone */}
      <polygon points="280,70 310,55 310,115 280,100" fill="#00BCD4" opacity="0.8" />
      <rect x="260" y="78" width="22" height="22" rx="3" fill="#00BCD4" opacity="0.9" />
      <path d="M295 115 L295 135 L310 135" stroke="#00BCD4" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
      {/* Bell icon */}
      <path d="M330 50 Q330 35 345 35 Q360 35 360 50 L360 65 L330 65 Z" fill="none" stroke="white" strokeWidth="2" opacity="0.7" />
      <line x1="345" y1="65" x2="345" y2="72" stroke="white" strokeWidth="2" opacity="0.7" />
      <line x1="325" y1="65" x2="365" y2="65" stroke="white" strokeWidth="2" opacity="0.7" />
    </svg>
  );
}

function DefaultCoverSVG() {
  return (
    <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="defaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B365D" />
          <stop offset="100%" stopColor="#0d2a4e" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#defaultGrad)" />
      {[40,80,120,160,200,240,280,320,360].map(x =>
        [30,70,110,150,190].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#C4B9AC" opacity="0.15" />
        ))
      )}
      <circle cx="200" cy="100" r="45" fill="none" stroke="#00BCD4" strokeWidth="1.5" opacity="0.4" />
      <circle cx="200" cy="100" r="30" fill="none" stroke="#C4B9AC" strokeWidth="1" opacity="0.3" />
      <circle cx="200" cy="100" r="8" fill="#00BCD4" opacity="0.7" />
    </svg>
  );
}

function CategoryCoverImage({ src, category, title }: { src: string; category: string; title: string }) {
  // Use inline SVG for career and news since SVG generation limit was reached
  if (category === 'Kariyer' && !src.includes('http')) {
    return <CareerCoverSVG />;
  }
  if (category === 'Haberler' && !src.includes('http')) {
    return <NewsCoverSVG />;
  }
  if (!src || src === DEFAULT_COVER) {
    return <DefaultCoverSVG />;
  }
  return (
    <img
      src={src}
      alt={title}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
    />
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function BlogCard({ post }: { post: BlogPost }) {
  const coverImage = post.cover || `/assets/blog/${post.slug}.svg`;
  const isExternalCover = true; // slug-bazlı SVG veya harici URL, hepsini <img> olarak render et

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden transition-all duration-300 border border-gray-100 shadow-[0_4px_20px_rgba(27,54,93,0.08)] hover:shadow-[0_8px_32px_rgba(27,54,93,0.18)]"
    >
      {/* Cover Image */}
      <div className="relative h-48 overflow-hidden bg-[#1B365D]">
        {isExternalCover ? (
          <img
            src={coverImage}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full group-hover:scale-105 transition-transform duration-500">
            <CategoryCoverImage src={coverImage} category={post.category} title={post.title} />
          </div>
        )}
        {post.category && (
          <span
            className={`absolute top-3 left-3 text-xs font-semibold px-3 py-1 rounded-md tracking-wide ${categoryColors[post.category] || 'bg-[#1B365D] text-white'}`}
          >
            {post.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h2 className="text-lg font-bold text-[#1B365D] mb-2 group-hover:text-[#00BCD4] transition-colors line-clamp-2 leading-snug">
          {post.title}
        </h2>
        {post.summary && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-3 leading-relaxed">
            {post.summary}
          </p>
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

  try {
    posts = await getBlogPosts();
  } catch (err: any) {
    error = err?.message || 'Blog yazıları yüklenirken bir hata oluştu.';
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header />

      {/* Hero */}
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

      {/* Posts */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-600 font-medium mb-1">Bağlantı Hatası</p>
              <p className="text-red-500 text-sm">{error}</p>
              <p className="text-gray-400 text-xs mt-3">Lütfen NOTION_API_KEY ve NOTION_DATABASE_ID ortam değişkenlerini kontrol edin.</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400 font-medium">Henüz yayınlanmış blog yazısı yok.</p>
              <p className="text-gray-300 text-sm mt-1">Notion&apos;da &quot;Published&quot; durumundaki yazılar burada görünecek.</p>
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

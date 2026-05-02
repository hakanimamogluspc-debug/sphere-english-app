import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import {
  fetchSolution,
  fetchAllSolutionSlugs,
} from '@/payload/api';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = await fetchSolution(slug);
  if (!solution) return { title: 'Sayfa Bulunamadı | Sphere English' };
  return {
    title: `${solution.title} | Sphere English`,
    description: solution.description,
    alternates: { canonical: `https://www.sphereenglish.com/cozumler/${slug}` },
    openGraph: {
      title: `${solution.title} | Sphere English`,
      description: solution.description,
      url: `https://www.sphereenglish.com/cozumler/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  try {
    const slugs = await fetchAllSolutionSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export default async function CozumlerPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = await fetchSolution(slug);

  if (!solution) {
    notFound();
  }

  const body: string[] = (solution.body || []).map((b: any) => b.paragraph).filter(Boolean);
  const highlights: string[] = (solution.highlights || []).map((h: any) => h.item).filter(Boolean);

  return (
    <main className="min-h-screen bg-white">
      <Header forceWhite />
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-[#082567] to-[#1a3a8f] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.22em] text-blue-200 uppercase mb-4">
            {solution.category}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {solution.title}
          </h1>
          <p className="text-lg md:text-xl text-blue-100 leading-relaxed max-w-2xl mx-auto">
            {solution.description}
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-16 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {body.map((paragraph: string, i: number) => (
            <p key={i} className="text-[16px] text-gray-700 leading-[1.8]">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* Highlights */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-[#082567] mb-10 text-center tracking-tight">
            Program İçeriği
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {highlights.map((item: string, i: number) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:border-[#082567]/20 hover:bg-blue-50/30 transition-all duration-200"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#082567] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[15px] text-anthracite font-medium leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-[#082567] mb-4">
            Hemen Başlayın
          </h3>
          <p className="text-gray-600 mb-8 text-[15px]">
            Ekibiniz veya kendiniz için özel bir program oluşturmak ister misiniz? Uzmanlarımızla ücretsiz görüşün.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/#iletisim"
              className="inline-flex items-center justify-center gap-2 bg-[#082567] hover:bg-[#0a2d7a] text-white px-8 py-4 rounded-2xl text-[15px] font-bold tracking-wide transition-all duration-200 hover:shadow-md"
            >
              {solution.ctaText}
            </Link>
            <Link
              href="/cozumler"
              className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-[#082567] px-8 py-4 rounded-2xl text-[15px] font-semibold tracking-wide transition-all duration-200 hover:border-[#082567]/30 hover:bg-blue-50/30"
            >
              Tüm Çözümleri Gör
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

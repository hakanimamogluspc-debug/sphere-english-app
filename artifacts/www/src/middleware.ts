import { NextRequest, NextResponse } from 'next/server';

/**
 * Markdown for Agents — content negotiation
 *
 * AI agent'lar HTML yerine markdown istediklerinde (Accept: text/markdown)
 * önceden hazırlanmış markdown versiyonuna yönlendirir.
 *
 * Spec: https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
 *
 * Eşleme: URL path → /content/{path}.md
 *   /          → /content/home.md
 *   /home      → /content/home.md
 *   /ai-studio → /content/ai-studio.md
 *   ...
 */

const MARKDOWN_PATHS: Record<string, string> = {
  '/': '/content/home.md',
  '/home': '/content/home.md',
  '/hakkimizda': '/content/hakkimizda.md',
  '/ai-studio': '/content/ai-studio.md',
  '/nasil-calisir': '/content/nasil-calisir.md',
  '/cozumler': '/content/cozumler.md',
  '/iletisim': '/content/iletisim.md',
};

function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const lower = accept.toLowerCase();
  // text/markdown veya text/x-markdown istenmiş ve text/html üzerinde tercih ediliyor
  if (!lower.includes('text/markdown') && !lower.includes('text/x-markdown')) return false;
  // text/html daha öncelikli ise normal HTML dön (tarayıcı isteği gibi davran)
  const mdMatch = lower.match(/text\/(?:x-)?markdown(?:;q=([0-9.]+))?/);
  const htmlMatch = lower.match(/text\/html(?:;q=([0-9.]+))?/);
  const mdQ = mdMatch ? (mdMatch[1] ? parseFloat(mdMatch[1]) : 1) : 0;
  const htmlQ = htmlMatch ? (htmlMatch[1] ? parseFloat(htmlMatch[1]) : 1) : 0;
  return mdQ >= htmlQ;
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Sadece tanınan public sayfalarda content negotiation
  const mdPath = MARKDOWN_PATHS[pathname];
  if (!mdPath) {
    return NextResponse.next();
  }

  if (!wantsMarkdown(req.headers.get('accept'))) {
    // Normal HTML akışına devam — ama Vary: Accept header'ı ile cache uyarısı ver
    const res = NextResponse.next();
    res.headers.set('Vary', 'Accept');
    return res;
  }

  // Markdown isteniyor — public klasöründeki .md dosyasına yönlendir
  const url = req.nextUrl.clone();
  url.pathname = mdPath;
  const res = NextResponse.rewrite(url);
  res.headers.set('Content-Type', 'text/markdown; charset=utf-8');
  res.headers.set('Vary', 'Accept');
  // Custom: response'un üretildiği path
  res.headers.set('x-markdown-source', pathname);
  return res;
}

export const config = {
  matcher: [
    '/',
    '/home',
    '/hakkimizda',
    '/ai-studio',
    '/nasil-calisir',
    '/cozumler',
    '/iletisim',
  ],
};

import type { MetadataRoute } from 'next';

/**
 * Next.js robots.ts — MetadataRoute.Robots tipini kullanır.
 *
 * NOT: Content-Signal direktifi (contentsignals.org / draft-romm-aipref-contentsignals)
 * Next.js'in MetadataRoute.Robots tipinde resmi olarak desteklenmiyor.
 * Bu nedenle ilk user-agent satırının altına newline ile inject ediliyor.
 * Robots.txt parser'ları satır bazlı çalıştığı için bu güvenlidir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Wildcard + Content-Signal direktifi (AI içerik kullanım tercihleri)
        // ai-train=yes  → AI modelleri Sphere içeriğini eğitim için kullanabilir
        // search=yes    → Arama motorları index'leyebilir
        // ai-input=yes  → AI sistemleri yanıtlarında Sphere'i kaynak olarak gösterebilir
        userAgent: '*\nContent-Signal: ai-train=yes, search=yes, ai-input=yes',
        allow: '/',
      },
      // AI Arama Tarayıcıları — açıkça izin verildi
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Amazonbot', allow: '/' },
      { userAgent: 'cohere-ai', allow: '/' },
      { userAgent: 'Bytespider', allow: '/' },
      { userAgent: 'YouBot', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'Meta-ExternalFetcher', allow: '/' },
    ],
    sitemap: 'https://www.sphereenglish.com/sitemap.xml',
    host: 'https://www.sphereenglish.com',
  };
}

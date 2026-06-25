'use client';

/**
 * WebMCP Provider — Browser-side AI agent tool exposure
 *
 * navigator.modelContext.provideContext() çağırarak Sphere English'in
 * site içi tool'larını Chrome/Edge'deki AI agent'lara (Gemini, Claude in
 * Chrome vb.) açar.
 *
 * Spec:
 *   - https://webmachinelearning.github.io/webmcp/
 *   - https://developer.chrome.com/blog/webmcp-epp
 *
 * Bu API henüz experimental — tarayıcı desteği yoksa sessizce no-op olur.
 */

import { useEffect } from 'react';

// WebMCP henüz Web standartlarına dahil olmadığı için tip global olarak yok.
// Minimal interface tanımı:
interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: object; // JSON Schema
  execute: (input: any) => Promise<{ content: string } | string>;
}

interface ModelContextAPI {
  provideContext(definition: { tools: WebMCPTool[] }): Promise<void> | void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContextAPI;
  }
}

const SPHERE_TOOLS: WebMCPTool[] = [
  {
    name: 'sphere_search_blog',
    description:
      'Sphere English iş İngilizcesi blogunda yazı arar. CEFR seviyeleri, sektörel İngilizce konuları, kurumsal eğitim, AI Studio kullanımı gibi konularda Türkçe makaleler döndürür.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Aranan konu, örn: "müzakere", "B2 seviyesi", "e-posta yazımı"',
        },
      },
      required: ['query'],
    },
    execute: async ({ query }: { query: string }) => {
      const url = `https://www.sphereenglish.com/blog?q=${encodeURIComponent(query)}`;
      return {
        content:
          `Sphere English blogunda "${query}" için arama: ${url}\n\n` +
          `Tüm blog yazıları için: https://www.sphereenglish.com/blog`,
      };
    },
  },
  {
    name: 'sphere_request_demo',
    description:
      'Sphere English kurumsal İş İngilizcesi platformu için demo görüşmesi talep eder. Kullanıcının şirket bilgilerini iletişim sayfasına yönlendirir.',
    inputSchema: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'Şirket adı' },
        sector: {
          type: 'string',
          description:
            'Sektör (finans, teknoloji, sağlık, lojistik, hukuk, danışmanlık vb.)',
        },
        employeeCount: {
          type: 'integer',
          description: 'Eğitim alacak çalışan sayısı',
          minimum: 1,
        },
      },
      required: ['company'],
    },
    execute: async (input) => {
      const params = new URLSearchParams();
      if (input.company) params.set('company', input.company);
      if (input.sector) params.set('sector', input.sector);
      if (input.employeeCount) params.set('teamSize', String(input.employeeCount));
      const url = `https://www.sphereenglish.com/iletisim?${params.toString()}`;
      return {
        content:
          `Demo talep formuna yönlendirildi: ${url}\n\n` +
          `Form bilgileri önceden doldurulmuş halde açılır. Kullanıcının manuel onaylaması gerekir.`,
      };
    },
  },
  {
    name: 'sphere_pricing_info',
    description:
      'Sphere English kurumsal İş İngilizcesi platformunun bant fiyatlandırma bilgisini döndürür. Bireysel birebir, kurumsal küçük grup, orta ölçek ve enterprise planları.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          enum: ['bireysel', 'kurumsal-grup', 'kurumsal-orta', 'enterprise'],
          description: 'Plan tipi (opsiyonel; verilmezse tüm planlar döner)',
        },
      },
    },
    execute: async ({ plan }: { plan?: string }) => {
      const plans: Record<string, string> = {
        bireysel: 'Bireysel Birebir — Aylık 4.500 TL\'den başlar. Haftada 2× 45 dk birebir Zoom dersi + AI Studio.',
        'kurumsal-grup':
          'Kurumsal Küçük Grup (5–15 kişi) — Aylık 18.000 TL\'den başlar. Haftada 2× 60 dk grup dersi + AI Studio + raporlama.',
        'kurumsal-orta':
          'Kurumsal Orta Ölçek (16–50 kişi) — Aylık 45.000 TL\'den başlar. Paralel gruplar + dedicated success manager.',
        enterprise:
          'Enterprise (50+ kişi) — Özel teklif. SSO, custom analytics, dedicated account manager. sales@sphereenglish.com',
      };

      let content = '';
      if (plan && plans[plan]) {
        content = plans[plan];
      } else {
        content = Object.values(plans).join('\n\n');
      }
      content += '\n\nDetay: https://www.sphereenglish.com/pricing.md';
      return { content };
    },
  },
  {
    name: 'sphere_list_ai_coaches',
    description:
      'Sphere AI Studio bünyesindeki 12 yapay zeka koçunu listeler. Her koçun uzmanlık alanı, aksanı ve hedef profili.',
    inputSchema: {
      type: 'object',
      properties: {
        sector: {
          type: 'string',
          description: 'Sektör filtresi (opsiyonel) — örn: "finans", "satış", "hukuk"',
        },
      },
    },
    execute: async ({ sector }: { sector?: string }) => {
      const coaches = [
        { name: 'Mr. Sterling', sector: 'üst yönetim', accent: 'İngiliz RP', for: 'CEO, stratejik sunum' },
        { name: 'Jake', sector: 'pazarlama', accent: 'Amerikan West Coast', for: 'Dijital pazarlama, startup' },
        { name: 'David', sector: 'finans', accent: 'New York (Wall Street)', for: 'Yatırım, CFO toplantısı' },
        { name: 'Emma', sector: 'insan kaynakları', accent: 'Standart İngiliz', for: 'Mülakat, performans' },
        { name: 'Raj', sector: 'teknoloji', accent: 'Hint-İngiliz', for: 'Teknik sunum, scrum' },
        { name: 'Hans', sector: 'lojistik', accent: 'Alman-İngiliz', for: 'Tedarik zinciri, Avrupa' },
        { name: 'Elena', sector: 'hukuk', accent: 'Diplomatik Doğu Avrupa', for: 'Sözleşme, müzakere' },
        { name: 'Alistair', sector: 'satış', accent: 'İskoç', for: 'Müzakere, kapanış' },
        { name: 'Chloe', sector: 'müşteri ilişkileri', accent: 'Avustralya', for: 'Destek, e-ticaret' },
        { name: 'James', sector: 'üretim', accent: 'Amerikan Midwest', for: 'Üretim, tedarikçi' },
        { name: 'Dr. Claire', sector: 'akademik', accent: 'Oxford Akademik', for: 'Gramer, IELTS, TOEFL' },
        { name: 'Dr. Olivia', sector: 'sağlık', accent: 'Amerikan Miami', for: 'Sağlık turizmi, medikal' },
      ];

      const filtered = sector
        ? coaches.filter((c) => c.sector.toLowerCase().includes(sector.toLowerCase()))
        : coaches;

      const content =
        filtered
          .map((c) => `• ${c.name} (${c.sector}) — ${c.accent} aksanı, ${c.for}`)
          .join('\n') +
        `\n\nDetay: https://www.sphereenglish.com/ai-studio`;

      return { content };
    },
  },
  {
    name: 'sphere_open_chatbot',
    description:
      'Sphere Asistan chatbot widget\'ını sayfa içinde açar. Kullanıcı doğrudan sohbete başlayabilir.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      // Widget global root
      const root = document.getElementById('sphere-asistan-root');
      if (root) {
        const btn = root.querySelector('button');
        if (btn) (btn as HTMLButtonElement).click();
      }
      return { content: 'Sphere Asistan chatbot açıldı. Kullanıcı sohbete başlayabilir.' };
    },
  },
];

export default function WebMCPProvider() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.modelContext) {
      // WebMCP henüz desteklenmiyor (default — çoğu tarayıcı için bu olur)
      return;
    }
    try {
      const result = navigator.modelContext.provideContext({ tools: SPHERE_TOOLS });
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err) => {
          // Sessizce yut — WebMCP henüz experimental
          console.debug('[WebMCP] provideContext failed:', err);
        });
      }
    } catch (err) {
      console.debug('[WebMCP] provideContext threw:', err);
    }
  }, []);

  return null;
}

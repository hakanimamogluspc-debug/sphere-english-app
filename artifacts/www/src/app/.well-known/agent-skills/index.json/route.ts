/**
 * /.well-known/agent-skills/index.json — Cloudflare Agent Skills Discovery RFC v0.2.0
 *
 * Sphere English'in 12 AI koçu + AI Studio modüllerini AI agent'larına
 * "skill" olarak tanıtır. Her skill için name, type, description, url,
 * sha256 digest içerir.
 *
 * Spec: https://github.com/cloudflare/agent-skills-discovery-rfc
 *       https://agentskills.io/
 */

import { createHash } from 'node:crypto';

export const dynamic = 'force-static';

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

interface SkillEntry {
  name: string;
  type: 'agent' | 'tool' | 'service' | 'knowledge';
  description: string;
  url: string;
  category?: string;
  tags?: string[];
}

const skillsData: SkillEntry[] = [
  // ─── AI Studio Modülleri (Tools) ────────────────────────────────────────
  {
    name: 'pronunciation-coach',
    type: 'tool',
    description:
      'Whisper AI ile gerçek zamanlı telaffuz analizi. Fonem düzeyinde hata tespiti, anlık skor ve düzeltme önerileri.',
    url: 'https://app.sphereenglish.com/student/pronunciation-coach',
    category: 'speaking',
    tags: ['pronunciation', 'whisper-ai', 'audio-analysis', 'speaking-practice'],
  },
  {
    name: 'business-simulation',
    type: 'tool',
    description:
      '14 sektörde 50+ iş senaryosu — yatırımcı sunumu, müzakere, kriz iletişimi. GPT-4o destekli AI koçlarla pratik.',
    url: 'https://app.sphereenglish.com/student/simulation-mode',
    category: 'speaking',
    tags: ['business-scenarios', 'role-play', 'gpt-4o', 'industry-specific'],
  },
  {
    name: 'writing-coach',
    type: 'tool',
    description:
      '7 iş yazısı türü için AI editör — e-posta, rapor, sunum metni, müzakere mektubu. CEFR seviye tespiti.',
    url: 'https://app.sphereenglish.com/student/writing-coach',
    category: 'writing',
    tags: ['writing', 'editing', 'business-emails', 'reports'],
  },
  {
    name: 'grammar-coach',
    type: 'tool',
    description:
      'A1–C2 arası yapılandırılmış müfredat (her seviyede çoklu ders birimi). Türk öğrencilerin sık yaptığı hatalara odaklı.',
    url: 'https://app.sphereenglish.com/student/grammar-coach',
    category: 'grammar',
    tags: ['grammar', 'cefr', 'structured-learning'],
  },
  {
    name: 'vocab-game',
    type: 'tool',
    description:
      '4000+ iş İngilizcesi kelimesi adaptif zorluk algoritmasıyla. Liderlik tablosu ve streak sistemi.',
    url: 'https://app.sphereenglish.com/student/vocab-game',
    category: 'vocabulary',
    tags: ['vocabulary', 'gamification', 'business-english'],
  },
  {
    name: 'interview-simulator',
    type: 'tool',
    description: 'AI mülakat simülatörü — sektöre özel sorular, gerçek zamanlı geri bildirim.',
    url: 'https://app.sphereenglish.com/student/interview-simulator',
    category: 'speaking',
    tags: ['interview', 'job-prep', 'speaking'],
  },
  {
    name: 'presentation-simulator',
    type: 'tool',
    description: 'AI sunum simülatörü — sunum yapısı, tempo, vurgu analizi ve Q&A pratiği.',
    url: 'https://app.sphereenglish.com/student/presentation-simulator',
    category: 'speaking',
    tags: ['presentation', 'public-speaking', 'pacing'],
  },
  {
    name: 'ai-quiz-generator',
    type: 'tool',
    description: 'Konu bazlı akıllı quiz üretici — AI seviyene göre adaptif sorular.',
    url: 'https://app.sphereenglish.com/student/ai-quiz',
    category: 'testing',
    tags: ['quiz', 'assessment', 'adaptive'],
  },
  {
    name: 'ai-tutor',
    type: 'agent',
    description: 'Kişisel AI öğretmen — sürekli hafıza, kişiselleştirilmiş ders planı.',
    url: 'https://app.sphereenglish.com/student/ai-tutor',
    category: 'tutoring',
    tags: ['tutor', 'personalized', 'memory'],
  },
  {
    name: 'learning-path',
    type: 'service',
    description: 'Adaptif öğrenme yolu — CEFR seviye, hedef ve performansa göre dinamik müfredat.',
    url: 'https://app.sphereenglish.com/student/learning-path',
    category: 'curriculum',
    tags: ['adaptive-learning', 'cefr', 'personalization'],
  },

  // ─── 12 AI Koç (Agent) ──────────────────────────────────────────────────
  {
    name: 'coach-sterling',
    type: 'agent',
    description:
      'Mr. Sterling — CEO & Stratejik Yönetim. İngiliz RP aksanı. C-suite toplantı, yatırımcı sunumu uzmanı.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=sterling',
    category: 'coach',
    tags: ['executive', 'british-rp', 'leadership', 'c-suite'],
  },
  {
    name: 'coach-jake',
    type: 'agent',
    description: 'Jake — Pazarlama & Dijital Medya. West Coast Amerikan. Startup, pitch, sosyal medya dili.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=jake',
    category: 'coach',
    tags: ['marketing', 'american-west', 'startup', 'digital'],
  },
  {
    name: 'coach-david',
    type: 'agent',
    description: 'David — Finans & Yatırım. New York/Wall Street. Yatırım sunumu, CFO toplantısı.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=david',
    category: 'coach',
    tags: ['finance', 'wall-street', 'investment', 'cfo'],
  },
  {
    name: 'coach-emma',
    type: 'agent',
    description: 'Emma — İnsan Kaynakları. Standart İngiliz. Mülakat, performans görüşmesi, İK yazışmaları.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=emma',
    category: 'coach',
    tags: ['hr', 'british', 'interview', 'performance-review'],
  },
  {
    name: 'coach-raj',
    type: 'agent',
    description: 'Raj — BT & Yazılım Geliştirme. Hint-İngiliz/Global Tech. Teknik sunum, scrum, dokümantasyon.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=raj',
    category: 'coach',
    tags: ['it', 'software', 'indian-english', 'tech'],
  },
  {
    name: 'coach-hans',
    type: 'agent',
    description: 'Hans — Lojistik & Operasyon. Alman-İngiliz. Tedarik zinciri, Avrupa iş iletişimi.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=hans',
    category: 'coach',
    tags: ['logistics', 'german-english', 'supply-chain', 'operations'],
  },
  {
    name: 'coach-elena',
    type: 'agent',
    description: 'Elena — Uluslararası Hukuk. Diplomatik Doğu Avrupa. Sözleşme müzakeresi, hukuki yazışma.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=elena',
    category: 'coach',
    tags: ['law', 'diplomatic', 'contracts', 'compliance'],
  },
  {
    name: 'coach-alistair',
    type: 'agent',
    description: 'Alistair — Satış & Müzakere. İskoç aksanı. Müzakere teknikleri, ikna dili, kapanış.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=alistair',
    category: 'coach',
    tags: ['sales', 'scottish', 'negotiation', 'closing'],
  },
  {
    name: 'coach-chloe',
    type: 'agent',
    description: 'Chloe — Müşteri İlişkileri. Avustralya aksanı. Müşteri desteği, e-ticaret iletişimi.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=chloe',
    category: 'coach',
    tags: ['customer-service', 'australian', 'support', 'ecommerce'],
  },
  {
    name: 'coach-james',
    type: 'agent',
    description: 'James — Üretim & Fabrika. Amerikan Midwest. Üretim süreçleri, tedarikçi görüşmeleri.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=james',
    category: 'coach',
    tags: ['manufacturing', 'american-midwest', 'production', 'industrial'],
  },
  {
    name: 'coach-claire',
    type: 'agent',
    description: 'Dr. Claire — Gramer & Akademik. Oxford Akademik. IELTS/TOEFL, akademik İngilizce.',
    url: 'https://app.sphereenglish.com/student/grammar-coach?coach=claire',
    category: 'coach',
    tags: ['grammar', 'oxford', 'ielts', 'toefl', 'academic'],
  },
  {
    name: 'coach-olivia',
    type: 'agent',
    description: 'Dr. Olivia — Sağlık Turizmi & Medikal. Amerikan Miami. Hastane koordinasyonu, medikal İngilizce.',
    url: 'https://app.sphereenglish.com/student/simulation-mode?coach=olivia',
    category: 'coach',
    tags: ['medical', 'health-tourism', 'american-miami', 'clinical'],
  },

  // ─── Knowledge & Discovery ──────────────────────────────────────────────
  {
    name: 'sphere-knowledge-base',
    type: 'knowledge',
    description: 'Sphere English platformu hakkında AI-okunabilir bilgi rehberi (llms.txt formatında).',
    url: 'https://www.sphereenglish.com/llms.txt',
    category: 'documentation',
    tags: ['llms-txt', 'company-info', 'product-catalog'],
  },
  {
    name: 'sphere-pricing-catalog',
    type: 'knowledge',
    description: 'Bant fiyatlandırma bilgisi (AI satın alma ajanları için makine-okunabilir markdown).',
    url: 'https://www.sphereenglish.com/pricing.md',
    category: 'pricing',
    tags: ['pricing', 'plans', 'b2b'],
  },
  {
    name: 'sphere-blog-index',
    type: 'knowledge',
    description: 'İş İngilizcesi & kurumsal eğitim rehberi — 30+ uzman makale.',
    url: 'https://www.sphereenglish.com/blog',
    category: 'content',
    tags: ['blog', 'business-english', 'editorial'],
  },
  {
    name: 'sphere-faq',
    type: 'knowledge',
    description: 'Sık sorulan sorular — FAQPage schema markup ile yapılandırılmış.',
    url: 'https://www.sphereenglish.com/home#sss',
    category: 'support',
    tags: ['faq', 'schema-org', 'support'],
  },
];

export function GET() {
  const skills = skillsData.map((s) => ({
    ...s,
    sha256: sha256(`${s.name}|${s.url}|${s.description}`),
  }));

  const index = {
    $schema: 'https://agentskills.io/schemas/v0.2.0/index.json',
    version: '0.2.0',
    publisher: {
      name: 'Sphere English',
      url: 'https://www.sphereenglish.com',
      contact: 'info@sphereenglish.com',
    },
    generated: new Date().toISOString().slice(0, 10),
    skills,
  };

  return new Response(JSON.stringify(index, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
      Link: '<https://www.sphereenglish.com/.well-known/agent-skills/index.json>; rel="self"',
    },
  });
}

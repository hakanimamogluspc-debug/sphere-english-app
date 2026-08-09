import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Question {
  id: number;
  text: string;
  options: { A: string; B: string; C: string };
}

const QUESTIONS: Question[] = [
  { id: 1, text: 'My name ___ Richard Smith.', options: { A: 'is', B: 'are', C: 'am' } },
  { id: 2, text: "I'm from ___.", options: { A: 'Italy', B: 'Italian', C: 'the Italy' } },
  { id: 3, text: '___ company is Microsoft.', options: { A: 'She', B: "She's", C: 'Her' } },
  { id: 4, text: 'Person 1: ___ are you? Person 2: Very well, thanks.', options: { A: 'What', B: 'Who', C: 'How' } },
  { id: 5, text: 'BMW ___ cars.', options: { A: 'produces', B: 'provides', C: 'employs' } },
  { id: 6, text: 'We ___ three factories.', options: { A: 'has', B: 'have', C: 'are' } },
  { id: 7, text: "Person 1: Do you work for an English company? Person 2: No, I ___. It's French.", options: { A: 'do', B: "doesn't", C: "don't" } },
  { id: 8, text: 'Person 1: ___ you spell that, please? Person 2: Sure. It\'s A-L-A-N.', options: { A: 'Can', B: 'Do', C: 'Are' } },
  { id: 9, text: 'There ___ four international airports near London.', options: { A: 'is', B: 'are', C: 'have' } },
  { id: 10, text: 'A: ___ you like a coffee? B: Yes, please.', options: { A: 'Do', B: 'Could', C: 'Would' } },
  { id: 11, text: 'I deal ___ customers every day.', options: { A: 'for', B: 'in', C: 'with' } },
  { id: 12, text: 'Can we ___ a meeting?', options: { A: 'available', B: 'appoint', C: 'arrange' } },
  { id: 13, text: "Our products are ___ than our main competitor's.", options: { A: 'cheap', B: 'cheaper', C: 'cheapest' } },
  { id: 14, text: 'We need to ___ a solution to this problem.', options: { A: 'attend', B: 'make', C: 'find' } },
  { id: 15, text: 'What ___ on at the moment?', options: { A: 'are you working', B: 'do you work', C: 'did you work' } },
  { id: 16, text: 'How do you ___ about that idea?', options: { A: 'think', B: 'agree', C: 'feel' } },
  { id: 17, text: 'The plane leaves from ___ eighteen.', options: { A: 'seat', B: 'platform', C: 'gate' } },
  { id: 18, text: 'I have a ___ schedule this week.', options: { A: 'busy', B: 'fast', C: 'time' } },
  { id: 19, text: "She's ___ you an email.", options: { A: 'sent', B: 'send', C: 'sended' } },
  { id: 20, text: "I'm ___, but she's not here today.", options: { A: 'sorry', B: 'afraid', C: 'apologize' } },
  { id: 21, text: 'When ___ the company?', options: { A: 'joined you', B: 'did you join', C: 'did you joined' } },
  { id: 22, text: 'Can I ___ an order for 30 chairs?', options: { A: 'place', B: 'buy', C: 'quote' } },
  { id: 23, text: 'First of all, I ___ you a little bit about me.', options: { A: 'tell', B: "'m going to tell", C: "'m telling" } },
  { id: 24, text: 'English ___ all over the world.', options: { A: 'speaks', B: 'has spoken', C: 'is spoken' } },
  { id: 25, text: 'Did you ___ the deadline?', options: { A: 'get', B: 'reach', C: 'meet' } },
  { id: 26, text: 'I ___ him here recently.', options: { A: "didn't see", B: "haven't seen", C: "don't see" } },
  { id: 27, text: 'The new system ___ me focus on more important jobs.', options: { A: 'lets', B: 'allows', C: 'gets' } },
  { id: 28, text: "This website isn't as easy to use ___ the other one.", options: { A: 'as', B: 'than', C: 'more' } },
  { id: 29, text: "I'll call you back as soon as I ___ something.", options: { A: "'m hearing", B: "'ll hear", C: 'hear' } },
  { id: 30, text: "You ___ press this button. It's dangerous.", options: { A: "mustn't", B: "don't have to", C: "needn't" } },
  { id: 31, text: "Your visitor ___ for over an hour. He's in your room now.", options: { A: 'is waiting', B: 'has waited', C: 'has been waiting' } },
  { id: 32, text: 'The two companies plan to form a joint ___.', options: { A: 'venture', B: 'alliance', C: 'forces' } },
  { id: 33, text: 'If we changed the colour, we ___ more.', options: { A: 'sell', B: "'ll sell", C: "'d sell" } },
  { id: 34, text: 'When they have finished making the first ___, we can do some tests on it.', options: { A: 'breakthrough', B: 'prototype', C: 'invention' } },
  { id: 35, text: 'He ___ to leave the company by his boss.', options: { A: "'s been asked", B: "'s asked", C: 'asked' } },
  { id: 36, text: "I'm surprised he's late. He's normally so ___.", options: { A: 'hard-working', B: 'patient', C: 'punctual' } },
  { id: 37, text: 'Hello, Alison. I ___ the office actually. Can I call you back tomorrow?', options: { A: 'left', B: "'d just left", C: 'was just leaving' } },
  { id: 38, text: '___ the delays with the trains, we all still arrived on time.', options: { A: 'Although', B: 'Even though', C: 'Despite' } },
  { id: 39, text: 'My favourite perk in my job is ___.', options: { A: 'my salary', B: 'my company car', C: 'the overtime' } },
  { id: 40, text: 'James is away, ___?', options: { A: "isn't he", B: "doesn't he", C: 'is he' } },
  { id: 41, text: 'I seem to have run ___ of money. Can you lend me some?', options: { A: 'out', B: 'low', C: 'ahead' } },
  { id: 42, text: "If you don't like this idea, then come ___ with something better.", options: { A: 'across', B: 'in', C: 'up' } },
  { id: 43, text: '___ speak to them about our idea earlier today?', options: { A: 'Were you able to', B: 'Did you succeed in', C: 'Did you manage' } },
  { id: 44, text: 'Our most ___ customer has been with us for over 25 years.', options: { A: 'loyal', B: 'courteous', C: 'attentive' } },
  { id: 45, text: 'Do you know what time ___?', options: { A: 'is it', B: 'it is', C: 'does it' } },
  { id: 46, text: "Let's ___ up a list of action points.", options: { A: 'take', B: 'draw', C: 'set' } },
  { id: 47, text: 'We have very ___ information about you. Tell us about yourself.', options: { A: 'little', B: 'few', C: 'plenty' } },
  { id: 48, text: "We've looked at the history, so now let's ___ to our current activities.", options: { A: 'turn on', B: 'notice', C: 'move on' } },
  { id: 49, text: 'Many women feel that they hit a glass ___ on the corporate ladder.', options: { A: 'roof', B: 'attic', C: 'ceiling' } },
  { id: 50, text: 'Today, we need to ___ on a date for the launch and promotion.', options: { A: 'discuss', B: 'meet', C: 'decide' } },
  { id: 51, text: 'What they are asking is ___ ridiculous.', options: { A: 'very', B: 'absolutely', C: 'such' } },
  { id: 52, text: "There's a real ___ in the market for this kind of service, I think.", options: { A: 'gap', B: 'break', C: 'miss' } },
  { id: 53, text: 'Shirley is very calm and down to ___.', options: { A: 'key', B: 'world', C: 'earth' } },
  { id: 54, text: 'The pros definitely ___ the cons.', options: { A: 'outcome', B: 'outweigh', C: 'outlook' } },
  { id: 55, text: 'I think you should broaden your ___ and look for a new job.', options: { A: 'horizons', B: 'views', C: 'positions' } },
  { id: 56, text: "If you ___ I'm sure you would have got the job.", options: { A: 'applied', B: 'would apply', C: 'had applied' } },
  { id: 57, text: 'Am I getting my point ___ clearly enough?', options: { A: 'along', B: 'across', C: 'around' } },
  { id: 58, text: "There isn't a ___ of purpose to the meeting.", options: { A: 'feel', B: 'sense', C: 'reason' } },
  { id: 59, text: 'Let me ___ you in on some of the background.', options: { A: 'fill', B: 'pack', C: 'add' } },
  { id: 60, text: 'It\'s difficult to ___ what the reaction might be to this proposal.', options: { A: 'weigh', B: 'gauge', C: 'measure' } },
];

const LEVEL_DETAILS: Record<string, {
  label: string;
  sublabel: string;
  color: string;
  bgGradient: string;
  badgeColor: string;
  icon: string;
  summary: string;
  canDo: string[];
  willLearn: string[];
  topics: string[];
}> = {
  A1: {
    label: 'A1',
    sublabel: 'Başlangıç Seviyesi',
    color: 'text-slate-700',
    bgGradient: 'from-slate-50 to-slate-100',
    badgeColor: 'bg-slate-600',
    icon: '🌱',
    summary: 'İngilizce yolculuğunuzun başındaki bu seviyede, sıfırdan sağlam bir temel inşa edeceksiniz. Anadil konuşanlarının bile takdir ettiği net bir başlangıç noktanız var.',
    canDo: [
      'Kendinizi ve başkalarını tanıtabilirsiniz',
      'Günlük sorulara basit cevaplar verebilirsiniz',
      'Temel sayıları, tarihleri ve günlük ifadeleri kullanabilirsiniz',
      'Çok yavaş konuşulduğunda anlaşılır kelimeler ayırt edebilirsiniz',
    ],
    willLearn: [
      'To be, have got ve temel fiil yapıları',
      'Alfabe, selamlaşma ve kendini tanıtma',
      'Sayılar, renkler, günler ve aylar',
      'Günlük rutin ve iş yeri kelimesi',
      'Basit soru cümleleri ve olumlu/olumsuz yapılar',
    ],
    topics: ['Tanışma & Selamlama', 'Şirket ve Ülkeler', 'Günlük Rutin', 'Sayılar & Tarihler', 'Temel Kelime Hazinesi'],
  },
  A2: {
    label: 'A2',
    sublabel: 'Temel Seviye',
    color: 'text-blue-700',
    bgGradient: 'from-blue-50 to-blue-100',
    badgeColor: 'bg-blue-600',
    icon: '📘',
    summary: 'Temelleri kavramış durumdaki bu seviyede artık basit iş ve günlük konuşmalarda kendinizi ifade edebilirsiniz. Biraz pratikle çok hızlı ilerleme kaydedeceksiniz.',
    canDo: [
      'Alışveriş, yol tarifi gibi günlük görevleri yerine getirebilirsiniz',
      'Kendinizden ve çevrenizden kısaca bahsedebilirsiniz',
      'Sık kullanılan kalıpları ve ifadeleri anlayabilirsiniz',
      'Basit iş e-postaları ve mesajlar yazabilirsiniz',
    ],
    willLearn: [
      'Geçmiş zaman (Simple Past) yapısı',
      'Karşılaştırma sıfatları ve zarfları',
      'Telefon konuşmaları ve e-posta yazımı',
      'Seyahat ve iş seyahati dili',
      'Ürün ve hizmet tanımlamaları',
    ],
    topics: ['İş E-postaları', 'Seyahat & Rezervasyon', 'Ürün Tanıtımı', 'Toplantı Dili', 'Geçmiş Zaman'],
  },
  B1: {
    label: 'B1',
    sublabel: 'Orta Seviye',
    color: 'text-green-700',
    bgGradient: 'from-green-50 to-green-100',
    badgeColor: 'bg-green-600',
    icon: '💼',
    summary: 'Uluslararası dil çerçevesinin tam ortasındaki B1, iş dünyasında en çok aranan seviyelerden biridir. Bildiğiniz konularda akıcı biçimde konuşabilir ve yazabilirsiniz.',
    canDo: [
      'İş toplantılarında ve sunumlarda aktif rol alabilirsiniz',
      'Karmaşık olmayan metinlerin ana fikrini anlayabilirsiniz',
      'Deneyim ve planlarınız hakkında açıklama yapabilirsiniz',
      'Profesyonel raporlar ve yazışmalar üretebilirsiniz',
    ],
    willLearn: [
      'Present Perfect ve geçmiş zaman kullanımı karşılaştırması',
      'Modal yapılar (should, must, have to)',
      'Sunum ve konuşma teknikleri',
      'Müzakere ve ikna dili',
      'İş raporları ve teklifler',
    ],
    topics: ['Sunum & Brifing', 'Müzakere', 'Problem Çözme', 'Şirket Kültürü', 'Raporlama'],
  },
  B2: {
    label: 'B2',
    sublabel: 'Orta Üstü Seviye',
    color: 'text-amber-700',
    bgGradient: 'from-amber-50 to-amber-100',
    badgeColor: 'bg-amber-600',
    icon: '🚀',
    summary: 'Bu seviye, profesyonel hayatta uluslararası ortamlarda rahatlıkla iletişim kurabildiğinizi gösterir. Karmaşık konuları anlıyor ve çeşitli bakış açılarını tartışabiliyorsunuz.',
    canDo: [
      'Teknik ve iş konularındaki uzun metinleri anlayabilirsiniz',
      'Üst düzey toplantılar ve müzakerelere katılabilirsiniz',
      'Dezavantajlar/avantajlar sunup karşı argümanlara yanıt verebilirsiniz',
      'Anadil konuşanlarıyla akıcı biçimde iletişim kurabilirsiniz',
    ],
    willLearn: [
      'İleri düzey koşul cümleleri (If I had... / Unless...)',
      'Pasif yapılar ve dolaylı anlatım',
      'Kurumsal strateji ve finans dili',
      'Çapraz kültür iletişimi',
      'Liderlik ve yönetim dili',
    ],
    topics: ['Strateji & Finans', 'Liderlik Dili', 'Uluslararası Pazarlama', 'Kriz Yönetimi', 'İleri Yazışma'],
  },
  C1: {
    label: 'C1',
    sublabel: 'İleri Seviye',
    color: 'text-purple-700',
    bgGradient: 'from-purple-50 to-purple-100',
    badgeColor: 'bg-purple-600',
    icon: '🏆',
    summary: 'Tebrikler! İngilizce yetkinliğiniz üst düzeyde. Dili esnek ve etkili biçimde kullanabiliyor, nüanslı ifadeler içeren metinleri anlıyor ve karmaşık konularda akıcı konuşabiliyorsunuz.',
    canDo: [
      'Uzun ve karmaşık metinleri kolaylıkla anlayabilirsiniz',
      'Hazırlıksız, spontane konuşmalar yapabilirsiniz',
      'Sosyal, akademik ve profesyonel ortamlarda etkili İngilizce kullanabilirsiniz',
      'İnce anlam farklarını yakalayabilir ve doğal deyimler kullanabilirsiniz',
    ],
    willLearn: [
      'İleri düzey iş yazısı ve akademik İngilizce',
      'Müzakere ve etkileme stratejileri',
      'Konuşma akıcılığı ve doğallığı geliştirme',
      'Medya ve sunum becerileri',
      'Kültürel zeka ve uluslararası iletişim',
    ],
    topics: ['Akademik Yazı', 'Etkileme Stratejileri', 'Medya & PR', 'Üst Düzey Sunum', 'Uluslararası Diplomasi'],
  },
};

const QUESTIONS_PER_PAGE = 10;

// localStorage key — refresh sonrası progress restore için
const PROGRESS_KEY = "sphere_placement_test_progress_v1";

interface SavedProgress {
  answers: Record<number, string>;
  currentPage: number;
  savedAt: string;
  // 24 saatten eski progress'ler silinir (eski test denemesi olabilir)
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (!parsed.answers || typeof parsed.currentPage !== "number") return null;
    // 24 saat süresinden eskiyse temizle
    const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PROGRESS_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
}

export default function PlacementTest() {
  // İlk render'da localStorage'tan restore — yoksa boş state
  const initial = typeof window !== "undefined" ? loadProgress() : null;
  const [answers, setAnswers] = useState<Record<number, string>>(initial?.answers ?? {});
  const [currentPage, setCurrentPage] = useState(initial?.currentPage ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    level: string;
    wrong?: Array<{ id: number; question: string; userAnswer: string; userAnswerText: string; correctAnswer: string; correctAnswerText: string }>;
    total?: number;
  } | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Her cevap veya sayfa değişiminde localStorage'a yaz (autosave)
  useEffect(() => {
    if (result) return; // Test bittiyse kaydetme
    if (Object.keys(answers).length === 0 && currentPage === 0) return; // Hiç başlanmadıysa atla
    try {
      const payload: SavedProgress = {
        answers,
        currentPage,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload));
    } catch {
      // localStorage dolmuş olabilir, sessizce yut
    }
  }, [answers, currentPage, result]);

  const totalPages = Math.ceil(QUESTIONS.length / QUESTIONS_PER_PAGE);
  const pageQuestions = QUESTIONS.slice(currentPage * QUESTIONS_PER_PAGE, (currentPage + 1) * QUESTIONS_PER_PAGE);
  const answeredOnPage = pageQuestions.filter(q => answers[q.id]).length;
  const allAnsweredOnPage = answeredOnPage === pageQuestions.length;
  const totalAnswered = Object.keys(answers).length;
  const allAnswered = totalAnswered === QUESTIONS.length;
  const progress = (totalAnswered / QUESTIONS.length) * 100;

  const handleSelect = (questionId: number, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem("sphere_token");
      const res = await fetch("/api/placement-test/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answers, questions: QUESTIONS }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gönderim sırasında hata oluştu");
      }
      const data = await res.json();
      setResult({ score: data.score, level: data.level, wrong: data.wrong, total: data.total });
      // Başarılı submit sonrası kaydedilmiş progress'i temizle
      clearProgress();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const info = LEVEL_DETAILS[result.level] ?? LEVEL_DETAILS.B1;
    const percentage = Math.round((result.score / 60) * 100);

    const handleGoToApp = async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/dashboard");
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f2248] via-[#1e3a6e] to-[#0ea5e9]/20 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Congrats banner */}
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-5xl mb-3">{info.icon}</div>
            <h1 className="text-3xl font-extrabold text-[#1e3a6e] mb-1">Tebrikler!</h1>
            <p className="text-slate-500 text-base">Oxford Business Result Seviye Belirleme Testi tamamlandı.</p>
          </div>

          {/* Level card */}
          <div className={cn("rounded-2xl shadow-xl p-8 bg-gradient-to-br", info.bgGradient)}>
            <div className="flex items-center gap-5 mb-5">
              <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-md flex-shrink-0", info.badgeColor)}>
                {info.label}
              </div>
              <div>
                <div className={cn("text-2xl font-bold", info.color)}>{info.sublabel}</div>
                <div className="text-slate-500 text-sm mt-0.5">Belirlenen seviyeniz</div>
              </div>
            </div>
            <p className={cn("text-sm leading-relaxed", info.color)}>{info.summary}</p>
          </div>

          {/* Score */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Test Puanınız</h2>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-5xl font-extrabold text-[#1e3a6e]">{result.score}</span>
              <span className="text-slate-400 text-lg mb-1">/ 60 doğru · %{percentage}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-[#1e3a6e] to-[#0ea5e9] transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>0</span>
              <span>12 (A1)</span>
              <span>26 (A2)</span>
              <span>40 (B1)</span>
              <span>54 (B2)</span>
              <span>60 (C1)</span>
            </div>
          </div>

          {/* Can do */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Bu Seviyede Neler Yapabilirsiniz?</h2>
            <ul className="space-y-2">
              {info.canDo.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="text-[#0ea5e9] font-bold text-base leading-5 flex-shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Will learn */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Sphere English'te Neler Öğreneceksiniz?</h2>
            <ul className="space-y-2">
              {info.willLearn.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="text-[#1e3a6e] font-bold flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Topics */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Konu Başlıkları</h2>
            <div className="flex flex-wrap gap-2">
              {info.topics.map((topic, i) => (
                <span key={i} className="bg-[#1e3a6e]/8 text-[#1e3a6e] text-xs font-medium px-3 py-1.5 rounded-full border border-[#1e3a6e]/15">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          {/* Yanlış Cevaplar Review */}
          {result.wrong && result.wrong.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Yanlış Cevapların</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {result.wrong.length} soruda yanıldın — hepsi kişisel hata defterine eklendi
                  </p>
                </div>
                <Button
                  onClick={() => setShowReview(v => !v)}
                  variant="outline"
                  className="text-sm"
                >
                  {showReview ? "Gizle" : "Cevapları Gör"}
                </Button>
              </div>
              {showReview && (
                <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                  {result.wrong.map((w) => (
                    <div key={w.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <div className="text-xs text-slate-400 mb-1">Soru {w.id}</div>
                      <div className="text-sm text-slate-800 mb-3 font-medium">{w.question}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                          <div className="text-[10px] text-red-600 font-bold uppercase tracking-wide mb-1">Senin cevabın</div>
                          <div className="text-red-900 font-medium line-through decoration-red-300">{w.userAnswerText}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                          <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wide mb-1">Doğrusu</div>
                          <div className="text-emerald-900 font-bold">{w.correctAnswerText}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-4 italic">
                Bu hatalar "Raporum" sayfasında haftalık olarak sana özet olarak sunulacak.
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <p className="text-slate-500 text-sm mb-5">
              Seviyeniz kayıt altına alındı. Artık Sphere English platformuna giriş yaparak öğrenmeye başlayabilirsiniz.
            </p>
            <Button
              onClick={handleGoToApp}
              className="w-full bg-[#1e3a6e] hover:bg-[#0ea5e9] text-white font-bold py-4 rounded-xl text-base transition-colors shadow-lg"
            >
              Uygulamaya Geç →
            </Button>
            <p className="text-xs text-slate-400 mt-3">Seviyeniz: <strong>{info.label} – {info.sublabel}</strong></p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2248] via-[#1e3a6e] to-[#0ea5e9]/20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1e3a6e]/95 backdrop-blur border-b border-white/10 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <img src="/sphere-logo.svg" alt="Sphere English" className="h-7 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h1 className="text-white font-bold text-base leading-tight">Seviye Belirleme Testi</h1>
                <p className="text-[#0ea5e9] text-xs">Oxford Business Result</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white text-sm font-semibold">{totalAnswered} / {QUESTIONS.length}</div>
              <div className="text-slate-300 text-xs">cevaplandı</div>
            </div>
          </div>
          <Progress value={progress} className="h-2 bg-white/20" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Restored progress notice — sadece localStorage'tan yüklenmişse */}
        {initial && totalAnswered > 0 && !result && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-3 text-emerald-200 text-xs flex items-center gap-2">
            <span>✓</span>
            <span>
              Kaldığın yerden devam ediyorsun — <strong>{totalAnswered}</strong> soru daha önce yanıtlanmıştı.
            </span>
          </div>
        )}

        {/* Info box — top */}
        <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-5 text-white/60 text-xs leading-relaxed">
          <p className="font-semibold text-white/80 mb-1">ℹ️ Bu test hakkında</p>
          <p>Bu test, Oxford University Press tarafından hazırlanmış Oxford Business Result Seviye Belirleme Testidir. 60 çoktan seçmeli sorudan oluşmaktadır. Sonuçlarınıza göre A1, A2, B1, B2 veya C1 seviyesine atanacaksınız. Test tamamlandıktan sonra seviyeniz değiştirilemez.</p>
          <p className="mt-2 text-white/50">İlerlemen otomatik kaydedilir; sayfayı yenilesen bile kaldığın yerden devam edebilirsin.</p>
        </div>

        {/* Page indicator */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-white/70 text-sm">Bölüm {currentPage + 1} / {totalPages}</span>
          <span className="text-white/70 text-sm">Sorular {currentPage * QUESTIONS_PER_PAGE + 1}–{Math.min((currentPage + 1) * QUESTIONS_PER_PAGE, QUESTIONS.length)}</span>
        </div>

        {/* Questions */}
        <div className="space-y-5">
          {pageQuestions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-[#1e3a6e] px-5 py-3 flex items-start gap-3">
                <span className="bg-[#0ea5e9] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">{q.id}</span>
                <p className="text-white text-sm leading-relaxed">{q.text}</p>
              </div>
              <div className="p-4 space-y-2">
                {(["A", "B", "C"] as const).map((opt) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelect(q.id, opt)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all text-sm",
                        selected
                          ? "border-[#0ea5e9] bg-[#0ea5e9]/10 text-[#1e3a6e] font-semibold"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <span className={cn(
                        "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
                        selected
                          ? "border-[#0ea5e9] bg-[#0ea5e9] text-white"
                          : "border-slate-300 text-slate-500"
                      )}>
                        {opt}
                      </span>
                      <span>{q.options[opt]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentPage === 0}
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 disabled:opacity-40"
          >
            ← Önceki
          </Button>

          {currentPage < totalPages - 1 ? (
            <div className="flex-1 text-center">
              {!allAnsweredOnPage && (
                <p className="text-amber-300 text-xs mb-2">Bu sayfadaki tüm soruları yanıtlayın ({pageQuestions.length - answeredOnPage} eksik)</p>
              )}
              <Button
                onClick={handleNext}
                disabled={!allAnsweredOnPage}
                className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-semibold px-8 disabled:opacity-50"
              >
                Sonraki Bölüm →
              </Button>
            </div>
          ) : (
            <div className="flex-1 text-center">
              {!allAnswered && (
                <p className="text-amber-300 text-xs mb-2">{QUESTIONS.length - totalAnswered} soru henüz yanıtlanmadı</p>
              )}
              {error && (
                <p className="text-red-300 text-xs mb-2">{error}</p>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold px-10 py-3 text-base rounded-xl disabled:opacity-50"
              >
                {submitting ? "Hesaplanıyor..." : "Testi Tamamla ✓"}
              </Button>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-5 text-white/60 text-xs leading-relaxed">
          <p className="font-semibold text-white/80 mb-1">ℹ️ Bu test hakkında</p>
          <p>Bu test, Oxford University Press tarafından hazırlanmış Oxford Business Result Seviye Belirleme Testidir. 60 çoktan seçmeli sorudan oluşmaktadır. Sonuçlarınıza göre A1, A2, B1, B2 veya C1 seviyesine atanacaksınız. Test tamamlandıktan sonra seviyeniz değiştirilemez.</p>
        </div>
      </div>
    </div>
  );
}

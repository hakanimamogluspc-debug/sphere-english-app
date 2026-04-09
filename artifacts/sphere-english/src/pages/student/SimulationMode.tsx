import { useState, useRef, useEffect } from "react";

const NAVY = "#082567";
const SILVER = "#8da4c8";
const SILVER_LIGHT = "#f4f6fb";
const SILVER_MID = "#dce4f0";

const SECTORS = [
  { id: 'finans', label: 'Finans', desc: 'Bankacılık, yatırım, sigortacılık' },
  { id: 'teknoloji', label: 'Teknoloji', desc: 'Yazılım, AI, dijital ürünler' },
  { id: 'saglik', label: 'Sağlık', desc: 'Sağlık hizmetleri, ilaç, medikal cihaz' },
  { id: 'uretim', label: 'Üretim', desc: 'İmalat, fabrika, endüstri' },
  { id: 'perakende', label: 'Perakende', desc: 'E-ticaret, mağazacılık, satış' },
  { id: 'lojistik', label: 'Lojistik', desc: 'Tedarik zinciri, kargo, depo' },
  { id: 'insaat', label: 'İnşaat', desc: 'Gayrimenkul, altyapı, mühendislik' },
  { id: 'egitim', label: 'Eğitim', desc: 'Akademi, kurumsal eğitim, EdTech' },
  { id: 'turizm', label: 'Turizm', desc: 'Otelcilik, seyahat, sağlık turizmi' },
  { id: 'danismanlik', label: 'Danışmanlık', desc: 'Strateji, yönetim, süreç iyileştirme' },
  { id: 'hukuk', label: 'Hukuk', desc: 'Hukuk büroları, uyum, sözleşme' },
  { id: 'medya', label: 'Medya', desc: 'Yayıncılık, reklam, içerik üretimi' },
  { id: 'enerji', label: 'Enerji', desc: 'Yenilenebilir enerji, petrol & gaz' },
  { id: 'diger', label: 'Diğer', desc: 'Diğer sektörler' },
];

const COACHES = [
  { id: 'sterling', name: 'Mr. Sterling', flag: '🇬🇧', specialty: 'CEO & Stratejik Yönetim', accent: 'Üst Segment İngiliz (RP)', color: '#1E3A5F', style: 'Otoriter, lakonik, vizyon odaklı', image: 'coach-sterling.png', initials: 'MS', voice: 'onyx', systemPrompt: `You are Mr. Sterling, a 57-year-old British executive from London. Refined RP accent, impeccably dressed. 30 years in boardrooms of global firms. Authoritative, precise, dry wit. You speak very concisely — every word counts.` },
  { id: 'jake', name: 'Jake', flag: '🇺🇸', specialty: 'Pazarlama & Dijital Medya', accent: 'West Coast Amerikan', color: '#EA580C', style: 'Enerjik, yaratıcı, trendy', image: 'coach-jake.png', initials: 'J', voice: 'echo', systemPrompt: `You are Jake, a 30-year-old San Francisco marketing guy. Laid-back, upbeat, West Coast accent. You work in digital marketing at a startup. Energetic, casual, always pitching ideas.` },
  { id: 'david', name: 'David', flag: '🇺🇸', specialty: 'Finans & Yatırım', accent: 'New York (Wall Street)', color: '#0369A1', style: 'Analitik, direkt, rakam odaklı', image: 'coach-david.png', initials: 'D', voice: 'echo', systemPrompt: `You are David, a 43-year-old New Yorker from Wall Street. Intense, sharp, data-driven. You think in numbers and risk. Direct, no-nonsense New York style.` },
  { id: 'emma', name: 'Emma', flag: '🇬🇧', specialty: 'İnsan Kaynakları', accent: 'Standart İngiliz (London)', color: '#BE185D', style: 'Empatik, yapılandırılmış, destekleyici', image: 'coach-emma-hr.png', initials: 'E', voice: 'shimmer', systemPrompt: `You are Emma, a 37-year-old London HR professional. Warm, empathetic, structured. You believe in clear communication and constructive feedback. Standard British accent.` },
  { id: 'raj', name: 'Raj', flag: '🇮🇳', specialty: 'BT & Yazılım Geliştirme', accent: 'Hint-İngiliz (Global Tech)', color: '#7C3AED', style: 'Sistematik, teknik, iş birlikçi', image: 'coach-raj.png', initials: 'R', voice: 'echo', systemPrompt: `You are Raj, a 32-year-old software engineer from Bangalore, now working in London. Warm, slightly nerdy, collaborative. Indian-English accent. You love explaining technical things clearly.` },
  { id: 'hans', name: 'Hans', flag: '🇩🇪', specialty: 'Lojistik & Operasyon', accent: 'Alman-İngiliz (Euro-English)', color: '#374151', style: 'Metodolojik, hassas, süreç odaklı', image: 'coach-hans.png', initials: 'H', voice: 'onyx', systemPrompt: `You are Hans, a 47-year-old German from Hamburg in logistics. Precise, methodical, reliable. German-English accent. You think in processes and timelines. Very structured.` },
  { id: 'elena', name: 'Elena', flag: '🇪🇺', specialty: 'Uluslararası Hukuk', accent: 'Diplomatik (Doğu Avrupa)', color: '#065F46', style: 'Kesin, diplomatik, mükemmeliyetçi', image: 'coach-elena.png', initials: 'EL', voice: 'nova', systemPrompt: `You are Elena, a 44-year-old international lawyer from Prague, based in Brussels. Composed, precise, diplomatically careful. Eastern European-English accent. Every word is deliberate.` },
  { id: 'alistair', name: 'Alistair', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', specialty: 'Satış & Müzakere', accent: 'İskoç (Edinburg)', color: '#B91C1C', style: 'İkna edici, stratejik, ısrarcı', image: 'coach-alistair.png', initials: 'A', voice: 'echo', systemPrompt: `You are Alistair, a 40-year-old Scotsman from Edinburgh in sales. Charismatic, persuasive, strategic. Scottish accent. You can find common ground with anyone and close any deal.` },
  { id: 'chloe', name: 'Chloe', flag: '🇦🇺', specialty: 'Müşteri İlişkileri', accent: 'Avusturalyalı (Friendly)', color: '#D97706', style: 'Sıcak, samimi, çözüm odaklı', image: 'coach-chloe.png', initials: 'C', voice: 'shimmer', systemPrompt: `You are Chloe, a 28-year-old Australian customer success manager. Warm, friendly, solution-focused. Australian accent. You genuinely care about making people happy.` },
  { id: 'james', name: 'James', flag: '🇺🇸', specialty: 'Üretim & Fabrika Yönetimi', accent: 'Amerikan (Midwest)', color: '#78350F', style: 'Pratik, güvenilir, direkt', image: 'coach-james-mfg.png', initials: 'JA', voice: 'onyx', systemPrompt: `You are James, a 45-year-old factory operations manager from Ohio. Practical, direct, no-frills. Midwest American accent. You value efficiency and clear, actionable communication.` },
  { id: 'claire', name: 'Dr. Claire', flag: '🇬🇧', specialty: 'Gramer & İleri Telaffuz', accent: 'Akademik İngiliz (Oxford)', color: '#0F766E', style: 'Titiz, sabırlı, akademik', image: 'coach-claire-grammar.png', initials: 'DC', voice: 'nova', systemPrompt: `You are Dr. Claire, a 50-year-old Oxford linguistics professor. Precise, patient, academic. You notice language nuances others miss and communicate with elegant clarity.` },
  { id: 'olivia', name: 'Dr. Olivia', flag: '🇺🇸', specialty: 'Sağlık Turizmi İngilizcesi', accent: 'Amerikan (Miami / Sağlık Turizmi)', color: '#0891b2', style: 'Profesyonel, kültürel farkındalıklı, sıcak', image: 'coach-olivia-health.png', initials: 'DO', voice: 'nova', systemPrompt: `You are Dr. Olivia, a 38-year-old health tourism coordinator based in Miami. Professional, culturally aware, warm. You bridge medical and hospitality worlds for international patients.` },
];

const SECTOR_COACHES: Record<string, string[]> = {
  finans: ['david', 'sterling', 'elena'],
  teknoloji: ['raj', 'jake', 'sterling'],
  saglik: ['olivia', 'emma', 'claire'],
  uretim: ['james', 'hans', 'sterling'],
  perakende: ['chloe', 'jake', 'alistair'],
  lojistik: ['hans', 'james', 'sterling'],
  insaat: ['james', 'hans', 'sterling'],
  egitim: ['claire', 'emma', 'raj'],
  turizm: ['olivia', 'chloe', 'alistair'],
  danismanlik: ['sterling', 'emma', 'david'],
  hukuk: ['elena', 'sterling', 'emma'],
  medya: ['jake', 'chloe', 'alistair'],
  enerji: ['hans', 'sterling', 'david'],
  diger: ['sterling', 'emma', 'raj'],
};

const SCENARIO_MAP: Record<string, Record<string, string[]>> = {
  finans: {
    default: ['Yatırımcı sunumu: seri A fon turu', 'Bütçe revizyon toplantısı: CFO ile', 'Döviz riski yönetimi müzakeresi', 'Uluslararası muhabir banka görüşmesi', 'Yıllık raporun yabancı ortaklara sunumu'],
  },
  teknoloji: {
    default: ['Teknoloji tedarikçisi RFP toplantısı', 'Dijital dönüşüm danışmanlık toplantısı', 'SLA müzakeresi bulut sağlayıcısıyla', 'Otomasyon projesi fizibilite sunumu', 'Teknik destek eskalasyon görüşmesi'],
  },
  saglik: {
    default: ['Uluslararası hasta tedavi paketi görüşmesi', 'Sigorta şirketi ile teminat anlaşması', 'JCI akreditasyon denetçisi görüşmesi', 'Medikal turist karşılama ve briefing', 'Sağlık turizmi fuarı B2B toplantısı'],
  },
  uretim: {
    default: ['Tedarikçi denetim toplantısı (supplier audit)', 'Kalite güvence sistemi görüşmesi', 'Fabrika tur ve teknik brifing', 'İş güvenliği protokolü eğitimi', 'Üretim kapasitesi müzakeresi'],
  },
  perakende: {
    default: ['E-ticaret platform ortaklık toplantısı', 'Franchise anlaşması müzakeresi', 'Yabancı tedarikçiyle ürün görüşmesi', 'Mağaza açılış briefing', 'Lojistik partner seçim görüşmesi'],
  },
  lojistik: {
    default: ['Gümrük uyum süreçleri toplantısı', 'Depolama ve dağıtım sözleşmesi', 'Nakliye güzergahı optimizasyon görüşmesi', 'Tedarik zinciri kesintisi kriz yönetimi', 'Liman operasyonları koordinasyon'],
  },
  turizm: {
    default: ['Yabancı tur operatörüyle B2B anlaşma', 'Otel kapasitesi ve fiyatlandırma görüşmesi', 'Uluslararası kongre organizasyonu toplantısı', 'Sağlık turizmi paketi satış görüşmesi', 'Vize danışmanlık briefing'],
  },
  danismanlik: {
    default: ['Stratejik dönüşüm proje kick-off', 'Süreç iyileştirme workshop facilitasyonu', 'Kurumsal yeniden yapılanma toplantısı', 'Yönetim danışmanlığı teklif sunumu', 'Performans yönetimi sistemi görüşmesi'],
  },
  hukuk: {
    default: ['Uluslararası sözleşme müzakeresi', 'M&A due diligence görüşmesi', 'GDPR uyum danışmanlığı', 'Tahkim ön toplantısı', 'Fikri mülkiyet lisans anlaşması'],
  },
  default: {
    default: ['Uluslararası müşteri görüşmesi', 'Stratejik ortaklık sunumu', 'Ürün/hizmet tanıtımı', 'Bütçe ve fiyatlama müzakeresi', 'Proje kick-off toplantısı'],
  },
};

function getScenarios(sectorId: string): string[] {
  const sectorMap = SCENARIO_MAP[sectorId] || SCENARIO_MAP.default;
  return sectorMap.default || SCENARIO_MAP.default.default;
}

interface TurnAnalysis {
  grammarErrors: { original: string; corrected: string; explanation: string }[];
  vocabSuggestions: { original: string; better: string; explanation: string }[];
  score: number;
  correctedText: string;
}
interface Message { role: 'user' | 'coach'; text: string; ts: string; turnAnalysis?: TurnAnalysis }
interface SimReport {
  duration: number;
  turnCount: number;
  avgScore: number;
  grammarErrors: TurnAnalysis['grammarErrors'];
  vocabSuggestions: TurnAnalysis['vocabSuggestions'];
}

const MIN_RECORD_MS = 2000;

function getApiBase(): string {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  return base.replace("/sphere-english", "/api-server");
}

function now() { return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

type Coach = typeof COACHES[0];
type Sector = typeof SECTORS[0];

function CoachAvatar({ coach, size = 40 }: { coach: Coach; size?: number }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return (
      <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{ width: size, height: size, background: coach.color, fontSize: size * 0.35 }}>
        {coach.initials}
      </div>
    );
  }
  return (
    <img
      src={`/images/${coach.image}`}
      alt={coach.name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
    />
  );
}

function SectorCard({ sector, onSelect }: { sector: Sector; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      className="w-full text-left p-5 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-98 group"
      style={{ background: '#fff', borderColor: SILVER_MID }}>
      <div className="font-bold text-sm mb-1 group-hover:text-blue-700 transition-colors" style={{ color: NAVY }}>{sector.label}</div>
      <div className="text-xs text-slate-400">{sector.desc}</div>
    </button>
  );
}

function CoachCard({ coach, featured, onSelect }: { coach: Coach; featured?: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      className="w-full text-left rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 group"
      style={{ background: '#fff', borderColor: featured ? coach.color : SILVER_MID, borderWidth: featured ? 2 : 1 }}>
      <div className="p-4 flex items-center gap-3" style={{ background: featured ? `${coach.color}0d` : 'transparent' }}>
        <CoachAvatar coach={coach} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm" style={{ color: NAVY }}>{coach.name}</span>
            <span>{coach.flag}</span>
            {featured && <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: coach.color }}>Uzman</span>}
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: coach.color }}>{coach.specialty}</div>
          <div className="text-xs text-slate-400 mt-0.5">{coach.accent}</div>
        </div>
      </div>
    </button>
  );
}

function MicButton({ phase, recordSecs }: { phase: string; recordSecs: number }) {
  const isRecording = phase === 'recording';
  const isSpeaking = phase === 'speaking';
  const isProcessing = phase === 'processing';
  const ringColor = isRecording ? '#ef4444' : isSpeaking ? '#0ea5e9' : NAVY;
  const label = isRecording
    ? `${recordSecs}sn — Durdurmak için tıkla`
    : isSpeaking ? 'Koç konuşuyor — Durdurmak için tıkla'
    : isProcessing ? 'İşleniyor...'
    : 'Konuşmak için tıkla';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: '#ef4444', animationDuration: '1s' }} />
        )}
        {isSpeaking && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: '#0ea5e9', animationDuration: '1.4s' }} />
        )}
        <button
          disabled={isProcessing}
          type="button"
          className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 disabled:opacity-50"
          style={{
            background: isRecording ? '#ef4444' : isSpeaking ? '#0ea5e9' : NAVY,
            border: `3px solid ${ringColor}`,
            boxShadow: `0 0 0 6px ${ringColor}22`,
          }}>
          {isProcessing ? (
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : isSpeaking ? (
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
              <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a4 4 0 014 4v6a4 4 0 01-8 0V6a4 4 0 014-4z" />
              <path d="M8 12a4 4 0 008 0" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 18v4M8 22h8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <span className="text-xs text-slate-500 font-medium text-center">{label}</span>
    </div>
  );
}

export default function SimulationMode() {
  const [step, setStep] = useState<'sector' | 'coach' | 'mode' | 'scenario-pick' | 'chat' | 'report'>('sector');
  const [sector, setSector] = useState<Sector | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [mode, setMode] = useState<'free' | 'scenario' | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);
  const [customScenario, setCustomScenario] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');
  const [recordSecs, setRecordSecs] = useState(0);
  const [error, setError] = useState('');
  const [sessionReport, setSessionReport] = useState<SimReport | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatStartTimeRef = useRef<number>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const playAudio = (base64: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPhase('speaking');
    audio.play().catch(() => {});
    audio.onended = () => { URL.revokeObjectURL(url); setPhase('idle'); };
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startTimer = () => {
    recordStartRef.current = Date.now();
    setRecordSecs(0);
    timerRef.current = setInterval(() => {
      setRecordSecs(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 200);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordSecs(0);
  };

  const sendAudio = async (blob: Blob) => {
    if (!coach || !sector) return;
    setPhase('processing');
    setError('');
    const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant' as const, content: m.text }));
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      formData.append('voice', coach.voice);
      formData.append('systemPrompt', coach.systemPrompt);
      formData.append('sector', sector.id);
      formData.append('history', JSON.stringify(history));
      const res = await fetch(`${getApiBase()}/api/simulation/chat`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Bir hata oluştu.');
      }
      const data = await res.json() as { userText: string; reply: string; audioBase64: string; turnAnalysis?: TurnAnalysis };
      const userMsg: Message = { role: 'user', text: data.userText, ts: now(), turnAnalysis: data.turnAnalysis };
      const coachMsg: Message = { role: 'coach', text: data.reply, ts: now() };
      setMessages(prev => [...prev, userMsg, coachMsg]);
      if (data.audioBase64) playAudio(data.audioBase64);
      else setPhase('idle');
    } catch (e: any) {
      setError(e?.message || 'Bir hata oluştu.');
      setPhase('idle');
    }
  };

  const handleMicPress = async () => {
    if (phase === 'speaking') { audioRef.current?.pause(); setPhase('idle'); return; }
    if (phase === 'recording') {
      if ((Date.now() - recordStartRef.current) < MIN_RECORD_MS) return;
      const mr = mediaRecorderRef.current;
      if (mr?.state === 'recording') {
        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
          stopStream(); stopTimer();
          sendAudio(blob);
        };
        mr.stop();
      } else { stopStream(); stopTimer(); setPhase('idle'); }
      mediaRecorderRef.current = null;
      return;
    }
    if (phase !== 'idle') return;
    setError('');
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      startTimer();
      setPhase('recording');
    } catch {
      setError('Mikrofon erişimi reddedildi. Tarayıcı ayarlarından izin verin.');
    }
  };

  const computeReport = (msgs: Message[]): SimReport => {
    const duration = Math.floor((Date.now() - chatStartTimeRef.current) / 1000);
    const userMsgs = msgs.filter(m => m.role === 'user' && m.turnAnalysis);
    const scores = userMsgs.map(m => m.turnAnalysis!.score);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return {
      duration,
      turnCount: userMsgs.length,
      avgScore,
      grammarErrors: userMsgs.flatMap(m => m.turnAnalysis!.grammarErrors),
      vocabSuggestions: userMsgs.flatMap(m => m.turnAnalysis!.vocabSuggestions),
    };
  };

  const startSession = () => {
    chatStartTimeRef.current = Date.now();
    setSessionStarted(true);
  };

  const handleEndSession = () => {
    stopStream(); stopTimer();
    if (audioRef.current) { audioRef.current.pause(); }
    setPhase('idle');
    setSessionReport(computeReport(messages));
    setStep('report');
  };

  const startChat = (sc: string | null) => {
    const sc2 = sc || customScenario.trim() || 'Serbest konuşma pratiği';
    setScenario(sc2);
    const greeting = mode === 'scenario'
      ? `Good. Today we're working on: "${sc2}". I'll be your professional counterpart. Press the mic button when you're ready.`
      : `Hello! I'm ${coach?.name}. Ready for a free English conversation session. Press the mic button whenever you'd like to start.`;
    setMessages([{ role: 'coach', text: greeting, ts: now() }]);
    setSessionStarted(false);
    setPhase('idle');
    setError('');
    setStep('chat');
  };

  const reset = () => {
    stopStream(); stopTimer();
    if (audioRef.current) { audioRef.current.pause(); }
    setStep('sector'); setSector(null); setCoach(null); setMode(null);
    setScenario(null); setCustomScenario(''); setMessages([]);
    setSessionStarted(false); setPhase('idle'); setError(''); setSessionReport(null);
  };

  const featuredCoachIds = sector ? (SECTOR_COACHES[sector.id] || SECTOR_COACHES.diger) : [];
  const featuredCoaches = featuredCoachIds.map(id => COACHES.find(c => c.id === id)).filter(Boolean) as Coach[];
  const otherCoaches = COACHES.filter(c => !featuredCoachIds.includes(c.id));

  if (step === 'chat' && coach) {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <div className="px-5 py-3 border-b flex items-center gap-3 shadow-sm flex-shrink-0" style={{ background: '#fff', borderColor: SILVER_MID }}>
          <CoachAvatar coach={coach} size={36} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate" style={{ color: NAVY }}>{coach.name}</div>
            <div className="text-xs text-slate-400 truncate max-w-xs">{scenario}</div>
          </div>
          {sessionStarted ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-slate-400">Aktif</span>
              </div>
              <button onClick={handleEndSession} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#dc2626' }}>
                Oturumu Bitir
              </button>
            </div>
          ) : (
            <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">← Geri</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ background: SILVER_LIGHT }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5`}>
              {m.role === 'coach' && <CoachAvatar coach={coach} size={30} />}
              <div className={`max-w-sm flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'text-white rounded-tr-sm' : 'text-slate-800 rounded-tl-sm'}`}
                  style={{ background: m.role === 'user' ? NAVY : '#fff', border: m.role === 'coach' ? `1px solid ${SILVER_MID}` : 'none' }}>
                  {m.text}
                </div>
                {m.turnAnalysis && m.turnAnalysis.grammarErrors.length > 0 && (
                  <div className="w-full text-xs px-3 py-2 rounded-xl space-y-1" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
                    {m.turnAnalysis.grammarErrors.slice(0, 2).map((e, gi) => (
                      <div key={gi} style={{ color: '#78350f' }}>
                        <span className="line-through opacity-60">{e.original}</span> → <span className="font-semibold">{e.corrected}</span>
                        <span className="opacity-70 ml-1">({e.explanation})</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.turnAnalysis && m.turnAnalysis.vocabSuggestions.length > 0 && m.turnAnalysis.grammarErrors.length === 0 && (
                  <div className="w-full text-xs px-3 py-2 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                    💡 {m.turnAnalysis.vocabSuggestions[0].original} → <span className="font-semibold">{m.turnAnalysis.vocabSuggestions[0].better}</span>
                  </div>
                )}
                <span className="text-xs text-slate-400 px-1">{m.ts}</span>
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-1 font-bold" style={{ background: SILVER }}>S</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t flex-shrink-0" style={{ background: '#fff', borderColor: SILVER_MID }}>
          {error && (
            <div className="mx-5 mt-3 px-4 py-2.5 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>
          )}
          {!sessionStarted ? (
            <div className="flex flex-col items-center py-5 gap-3">
              <p className="text-sm text-slate-500 text-center max-w-xs">Koçunuz hazır. Görüşmeyi başlatmak için butona basın.</p>
              <button onClick={startSession}
                className="px-8 py-3 rounded-2xl font-bold text-white text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
                style={{ background: '#16a34a' }}>
                🎙️ Görüşmeyi Başlat
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 gap-1" onClick={handleMicPress}>
              <MicButton phase={phase} recordSecs={recordSecs} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'report' && coach && sessionReport) {
    const scoreColor = sessionReport.avgScore >= 80 ? '#16a34a' : sessionReport.avgScore >= 65 ? '#d97706' : '#dc2626';
    const scoreLabel = sessionReport.avgScore >= 80 ? 'Çok İyi' : sessionReport.avgScore >= 65 ? 'Geliştirilmeli' : 'Çok Pratik Gerekli';
    return (
      <div className="overflow-y-auto py-8 px-4" style={{ background: SILVER_LIGHT, minHeight: 'calc(100vh - 64px)' }}>
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black" style={{ color: NAVY }}>Oturum Raporu</h2>
            <p className="text-slate-500 text-sm">{coach.name} ile "{scenario}"</p>
          </div>

          <div className="rounded-2xl p-6 shadow-sm" style={{ background: '#fff', border: `1px solid ${SILVER_MID}` }}>
            <div className="flex items-center justify-between gap-6">
              <div className="flex flex-col items-center gap-1">
                <div className="text-5xl font-black" style={{ color: scoreColor }}>{sessionReport.avgScore || '—'}</div>
                <div className="text-xs font-semibold" style={{ color: scoreColor }}>{sessionReport.avgScore ? scoreLabel : 'Puan yok'}</div>
                <div className="text-xs text-slate-400">Genel Skor</div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                {[
                  { label: 'Süre', value: formatDuration(sessionReport.duration) },
                  { label: 'Tur Sayısı', value: `${sessionReport.turnCount} tur` },
                  { label: 'Gramer Hatası', value: `${sessionReport.grammarErrors.length} adet` },
                  { label: 'Kelime Önerisi', value: `${sessionReport.vocabSuggestions.length} adet` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: SILVER_LIGHT }}>
                    <div className="text-lg font-bold" style={{ color: NAVY }}>{value}</div>
                    <div className="text-xs text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {sessionReport.grammarErrors.length > 0 && (
            <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#fff', border: `1px solid ${SILVER_MID}` }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: NAVY }}>Gramer Hataları</h3>
              <div className="space-y-2">
                {sessionReport.grammarErrors.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
                    <span className="text-red-500 font-mono line-through whitespace-nowrap">{e.original}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-semibold text-green-700 whitespace-nowrap">{e.corrected}</span>
                    <span className="text-xs text-slate-500 flex-1">({e.explanation})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessionReport.vocabSuggestions.length > 0 && (
            <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#fff', border: `1px solid ${SILVER_MID}` }}>
              <h3 className="font-bold text-sm mb-3" style={{ color: NAVY }}>Profesyonel Kelime Önerileri</h3>
              <div className="space-y-2">
                {sessionReport.vocabSuggestions.map((v, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <span className="text-slate-500 whitespace-nowrap">{v.original}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-semibold text-green-700 whitespace-nowrap">{v.better}</span>
                    <span className="text-xs text-slate-500 flex-1">({v.explanation})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessionReport.grammarErrors.length === 0 && sessionReport.vocabSuggestions.length === 0 && sessionReport.turnCount > 0 && (
            <div className="rounded-2xl p-5 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="text-2xl mb-1">🎉</div>
              <div className="font-bold text-green-700 text-sm">Bu turda belirgin bir hata tespit edilmedi.</div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => startChat(scenario)} className="flex-1 py-3 rounded-2xl font-bold text-white text-sm hover:opacity-90 active:scale-95 transition-all" style={{ background: NAVY }}>
              Yeniden Dene
            </button>
            <button onClick={reset} className="flex-1 py-3 rounded-2xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all" style={{ background: SILVER_MID, color: NAVY }}>
              Ana Menü
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto" style={{ background: SILVER_LIGHT, minHeight: 'calc(100vh - 64px)', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {step === 'sector' && (
          <>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#0ea5e9' }}>— Adım 1 / 3</div>
              <h1 className="text-2xl font-black mb-1" style={{ color: NAVY }}>Sektörünüzü Seçin</h1>
              <p className="text-slate-500 text-sm">Sektörünüze özel senaryolar ve uzman koçlar gösterilecektir.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {SECTORS.map(s => (
                <SectorCard key={s.id} sector={s} onSelect={() => { setSector(s); setStep('coach'); }} />
              ))}
            </div>
          </>
        )}

        {step === 'coach' && sector && (
          <>
            <div>
              <button onClick={() => setStep('sector')} className="text-xs text-slate-400 hover:text-slate-600 mb-3 transition-colors">← Sektör Seç</button>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#0ea5e9' }}>— Adım 2 / 3</div>
              <h1 className="text-2xl font-black mb-1" style={{ color: NAVY }}>Koçunuzu Seçin</h1>
              <p className="text-slate-500 text-sm">{sector.label} sektörü için uzman ve diğer koçlar</p>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: NAVY }}>Bu Sektörün Uzmanları</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {featuredCoaches.map(c => (
                  <CoachCard key={c.id} coach={c} featured onSelect={() => { setCoach(c); setStep('mode'); }} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Diğer Koçlar</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {otherCoaches.map(c => (
                  <CoachCard key={c.id} coach={c} onSelect={() => { setCoach(c); setStep('mode'); }} />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'mode' && coach && sector && (
          <>
            <div>
              <button onClick={() => setStep('coach')} className="text-xs text-slate-400 hover:text-slate-600 mb-3 transition-colors">← Koç Seç</button>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#0ea5e9' }}>— Adım 3 / 3</div>
              <h1 className="text-2xl font-black mb-1" style={{ color: NAVY }}>Mod Seçin</h1>
              <div className="flex items-center gap-3 mt-3">
                <CoachAvatar coach={coach} size={40} />
                <div>
                  <div className="font-bold text-sm" style={{ color: NAVY }}>{coach.name} {coach.flag}</div>
                  <div className="text-xs text-slate-400">{coach.specialty}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => { setMode('scenario'); setStep('scenario-pick'); }}
                className="p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: '#fff', borderColor: '#0ea5e9' }}>
                <div className="text-2xl mb-3">🎯</div>
                <div className="font-black text-lg mb-1" style={{ color: NAVY }}>Senaryo Modu</div>
                <div className="text-xs text-slate-500">Gerçek iş durumlarını simüle eden yapılandırılmış senaryolarla pratik yapın.</div>
              </button>
              <button onClick={() => { setMode('free'); startChat(null); }}
                className="p-6 rounded-2xl border text-left transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: '#fff', borderColor: SILVER_MID }}>
                <div className="text-2xl mb-3">💬</div>
                <div className="font-black text-lg mb-1" style={{ color: NAVY }}>Serbest Konuşma</div>
                <div className="text-xs text-slate-500">Koçunuzla serbestçe İngilizce konuşun. Konu ve yön tamamen size ait.</div>
              </button>
            </div>
          </>
        )}

        {step === 'scenario-pick' && coach && sector && (
          <>
            <div>
              <button onClick={() => setStep('mode')} className="text-xs text-slate-400 hover:text-slate-600 mb-3 transition-colors">← Mod Seç</button>
              <h1 className="text-2xl font-black mb-1" style={{ color: NAVY }}>Senaryo Seçin</h1>
              <p className="text-slate-500 text-sm">{sector.label} · {coach.name}</p>
            </div>
            <div className="space-y-2">
              {getScenarios(sector.id).map((sc) => (
                <button key={sc} onClick={() => startChat(sc)}
                  className="w-full text-left px-5 py-4 rounded-2xl border font-medium text-sm transition-all hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5"
                  style={{ background: '#fff', borderColor: SILVER_MID, color: NAVY }}>
                  {sc}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border p-4" style={{ background: '#fff', borderColor: SILVER_MID }}>
              <div className="text-xs font-bold mb-2" style={{ color: NAVY }}>Özel Senaryo</div>
              <div className="flex gap-2">
                <input
                  value={customScenario}
                  onChange={e => setCustomScenario(e.target.value)}
                  placeholder="Kendi senaryonuzu yazın..."
                  className="flex-1 text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  style={{ borderColor: SILVER_MID, color: NAVY }}
                />
                <button onClick={() => startChat(customScenario)} disabled={!customScenario.trim()}
                  className="px-4 py-2 rounded-xl font-bold text-white text-sm disabled:opacity-40 hover:opacity-90 transition-all"
                  style={{ background: NAVY }}>
                  Başla
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

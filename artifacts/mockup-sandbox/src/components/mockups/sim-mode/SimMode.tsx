import { useState, useRef, useEffect } from 'react';

const NAVY = '#082567';
const NAVY_LIGHT = '#0f3a8f';
const NAVY_DARK = '#051a45';
const SILVER = '#94a3b8';
const SILVER_LIGHT = '#f1f5f9';
const SILVER_MID = '#e2e8f0';

const SECTORS = [
  { id: 'finans', label: 'Finans', icon: '💹', desc: 'Bankacılık, yatırım, sigortacılık' },
  { id: 'teknoloji', label: 'Teknoloji', icon: '💻', desc: 'Yazılım, AI, dijital ürünler' },
  { id: 'saglik', label: 'Sağlık', icon: '🏥', desc: 'Sağlık hizmetleri, ilaç, medikal cihaz' },
  { id: 'uretim', label: 'Üretim', icon: '🏭', desc: 'İmalat, fabrika, endüstri' },
  { id: 'perakende', label: 'Perakende', icon: '🛍️', desc: 'E-ticaret, mağazacılık, satış' },
  { id: 'lojistik', label: 'Lojistik', icon: '🚢', desc: 'Tedarik zinciri, kargo, depo' },
  { id: 'insaat', label: 'İnşaat', icon: '🏗️', desc: 'Gayrimenkul, altyapı, mühendislik' },
  { id: 'egitim', label: 'Eğitim', icon: '🎓', desc: 'Akademi, kurumsal eğitim, EdTech' },
  { id: 'turizm', label: 'Turizm', icon: '✈️', desc: 'Otelcilik, seyahat, sağlık turizmi' },
  { id: 'danismanlik', label: 'Danışmanlık', icon: '📊', desc: 'Strateji, yönetim, süreç iyileştirme' },
  { id: 'hukuk', label: 'Hukuk', icon: '⚖️', desc: 'Hukuk büroları, uyum, sözleşme' },
  { id: 'medya', label: 'Medya', icon: '📡', desc: 'Yayıncılık, reklam, içerik üretimi' },
  { id: 'enerji', label: 'Enerji', icon: '⚡', desc: 'Yenilenebilir enerji, petrol & gaz' },
  { id: 'diger', label: 'Diğer', icon: '🌐', desc: 'Diğer sektörler' },
];

const COACHES = [
  { id: 'sterling', name: 'Mr. Sterling', flag: '🇬🇧', specialty: 'CEO & Stratejik Yönetim', accent: 'Üst Segment İngiliz (RP)', color: '#1E3A5F', style: 'Otoriter, lakonik, vizyon odaklı', image: null, initials: 'MS' },
  { id: 'jake', name: 'Jake', flag: '🇺🇸', specialty: 'Pazarlama & Dijital Medya', accent: 'West Coast Amerikan', color: '#EA580C', style: 'Enerjik, yaratıcı, trendy', image: null, initials: 'J' },
  { id: 'david', name: 'David', flag: '🇺🇸', specialty: 'Finans & Yatırım', accent: 'New York (Wall Street)', color: '#0369A1', style: 'Analitik, direkt, rakam odaklı', image: null, initials: 'D' },
  { id: 'emma', name: 'Emma', flag: '🇬🇧', specialty: 'İnsan Kaynakları', accent: 'Standart İngiliz (London)', color: '#BE185D', style: 'Empatik, yapılandırılmış, destekleyici', image: null, initials: 'E' },
  { id: 'raj', name: 'Raj', flag: '🇮🇳', specialty: 'BT & Yazılım Geliştirme', accent: 'Hint-İngiliz (Global Tech)', color: '#7C3AED', style: 'Sistematik, teknik, iş birlikçi', image: null, initials: 'R' },
  { id: 'hans', name: 'Hans', flag: '🇩🇪', specialty: 'Lojistik & Operasyon', accent: 'Alman-İngiliz (Euro-English)', color: '#374151', style: 'Metodolojik, hassas, süreç odaklı', image: null, initials: 'H' },
  { id: 'elena', name: 'Elena', flag: '🇪🇺', specialty: 'Uluslararası Hukuk', accent: 'Diplomatik (Doğu Avrupa)', color: '#065F46', style: 'Kesin, diplomatik, mükemmeliyetçi', image: null, initials: 'EL' },
  { id: 'alistair', name: 'Alistair', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', specialty: 'Satış & Müzakere', accent: 'İskoç (Edinburg)', color: '#B91C1C', style: 'İkna edici, stratejik, ısrarcı', image: null, initials: 'A' },
  { id: 'chloe', name: 'Chloe', flag: '🇦🇺', specialty: 'Müşteri İlişkileri', accent: 'Avusturalyalı (Friendly)', color: '#D97706', style: 'Sıcak, samimi, çözüm odaklı', image: null, initials: 'C' },
  { id: 'james', name: 'James', flag: '🇺🇸', specialty: 'Üretim & Fabrika Yönetimi', accent: 'Amerikan (Midwest)', color: '#78350F', style: 'Pratik, güvenilir, direkt', image: null, initials: 'JA' },
  { id: 'claire', name: 'Dr. Claire', flag: '🇬🇧', specialty: 'Gramer & İleri Telaffuz', accent: 'Akademik İngiliz (Oxford)', color: '#0F766E', style: 'Titiz, sabırlı, akademik', image: null, initials: 'DC' },
  { id: 'olivia', name: 'Dr. Olivia', flag: '🇺🇸', specialty: 'Sağlık Turizmi İngilizcesi', accent: 'Amerikan (Miami / Sağlık Turizmi)', color: '#0891b2', style: 'Profesyonel, kültürel farkındalıklı, sıcak', image: null, initials: 'DO' },
];

const SCENARIO_MAP: Record<string, Record<string, string[]>> = {
  finans: {
    sterling: ['Yönetim kurulu yatırım stratejisi sunumu', 'CFO ile çeyreklik performans değerlendirmesi', 'Risk komitesi briefing toplantısı', 'Yabancı yatırımcı roadshow konuşması', 'Banka CEO\'su ile stratejik ortaklık görüşmesi', 'Fon yöneticisi ile portföy sunumu', 'Kurumsal tahvil ihracı tanıtım toplantısı', 'Şirket birleşme müzakeresi üst düzey', 'Yıllık genel kurul açılış konuşması', 'Strateji danışmanlık firmasıyla brifing'],
    david: ['Portföy risk analizi görüşmesi', 'IPO sürecinde yatırımcı sorularına yanıt', 'Finansal model sunumu (DCF analizi)', 'Bloomberg terminali üzerinden piyasa yorumu', 'Kredi derecelendirme kuruluşuyla görüşme', 'Hedge fund yöneticisiyle alpha stratejisi', 'Türev ürünler satış görüşmesi', 'Kaldıraçlı satın alma (LBO) müzakeresi', 'Emeklilik fonu portföy danışmanlığı', 'Sermaye piyasaları regülatör toplantısı'],
    default: ['Banka şubesi kurumsal müşteri görüşmesi', 'Kredi başvurusu değerlendirme toplantısı', 'Yatırım fonu satış görüşmesi', 'Vergi danışmanlığı brifingi', 'Uluslararası ödeme sistemi entegrasyon toplantısı', 'Finansal uyum (compliance) denetim görüşmesi', 'Muhasebe firması yıllık denetim toplantısı', 'Foreks masası müşteri danışmanlığı', 'Sigorta poliçesi kurumsal sunum', 'Fintech startup yatırımcı pitch\'i'],
  },
  teknoloji: {
    raj: ['Teknik mülakat: sistem tasarımı soruları', 'Scrum sprint retrospektif toplantısı', 'CTO ile mimari karar toplantısı', 'API entegrasyon teknik briefing', 'Ürün ekibi roadmap sunum', 'Güvenlik açığı raporlama görüşmesi', 'Bulut maliyet optimizasyon sunumu', 'DevOps pipeline değerlendirme toplantısı', 'SaaS ürün demo müşteri görüşmesi', 'Teknoloji tedarikçisi seçim değerlendirmesi'],
    jake: ['Dijital ürün lansman kampanyası brifingi', 'Growth hacking strateji toplantısı', 'Influencer ortaklık görüşmesi', 'App Store optimizasyon değerlendirmesi', 'Sosyal medya kriz iletişimi', 'Performance marketing sonuç sunumu', 'Startup pitch: seed round yatırımcı', 'Kullanıcı araştırması (UX interview)', 'Ürün-Pazar uyumu değerlendirmesi', 'Tech media röportajı'],
    default: ['Teknoloji tedarikçisi RFP toplantısı', 'Dijital dönüşüm danışmanlık toplantısı', 'Siber güvenlik farkındalık eğitimi', 'IT altyapı yükseltme planlaması', 'SLA müzakeresi bulut sağlayıcısıyla', 'Yazılım lisans yenileme görüşmesi', 'Veri koruma (GDPR) uyum toplantısı', 'Otomasyon projesi fizibilite sunumu', 'ERP implementasyon kick-off toplantısı', 'Teknik destek eskalasyon görüşmesi'],
  },
  saglik: {
    olivia: ['Uluslararası hasta tedavi paketi görüşmesi', 'Sigorta şirketi ile teminat anlaşması', 'Yabancı hastane akreditasyon toplantısı', 'Medikal turist karşılama ve briefing', 'JCI akreditasyon denetçisi görüşmesi', 'Sağlık sigortası uluslararası kapsam tartışması', 'Hasta ailesi tedavi süreci açıklaması', 'Sağlık turizmi fuarı B2B toplantısı', 'Yurt dışı kliniği ile referans protokolü', 'Sağlık turisti takip süreci koordinasyonu'],
    default: ['Klinik araştırma sponsoru briefing toplantısı', 'Medikal cihaz satış görüşmesi', 'Hastane satın alma müdürüyle tedarikçi görüşmesi', 'İlaç firması ürün tanıtım toplantısı', 'Sağlık bakanlığı regülasyon brifingi', 'Uluslararası konferans panel sunumu', 'Tele-tıp hizmet sözleşme görüşmesi', 'Hastane akreditasyon denetim toplantısı', 'Sağlık sigortası premi artış görüşmesi', 'Medikal çeviri ve terminoloji pratiği'],
  },
  lojistik: {
    hans: ['Tedarikçi kalifikasyon görüşmesi', 'Gümrük beyanname süreci briefing', 'Liman operatörü ile kapasite müzakeresi', '3PL sözleşme müzakeresi', 'INCOTERMS 2020 kargo sözleşmesi', 'Rota optimizasyon analizi sunumu', 'Depo otomasyonu proje kick-off', 'Tedarik zinciri kesinti kriz yönetimi', 'ISO 9001 lojistik denetim görüşmesi', 'Filo yönetimi tedarikçi seçim toplantısı'],
    default: ['Deniz kargo rezervasyon görüşmesi', 'Hava kargo acil sevkiyat koordinasyonu', 'Gümrük müşaviri teknik briefing', 'E-ticaret son mil teslimat anlaşması', 'Soğuk zincir lojistik tedarikçi toplantısı', 'Uluslararası taşımacılık fiyat müzakeresi', 'Lojistik startup yatırımcı sunumu', 'Depo kira sözleşme müzakeresi', 'Sevkiyat izleme sistemi entegrasyon toplantısı', 'Zararlı madde taşıma uyum brifingi'],
  },
  hukuk: {
    elena: ['Uluslararası tahkim duruşma hazırlığı', 'M&A due diligence hukuki briefing', 'Uluslararası sözleşme müzakeresi', 'GDPR uyum hukuki değerlendirmesi', 'AB mevzuatı diplomatik brifing', 'Yabancı yatırım hukuku danışmanlığı', 'İnsan hakları davası uluslararası forum', 'Antitröst soruşturma cevap görüşmesi', 'Uluslararası marka ihlali hukuki toplantısı', 'İkili yatırım anlaşması müzakeresi'],
    default: ['Kurumsal sözleşme inceleme toplantısı', 'İş hukuku uyuşmazlık görüşmesi', 'Fikri mülkiyet lisans müzakeresi', 'Kurumsal uyum (compliance) denetim toplantısı', 'Vergi uyuşmazlığı danışmanlık görüşmesi', 'Gayrimenkul satış sözleşme müzakeresi', 'Şirket kuruluş hukuki brifingi', 'Çalışan iş sözleşmesi revizyonu', 'Veri ihlali hukuki yanıt toplantısı', 'Uluslararası hukuk konferansı sunum'],
  },
  turizm: {
    olivia: ['Medikal turist paket satış görüşmesi', 'Yabancı hastane partnership görüşmesi', 'Sağlık turizmi fuarı networking', 'Sigorta şirketi sağlık turizmi kapsamı', 'VIP hasta transfer koordinasyonu', 'Klinik akreditasyon tanıtım toplantısı', 'Online platform medikal turizm listeleme', 'Sağlık turizmi basın açıklaması', 'Medikal danışman referans görüşmesi', 'Post-tedavi takip hizmet anlaşması'],
    chloe: ['Otel kurumsal hesap satış görüşmesi', 'Online seyahat acentesi (OTA) müzakeresi', 'Turist şikâyet yönetimi konuşması', 'MICE grubu organizasyon brifingi', 'Destinasyon tanıtım B2B toplantısı', 'Havayolu şirketi partnership görüşmesi', 'Turizm bakanlığı akreditasyon toplantısı', 'Konferans venue satış sunumu', 'Seyahat sigortası ürün görüşmesi', 'Turizm dijital pazarlama ajansı brifingi'],
    default: ['Otel yönetimi misafir deneyimi toplantısı', 'Tur operatörü ile sözleşme müzakeresi', 'Kongre organizasyonu sponsorluk görüşmesi', 'Destinasyon yönetim organizasyonu (DMO) brifingi', 'Havalimanı VIP lounge hizmet görüşmesi', 'Kruvaziyer şirketi liman anlaşması', 'Adventure turizm güvenlik brifingi', 'Kültürel miras turizm proje toplantısı', 'Sürdürülebilir turizm sertifika görüşmesi', 'Turizm yatırımcısı proje sunumu'],
  },
  default: {
    default: ['Uluslararası müşteri keşif görüşmesi', 'Stratejik ortaklık ilk temas toplantısı', 'Ürün/hizmet tanıtım sunumu', 'Bütçe ve fiyatlama müzakeresi', 'Proje kick-off ve hedef belirleme', 'Performans değerlendirme görüşmesi', 'Kriz iletişimi acil toplantısı', 'Yeni pazar giriş strateji brifingi', 'Tedarikçi kalifikasyon görüşmesi', 'Uluslararası konferans networking konuşması'],
  },
};

function getScenarios(sectorId: string, coachId: string): string[] {
  const sectorMap = SCENARIO_MAP[sectorId] || SCENARIO_MAP.default;
  return sectorMap[coachId] || sectorMap.default || SCENARIO_MAP.default.default;
}

interface Message { role: 'user' | 'coach'; text: string; feedback?: string; ts: string }

const DEMO_RESPONSES: Record<string, string[]> = {
  sterling: [
    "Good. Let's be direct — what's your value proposition in three sentences?",
    "In boardrooms, precision is currency. Your phrasing was adequate, but 'adequate' loses deals. Try again with conviction.",
    "That's the shape of an answer. Now give me the substance. Numbers, timelines, accountability.",
  ],
  jake: [
    "Okay okay okay, love the energy! But here's the thing — your hook needs to land in under five seconds. Let's workshop that opener.",
    "So in digital, we'd say your message is like... mid. Not bad, not great. What's the ONE thing you want them to remember?",
    "Dude, that's actually solid! Let's push it further. What if we made it even more shareable?",
  ],
  david: [
    "Walk me through the assumptions behind that number. Because right now, it doesn't hold up to scrutiny.",
    "On Wall Street, uncertainty is priced in — but not communicated the way you just did. Be specific about the risk factors.",
    "Good start. Now tell me the downside scenario. Investors always ask about the floor, not just the ceiling.",
  ],
  emma: [
    "I appreciate that you raised this. Let's unpack it together — what outcome are you hoping for from this conversation?",
    "Your tone was professional, and that matters. One small suggestion: replace 'I think' with 'Based on...' — it carries more authority.",
    "That's a really constructive framing. I'd add that active listening signals — nodding, paraphrasing — go a long way in HR conversations.",
  ],
  raj: [
    "Technically sound, but let's optimize the communication layer. In stand-ups, we lead with blockers, then progress, then plan.",
    "Good. Now scale that explanation for a non-technical stakeholder. Remove the acronyms and anchor it to business impact.",
    "That's the right architecture for the conversation. Let me push back on one assumption though — what's your fallback?",
  ],
  hans: [
    "Precise. However, you missed the SLA clause timeline. In logistics, one missed deadline cascades. Let us revisit the sequence.",
    "The process description was correct. Add the compliance reference number next time — auditors require it.",
    "Gut. Now, what is your contingency plan if the shipment is delayed at customs?",
  ],
  elena: [
    "The argument is structured, but legally insufficient. You need to cite the applicable article. Ambiguity is leverage for the opposing party.",
    "That phrasing is diplomatically acceptable. However, in formal proceedings, 'we acknowledge' implies concession. Choose your words with care.",
    "Precisely stated. Now anticipate the counterargument — in international law, preparation is everything.",
  ],
  alistair: [
    "Not bad — but you left money on the table. You conceded too early. Always let them speak first.",
    "Right, so here's what I'd do: anchor high, then let them negotiate you down to where you wanted to be all along. Try it.",
    "That close was tentative. In sales, hesitation is contagious. Give me that last line again — this time like you mean it.",
  ],
  chloe: [
    "That was really lovely! The empathy came through clearly. Just one thing — acknowledge the feeling first, then move to solutions.",
    "Love it! Now let's make it even warmer. Customers remember how you made them feel, not what you said.",
    "You handled that really well. If this were a real call, that customer would've gone from frustrated to loyal. Brilliant!",
  ],
  james: [
    "Clear enough. On the floor, you've got maybe thirty seconds. Cut it to the essentials — what, when, who.",
    "That works for the office. Now say the same thing to a line worker who's been on shift since 6am. Plain language, no jargon.",
    "Solid. Just remember: in manufacturing, if it ain't written down, it didn't happen. Make sure your communication is documented.",
  ],
  claire: [
    "The grammar was correct, but note: you used 'which' where 'that' is required — this is a restrictive clause. Let's review the rule.",
    "Your pronunciation of 'particularly' dropped the third syllable. Repeat after me: par-TIC-u-lar-ly. Stress the second syllable.",
    "Excellent use of the subjunctive there. That's a C1-level construction. Now let's work on the rhythm of the sentence.",
  ],
  olivia: [
    "That explanation was clear and compassionate — exactly what international patients need. One tip: always confirm understanding by asking them to repeat back the key steps.",
    "Great start! In health tourism, cultural sensitivity is as important as medical accuracy. Your tone was warm, which builds trust.",
    "Perfect phrasing for a pre-procedure briefing. Remember: patients are often anxious, so pace your delivery and pause for questions.",
  ],
};

function getCoachResponse(coachId: string, index: number): { text: string; feedback: string } {
  const responses = DEMO_RESPONSES[coachId] || DEMO_RESPONSES.sterling;
  const text = responses[index % responses.length];
  const feedbacks = [
    'Gelişim notu: Cümle yapınız doğru, ancak akıcılık için daha kısa cümleler deneyin.',
    'Gelişim notu: Telaffuzunuz anlaşılır; "th" sesine dikkat edin.',
    'Gelişim notu: Kelime seçiminiz sektöre uygun; modal fiil kullanımınızı güçlendirin.',
    'Gelişim notu: Yanıt süreniz iyi; bir sonraki adımda bağlaç kullanımını artırın.',
  ];
  return { text, feedback: feedbacks[index % feedbacks.length] };
}

export function SimMode() {
  const [step, setStep] = useState<'sector' | 'coach' | 'mode' | 'scenario-pick' | 'chat'>('sector');
  const [sector, setSector] = useState<typeof SECTORS[0] | null>(null);
  const [coach, setCoach] = useState<typeof COACHES[0] | null>(null);
  const [mode, setMode] = useState<'free' | 'scenario' | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);
  const [customScenario, setCustomScenario] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [msgCount, setMsgCount] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const startChat = (sc: string | null) => {
    const sc2 = sc || customScenario.trim() || 'Serbest konuşma pratiği';
    setScenario(sc2);
    const greeting = mode === 'scenario'
      ? `Good. Today we're focusing on: "${sc2}". I'll play the role of your professional counterpart. You may begin whenever you're ready.`
      : `Welcome. I'm ${coach?.name}. I'm here for a free conversation session with you. Feel free to start wherever you like — a topic, a question, or simply introduce yourself.`;
    setMessages([{ role: 'coach', text: greeting, ts: now() }]);
    setStep('chat');
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input, ts: now() };
    const resp = getCoachResponse(coach?.id || 'sterling', msgCount);
    const coachMsg: Message = { role: 'coach', text: resp.text, feedback: resp.feedback, ts: now() };
    setMessages(m => [...m, userMsg, coachMsg]);
    setMsgCount(c => c + 1);
    setInput('');
  };

  const reset = () => {
    setStep('sector'); setSector(null); setCoach(null); setMode(null);
    setScenario(null); setCustomScenario(''); setMessages([]); setMsgCount(0);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: SILVER_LIGHT, fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ background: NAVY }} className="px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm" style={{ background: '#0ea5e9' }}>S</div>
          <span className="font-bold text-white text-lg tracking-tight">Sphere English</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#0ea5e922', color: '#7dd3fc', border: '1px solid #0ea5e933' }}>AI Studio</span>
        </div>
        <div className="flex items-center gap-4">
          <Breadcrumb step={step} sector={sector} coach={coach} mode={mode} onReset={reset} onSector={() => setStep('sector')} onCoach={() => setStep('coach')} onMode={() => setStep('mode')} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {step === 'sector' && <SectorScreen sectors={SECTORS} onSelect={s => { setSector(s); setStep('coach'); }} />}
        {step === 'coach' && sector && <CoachScreen coaches={COACHES} sector={sector} onSelect={c => { setCoach(c); setStep('mode'); }} onBack={() => setStep('sector')} />}
        {step === 'mode' && coach && sector && <ModeScreen coach={coach} sector={sector} onSelect={m => { setMode(m); if (m === 'free') startChat(null); else setStep('scenario-pick'); }} onBack={() => setStep('coach')} />}
        {step === 'scenario-pick' && coach && sector && (
          <ScenarioScreen
            coach={coach} sector={sector}
            scenarios={getScenarios(sector.id, coach.id)}
            custom={customScenario} onCustomChange={setCustomScenario}
            onSelect={startChat} onBack={() => setStep('mode')}
          />
        )}
        {step === 'chat' && coach && (
          <ChatScreen
            coach={coach} scenario={scenario || ''} messages={messages} input={input}
            onInput={setInput} onSend={sendMessage} onEnd={reset} chatRef={chatRef}
          />
        )}
      </main>
    </div>
  );
}

function now() { return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }

function Breadcrumb({ step, sector, coach, mode, onReset, onSector, onCoach, onMode }: any) {
  const items = [
    { label: sector?.label || 'Sektör', active: step !== 'sector', onClick: step !== 'sector' ? onSector : undefined },
    ...(sector ? [{ label: coach?.name || 'Koç', active: ['mode', 'scenario-pick', 'chat'].includes(step), onClick: ['mode', 'scenario-pick', 'chat'].includes(step) ? onCoach : undefined }] : []),
    ...(coach && ['scenario-pick', 'chat'].includes(step) ? [{ label: mode === 'free' ? 'Free Chat' : 'Scenario Mode', active: false }] : []),
  ];
  return (
    <div className="flex items-center gap-1 text-sm">
      <button onClick={onReset} className="text-white/40 hover:text-white/70 text-xs transition-colors">Yeniden Başla</button>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-white/30">›</span>
          <button
            onClick={item.onClick}
            className={`transition-colors ${item.active && item.onClick ? 'text-sky-400 hover:text-sky-300 cursor-pointer' : 'text-white/50 cursor-default'}`}
          >{item.label}</button>
        </span>
      ))}
    </div>
  );
}

function SectorScreen({ sectors, onSelect }: { sectors: typeof SECTORS; onSelect: (s: typeof SECTORS[0]) => void }) {
  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Adım 1 / 3</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Sektörünüzü Seçin</h1>
        <p className="text-slate-500 text-sm">Çalıştığınız veya pratik yapmak istediğiniz sektörü belirleyin. Koç ve senaryolar buna göre kişiselleştirilecektir.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sectors.map(s => (
          <button key={s.id} onClick={() => onSelect(s)}
            className="group p-4 bg-white rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ borderColor: SILVER_MID }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="font-bold text-sm mb-0.5" style={{ color: NAVY }}>{s.label}</div>
            <div className="text-xs text-slate-400 leading-tight">{s.desc}</div>
            <div className="mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#0ea5e9' }}>Seç →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoachScreen({ coaches, sector, onSelect, onBack }: { coaches: typeof COACHES; sector: typeof SECTORS[0]; onSelect: (c: typeof COACHES[0]) => void; onBack: () => void }) {
  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="mb-10">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">
          ← Sektör Seçimine Dön
        </button>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Adım 2 / 3 · {sector.icon} {sector.label}</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Koçunuzu Seçin</h1>
        <p className="text-slate-500 text-sm">Her koç farklı bir uzmanlık ve koçluk tarzı sunar. Hedefinize en uygun olanı seçin.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {coaches.map(c => (
          <button key={c.id} onClick={() => onSelect(c)}
            className="group bg-white rounded-xl border p-4 text-left transition-all hover:shadow-lg hover:-translate-y-1"
            style={{ borderColor: SILVER_MID, borderTopColor: c.color, borderTopWidth: 3 }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: c.color }}>
                {c.flag}
              </div>
              <div>
                <div className="font-bold text-sm" style={{ color: NAVY }}>{c.name}</div>
                <div className="text-xs text-slate-400">{c.accent}</div>
              </div>
            </div>
            <div className="text-xs font-semibold mb-1" style={{ color: c.color }}>{c.specialty}</div>
            <div className="text-xs text-slate-400 italic leading-tight">{c.style}</div>
            <div className="mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: c.color }}>Seç →</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModeScreen({ coach, sector, onSelect, onBack }: { coach: typeof COACHES[0]; sector: typeof SECTORS[0]; onSelect: (m: 'free' | 'scenario') => void; onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="mb-10">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">← Koç Seçimine Dön</button>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Adım 3 / 3 · {coach.flag} {coach.name}</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Mod Seçin</h1>
        <p className="text-slate-500 text-sm">{coach.name} ile nasıl çalışmak istiyorsunuz?</p>
      </div>

      {/* Coach Summary Card */}
      <div className="p-5 rounded-xl border mb-8 flex items-center gap-4" style={{ borderColor: coach.color, background: '#fff' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ background: coach.color }}>{coach.flag}</div>
        <div>
          <div className="font-bold" style={{ color: NAVY }}>{coach.name}</div>
          <div className="text-sm text-slate-500">{coach.specialty} · {coach.accent}</div>
          <div className="text-xs text-slate-400 italic mt-0.5">{coach.style}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">Sektör</div>
          <div className="text-sm font-semibold" style={{ color: NAVY }}>{sector.icon} {sector.label}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => onSelect('free')}
          className="group p-6 bg-white rounded-2xl border-2 text-left transition-all hover:shadow-xl hover:-translate-y-1"
          style={{ borderColor: SILVER_MID }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4" style={{ background: NAVY + '10' }}>💬</div>
          <div className="font-black text-lg mb-2" style={{ color: NAVY }}>Free Chat</div>
          <p className="text-sm text-slate-500 leading-relaxed">Herhangi bir konu veya senaryo olmadan koçla serbest konuşma yapın. Esnek ve spontane.</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold" style={{ color: NAVY }}>
            Başla <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>

        <button onClick={() => onSelect('scenario')}
          className="group p-6 rounded-2xl border-2 text-left transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
          style={{ borderColor: NAVY, background: NAVY }}>
          <div className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#0ea5e9', color: 'white' }}>Önerilen</div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4" style={{ background: '#ffffff15' }}>🎯</div>
          <div className="font-black text-lg mb-2 text-white">Scenario Mode</div>
          <p className="text-sm text-white/70 leading-relaxed">Sektörünüze özel hazırlanmış 10 gerçek senaryo arasından seçin veya kendi senaryonuzu belirleyin.</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-sky-400">
            Senaryoları Gör <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function ScenarioScreen({ coach, sector, scenarios, custom, onCustomChange, onSelect, onBack }: any) {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="mb-8">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">← Mod Seçimine Dön</button>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#0ea5e9' }}>— Scenario Mode · {sector.icon} {sector.label} × {coach.flag} {coach.name}</p>
        <h1 className="text-3xl font-black mb-2" style={{ color: NAVY }}>Senaryo Seçin</h1>
        <p className="text-slate-500 text-sm">Sektörünüz ve koçunuzun uzmanlığı birleştirilerek hazırlandı. Bir senaryo seçin ya da kendiniz belirleyin.</p>
      </div>

      <div className="space-y-2 mb-6">
        {scenarios.map((sc: string, i: number) => (
          <button key={i} onClick={() => onSelect(sc)}
            className="w-full text-left p-4 bg-white rounded-xl border hover:border-opacity-100 hover:shadow-md transition-all flex items-center gap-3 group"
            style={{ borderColor: SILVER_MID }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: coach.color }}>{i + 1}</span>
            <span className="text-sm font-medium flex-1" style={{ color: NAVY }}>{sc}</span>
            <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: coach.color }}>Başla →</span>
          </button>
        ))}
      </div>

      <div className="p-5 bg-white rounded-xl border" style={{ borderColor: SILVER_MID }}>
        <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: SILVER }}>Kendi Senaryonu Belirle</label>
        <textarea
          value={custom}
          onChange={e => onCustomChange(e.target.value)}
          placeholder="Örn: Yurt dışı ortakla yeni sözleşme müzakeresi yapıyorum..."
          rows={3}
          className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 mb-3"
          style={{ borderColor: SILVER_MID, color: NAVY }}
        />
        <button
          onClick={() => onSelect(custom || null)}
          disabled={!custom.trim()}
          className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
          style={{ background: NAVY }}>
          Bu Senaryoyla Başla →
        </button>
      </div>
    </div>
  );
}

function ChatScreen({ coach, scenario, messages, input, onInput, onSend, onEnd, chatRef }: any) {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Chat Header */}
      <div className="px-6 py-3 border-b flex items-center gap-3 shadow-sm" style={{ background: '#fff', borderColor: SILVER_MID }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ background: coach.color }}>{coach.flag}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: NAVY }}>{coach.name}</div>
          <div className="text-xs text-slate-400 truncate">{scenario}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-400">Aktif Oturum</span>
          <button onClick={onEnd} className="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
            style={{ background: '#dc2626' }}>Oturumu Bitir</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4" style={{ background: SILVER_LIGHT }}>
        {messages.map((m: Message, i: number) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-3`}>
            {m.role === 'coach' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-1" style={{ background: coach.color }}>{coach.flag}</div>
            )}
            <div className={`max-w-lg ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'text-white rounded-tr-sm' : 'text-slate-800 rounded-tl-sm'}`}
                style={{ background: m.role === 'user' ? NAVY : '#fff', border: m.role === 'coach' ? `1px solid ${SILVER_MID}` : 'none' }}>
                {m.text}
              </div>
              {m.feedback && (
                <div className="text-xs px-3 py-1.5 rounded-lg italic leading-relaxed" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                  💡 {m.feedback}
                </div>
              )}
              <span className="text-xs text-slate-400 px-1">{m.ts}</span>
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-1 font-bold" style={{ background: SILVER }}>S</div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t" style={{ background: '#fff', borderColor: SILVER_MID }}>
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => onInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="İngilizce yanıtınızı yazın... (Enter ile gönder)"
            rows={2}
            className="flex-1 text-sm border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{ borderColor: SILVER_MID, color: NAVY }}
          />
          <button onClick={onSend} disabled={!input.trim()}
            className="px-5 py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40 hover:opacity-90 flex-shrink-0"
            style={{ background: NAVY }}>
            Gönder
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">Her yanıt sonrası koçunuzdan kısa bir gelişim geri bildirimi alacaksınız.</p>
      </div>
    </div>
  );
}

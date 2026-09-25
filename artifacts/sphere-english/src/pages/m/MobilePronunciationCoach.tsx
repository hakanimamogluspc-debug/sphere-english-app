import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState,
  MicButton, MicPermissionSheet, useMicRecorder,
  Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Play, Volume2, ChevronRight, Languages, StopCircle,
  Award, Clock, MessageSquare, TrendingUp, CheckCircle2, AlertCircle,
} from "lucide-react";

/**
 * /m/pratik/konusma-kocu — Mobil Konuşma Koçu
 * Öğretmen seç → sohbet → mic → AI cevabı → çeviri → rapor
 */

const TOKEN_KEY = "sphere_token";
const MIN_RECORD_MS = 1500;
const STORAGE_KEY = "mobile_pronunciation_session_v1";

interface Teacher {
  id: string; name: string; flag: string;
  accentLabel: string; specialty: string; description: string;
  voice: string; color: string;
  systemPrompt: string;
}

const TEACHERS: Teacher[] = [
  { id: "sterling", name: "Mr. Sterling", flag: "🇬🇧", accentLabel: "British RP", specialty: "CEO & Yönetim", description: "Otoriter, rafine", voice: "onyx", color: "#1E3A5F", systemPrompt: "You are Mr. Sterling, a 57-year-old British executive from London with refined RP accent. Coach in a warm but precise way; keep replies short and conversational (2-3 sentences). When business or leadership comes up, bring your executive depth." },
  { id: "jake", name: "Jake", flag: "🇺🇸", accentLabel: "West Coast", specialty: "Pazarlama & Dijital", description: "Enerjik, hızlı", voice: "echo", color: "#EA580C", systemPrompt: "You are Jake, a 30-year-old San Francisco marketer, laid-back and upbeat. Keep replies short (2-3 sentences), conversational. Get excited about tech, marketing, life." },
  { id: "david", name: "David", flag: "🇺🇸", accentLabel: "New York", specialty: "Finans & Yatırım", description: "Analitik, doğrudan", voice: "echo", color: "#0369A1", systemPrompt: "You are David, a 43-year-old New Yorker in Wall Street finance. Sharp, direct, curious. Keep replies short (2-3 sentences). Shift into precise analyst mode for finance topics." },
  { id: "emma", name: "Emma", flag: "🇬🇧", accentLabel: "London", specialty: "İnsan Kaynakları", description: "Empatik, dinleyici", voice: "shimmer", color: "#BE185D", systemPrompt: "You are Emma, a 37-year-old London HR professional. Warm, empathetic, curious. Keep replies short (2-3 sentences). Excel at interview/workplace topics." },
  { id: "raj", name: "Raj", flag: "🇮🇳", accentLabel: "Indian English", specialty: "BT & Yazılım", description: "Teknik, açıklayıcı", voice: "echo", color: "#7C3AED", systemPrompt: "You are Raj, a 32-year-old software engineer from Bangalore in London. Warm, a bit nerdy, great at explaining. Keep replies short (2-3 sentences)." },
  { id: "hans", name: "Hans", flag: "🇩🇪", accentLabel: "Euro-English", specialty: "Lojistik & Ops", description: "Metodik", voice: "onyx", color: "#374151", systemPrompt: "You are Hans, a 47-year-old German from Hamburg in logistics. Precise, calm, reliable. Keep replies short (2-3 sentences)." },
  { id: "chloe", name: "Chloe", flag: "🇦🇺", accentLabel: "Australian", specialty: "Müşteri İlişkileri", description: "Samimi, çözüm odaklı", voice: "nova", color: "#D97706", systemPrompt: "You are Chloe, a 27-year-old Australian from Melbourne in customer success. Positive, easy to talk to. Keep replies short (2-3 sentences)." },
  { id: "elena", name: "Elena", flag: "🇪🇺", accentLabel: "Diplomatic", specialty: "Uluslararası Hukuk", description: "Titiz, ölçülü", voice: "nova", color: "#065F46", systemPrompt: "You are Elena, a 44-year-old Prague-born international lawyer in Brussels. Composed, thoughtful. Keep replies short (2-3 sentences)." },
  { id: "alistair", name: "Alistair", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", accentLabel: "Scottish", specialty: "Satış & Müzakere", description: "Karizmatik, ikna", voice: "echo", color: "#B91C1C", systemPrompt: "You are Alistair, a 40-year-old Scotsman from Edinburgh in sales. Charismatic, storyteller. Keep replies short (2-3 sentences)." },
  { id: "claire", name: "Dr. Claire", flag: "🇬🇧", accentLabel: "Oxford RP", specialty: "Gramer & Telaffuz", description: "Sabırlı, akademik", voice: "shimmer", color: "#0F766E", systemPrompt: "You are Dr. Claire, a 38-year-old Oxford linguist coaching grammar and pronunciation. Warm but precise. Gently correct Turkish speaker mistakes. Keep replies short (2-3 sentences)." },
];

interface WordScore { word: string; score: number; ok: boolean; }
interface GrammarError { original: string; corrected: string; explanation: string; }
interface VocabSuggestion { original: string; better: string; explanation: string; }
interface SpeechAnalysis {
  grammarErrors: GrammarError[];
  vocabularySuggestions: VocabSuggestion[];
  pronunciationTips: string[];
  overallScore: number;
  correctedText: string;
}
interface Message {
  id: string; role: "user" | "teacher"; text: string;
  wordScores?: WordScore[]; audioBase64?: string;
  speechAnalysis?: SpeechAnalysis;
  translation?: string;
}

interface SessionData {
  teacherId: string;
  messages: Message[];
  startedAt: number;
}

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveSession(d: SessionData | null) {
  try {
    if (d) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function MobilePronunciationCoach() {
  const [screen, setScreen] = useState<"select" | "chat" | "report">("select");
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micPermSheet, setMicPermSheet] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const rec = useMicRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  // Sayfa yüklendiğinde önceki oturumu geri getir
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.teacherId && saved.messages?.length > 0) {
      const t = TEACHERS.find((x) => x.id === saved.teacherId);
      if (t) {
        setTeacher(t);
        setMessages(saved.messages);
        startedAtRef.current = saved.startedAt || Date.now();
        setScreen("chat");
      }
    }
  }, []);

  // Mesaj değiştikçe oturumu kaydet
  useEffect(() => {
    if (teacher && messages.length > 0) {
      saveSession({
        teacherId: teacher.id,
        messages,
        startedAt: startedAtRef.current,
      });
    }
  }, [teacher, messages]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [messages.length, sending]);

  const playAudio = useCallback((b64: string) => {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeaking(true);
      audio.onended = () => { URL.revokeObjectURL(url); setSpeaking(false); audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); setSpeaking(false); };
      audio.play().catch(() => setSpeaking(false));
    } catch { setSpeaking(false); }
  }, []);

  const pickTeacher = (t: Teacher) => {
    setTeacher(t);
    setMessages([]);
    startedAtRef.current = Date.now();
    saveSession(null);
    setScreen("chat");
  };

  const startMic = async () => {
    try {
      await rec.start();
    } catch (e: any) {
      if (rec.error?.code === "permission-denied" || e?.name === "NotAllowedError") {
        setMicPermSheet(true);
      } else {
        showToast(rec.error?.message || "Mikrofon başlatılamadı", "error");
      }
    }
  };

  const stopMicAndSend = async () => {
    if (rec.duration * 1000 < MIN_RECORD_MS) {
      rec.cancel();
      showToast("Biraz daha uzun konuş — en az 1.5 saniye", "warning");
      return;
    }
    const blob = await rec.stop();
    if (!blob || !teacher) return;
    await sendAudio(blob);
  };

  const sendAudio = async (blob: Blob) => {
    if (!teacher) return;
    setSending(true);
    audioRef.current?.pause();
    setSpeaking(false);

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const history = messages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `audio.${ext}`);
      fd.append("voice", teacher.voice);
      fd.append("teacherName", teacher.name);
      fd.append("systemPrompt", teacher.systemPrompt);
      fd.append("history", JSON.stringify(history));

      const res = await fetch(`${API}/pronunciation/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error || `HTTP ${res.status}`);
      }

      const data = await res.json() as {
        userText: string; wordScores: WordScore[]; reply: string;
        audioBase64: string; speechAnalysis?: SpeechAnalysis;
      };

      setMessages(prev => [
        ...prev,
        {
          id: `u-${Date.now()}`, role: "user",
          text: data.userText, wordScores: data.wordScores,
          speechAnalysis: data.speechAnalysis,
        },
        {
          id: `t-${Date.now() + 1}`, role: "teacher",
          text: data.reply, audioBase64: data.audioBase64,
        },
      ]);

      if (data.audioBase64) playAudio(data.audioBase64);
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setSending(false);
    }
  };

  const translateMessage = async (m: Message) => {
    if (m.translation !== undefined) {
      // Zaten çevrili — göster/gizle
      setMessages(prev => prev.map(x =>
        x.id === m.id ? { ...x, translation: x.translation ? undefined : x.translation } : x
      ));
      return;
    }
    setTranslatingId(m.id);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API}/pronunciation/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: m.text }),
      });
      const data = await res.json().catch(() => ({}));
      const translation = (data as any)?.translation || "Çeviri alınamadı.";
      setMessages(prev => prev.map(x =>
        x.id === m.id ? { ...x, translation } : x
      ));
    } catch {
      showToast("Çeviri alınamadı", "error");
    } finally {
      setTranslatingId(null);
    }
  };

  const endSession = () => {
    audioRef.current?.pause();
    if (rec.recording) rec.cancel();
    if (messages.length === 0) {
      // Hiç konuşulmadıysa direkt seçime dön
      resetToSelect();
      return;
    }
    setScreen("report");
  };

  const resetToSelect = () => {
    audioRef.current?.pause();
    if (rec.recording) rec.cancel();
    saveSession(null);
    setTeacher(null);
    setMessages([]);
    setScreen("select");
  };

  const changeTeacher = () => {
    // Aktif oturumu kaybetme uyarısı gerekli
    if (messages.length > 0) {
      if (!confirm("Aktif konuşman silinecek. Devam edilsin mi?")) return;
    }
    resetToSelect();
  };

  // ─── Ekran 1: Öğretmen seçimi ────────────────────────────────────────
  if (screen === "select" || !teacher) {
    return (
      <ModuleShell title="Konuşma Koçu" subtitle="Bir koç seç, konuşmaya başla">
        <MobileModuleIntro moduleKey="pronunciation_coach" />
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 6,
        }}>10 uzman koç</div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
          color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.15,
          marginBottom: 20,
        }}>
          Kiminle{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            konuşalım
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: 2,
              height: 10, background: colors.turq, opacity: 0.85,
              transform: "skewY(-1deg)", zIndex: -1,
            }} />
          </span>?
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {TEACHERS.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTeacher(t)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: 16, background: colors.white,
                border: `1px solid ${colors.navy100}`,
                borderRadius: radius.card, cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 24,
                background: `${t.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
              }}>{t.flag}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
                  color: colors.navy, letterSpacing: "-0.01em", marginBottom: 2,
                }}>{t.name}</div>
                <div style={{
                  fontSize: 12, color: colors.neutral, lineHeight: 1.4,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  <span style={{ color: colors.navy400, fontWeight: 600 }}>{t.accentLabel}</span>
                  {" · "}{t.specialty}
                </div>
              </div>
              <ChevronRight size={18} color={colors.navy400} strokeWidth={2} />
            </button>
          ))}
        </div>
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Ekran 3: Rapor ────────────────────────────────────────────────
  if (screen === "report") {
    const duration = Math.floor((Date.now() - startedAtRef.current) / 1000);
    const userMessages = messages.filter(m => m.role === "user");
    const withAnalysis = userMessages.filter(m => m.speechAnalysis);
    const messageCount = userMessages.length;
    const avgScore = withAnalysis.length > 0
      ? Math.round(withAnalysis.reduce((s, m) => s + (m.speechAnalysis?.overallScore ?? 0), 0) / withAnalysis.length)
      : 0;
    const grammarErrors = withAnalysis.flatMap(m => m.speechAnalysis?.grammarErrors ?? []);
    const vocabSuggestions = withAnalysis.flatMap(m => m.speechAnalysis?.vocabularySuggestions ?? []);
    const tips = Array.from(new Set(withAnalysis.flatMap(m => m.speechAnalysis?.pronunciationTips ?? [])));

    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = mins > 0 ? `${mins}dk ${secs}sn` : `${secs}sn`;

    return (
      <ModuleShell
        title="Oturum Raporu"
        subtitle={teacher.name + " ile pratik"}
        rightAction={
          <button
            onClick={resetToSelect}
            style={{
              background: "transparent", border: "none",
              fontSize: 11, color: colors.turqDeep, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              padding: 8,
            }}
          >Bitir</button>
        }
      >
        {/* Genel skor */}
        <div style={{
          background: colors.navy, color: colors.white,
          borderRadius: radius.panel, padding: 24,
          marginBottom: 16, textAlign: "center",
        }}>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
            color: colors.turq, textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8,
          }}>Ortalama skor</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 900, fontSize: 64,
            letterSpacing: "-0.03em", lineHeight: 1,
            color: avgScore >= 80 ? colors.turq : colors.white,
          }}>
            {avgScore}
            <span style={{ fontSize: 24, color: colors.turq, marginLeft: 4 }}>/100</span>
          </div>
        </div>

        {/* İstatistikler */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
          marginBottom: 20,
        }}>
          <StatBox icon={<Clock size={14} />} label="Süre" value={durationStr} />
          <StatBox icon={<MessageSquare size={14} />} label="Konuşma" value={String(messageCount)} />
          <StatBox icon={<TrendingUp size={14} />} label="Analiz" value={String(withAnalysis.length)} />
        </div>

        {/* Gramer düzeltmeleri */}
        {grammarErrors.length > 0 && (
          <ReportSection title="Gramer düzeltmeleri" count={grammarErrors.length} icon={<AlertCircle size={14} />}>
            {grammarErrors.slice(0, 5).map((e, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8,
                background: colors.white, borderRadius: 12,
                border: `1px solid ${colors.navy50}`,
              }}>
                <div style={{ fontSize: 13, color: colors.error, textDecoration: "line-through", marginBottom: 2 }}>{e.original}</div>
                <div style={{ fontSize: 13, color: colors.navy, fontWeight: 700, marginBottom: 4 }}>{e.corrected}</div>
                <div style={{ fontSize: 11, color: colors.neutral, lineHeight: 1.4 }}>{e.explanation}</div>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Kelime önerileri */}
        {vocabSuggestions.length > 0 && (
          <ReportSection title="Daha iyi kelimeler" count={vocabSuggestions.length} icon={<TrendingUp size={14} />}>
            {vocabSuggestions.slice(0, 5).map((v, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8,
                background: colors.white, borderRadius: 12,
                border: `1px solid ${colors.navy50}`,
              }}>
                <div style={{ fontSize: 13, color: colors.neutral, marginBottom: 2 }}>
                  <span style={{ textDecoration: "line-through" }}>{v.original}</span>
                  <span style={{ margin: "0 8px" }}>→</span>
                  <span style={{ color: colors.navy, fontWeight: 700 }}>{v.better}</span>
                </div>
                <div style={{ fontSize: 11, color: colors.neutral, lineHeight: 1.4 }}>{v.explanation}</div>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Telaffuz ipuçları */}
        {tips.length > 0 && (
          <ReportSection title="Telaffuz ipuçları" count={tips.length} icon={<CheckCircle2 size={14} />}>
            {tips.slice(0, 5).map((t, i) => (
              <div key={i} style={{
                padding: 12, marginBottom: 8,
                background: colors.turqDeep + "10", borderRadius: 12,
                fontSize: 13, color: colors.navy, lineHeight: 1.4,
              }}>{t}</div>
            ))}
          </ReportSection>
        )}

        {grammarErrors.length === 0 && vocabSuggestions.length === 0 && tips.length === 0 && (
          <div style={{
            padding: 32, textAlign: "center", color: colors.neutral,
            fontSize: 13, lineHeight: 1.5,
          }}>
            <Award size={40} color={colors.turq} strokeWidth={1.5} style={{ marginBottom: 12 }} />
            <div>Harika bir oturum! Detaylı analiz için biraz daha uzun konuş.</div>
          </div>
        )}

        {/* Ana butonlar */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            onClick={() => setScreen("chat")}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 100,
              background: colors.navy50, color: colors.navy, border: "none",
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 14,
              cursor: "pointer",
            }}
          >Konuşmaya dön</button>
          <button
            onClick={resetToSelect}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 100,
              background: colors.navy, color: colors.white, border: "none",
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
              cursor: "pointer",
            }}
          >Yeni oturum</button>
        </div>
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── Ekran 2: Sohbet ────────────────────────────────────────────────
  return (
    <ModuleShell
      title={teacher.name}
      subtitle={teacher.accentLabel + " · " + teacher.specialty}
      backTo="/m/pratik"
      rightAction={
        <button
          onClick={endSession}
          aria-label="Oturumu bitir"
          style={{
            background: colors.turq, border: "none",
            padding: "6px 10px", borderRadius: 100,
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, color: colors.navy, cursor: "pointer",
            fontFamily: fonts.heading, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}
        >
          <StopCircle size={12} strokeWidth={2.5} />
          Bitir
        </button>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
          <MicButton
            recording={rec.recording}
            level={rec.level}
            duration={rec.duration}
            disabled={sending || speaking}
            onStart={startMic}
            onStop={stopMicAndSend}
            size={84}
          />
        </div>
      }
    >
      {/* Boş durum */}
      {messages.length === 0 && !sending && (
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 36,
            background: `${teacher.color}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 34, margin: "0 auto 16px",
          }}>{teacher.flag}</div>
          <div style={{
            fontFamily: fonts.heading, fontWeight: 800, fontSize: 18,
            color: colors.navy, marginBottom: 6, letterSpacing: "-0.01em",
          }}>Hazırsan başlayalım</div>
          <div style={{
            fontSize: 13, color: colors.neutral, lineHeight: 1.5,
            maxWidth: 280, margin: "0 auto 16px",
          }}>
            Mikrofona bas, İngilizce konuş.
            {teacher.name} sana cevap verecek ve telaffuzunu düzeltecek.
          </div>
          <button
            onClick={changeTeacher}
            style={{
              background: "transparent", border: `1px solid ${colors.navy100}`,
              padding: "8px 16px", borderRadius: 100, color: colors.navy,
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
              cursor: "pointer",
            }}
          >Koç değiştir</button>
        </div>
      )}

      {/* Mesajlar */}
      {messages.map((m) => (
        <div key={m.id} style={{
          display: "flex",
          justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          marginBottom: 12,
        }}>
          <div style={{ maxWidth: "82%" }}>
            <div style={{
              padding: "12px 16px",
              borderRadius: 16,
              background: m.role === "user" ? colors.navy : colors.navy50,
              color: m.role === "user" ? colors.white : colors.navy,
              fontFamily: fonts.body, fontSize: 14, lineHeight: 1.5,
              wordBreak: "break-word",
            }}>
              {m.role === "user" && m.wordScores && m.wordScores.length > 0 ? (
                <span>
                  {m.wordScores.map((w, i) => (
                    <span key={i} style={{
                      color: w.ok ? colors.white : "#fca5a5",
                      fontWeight: w.ok ? 400 : 600, marginRight: 4,
                    }}>{w.word}</span>
                  ))}
                </span>
              ) : (
                m.text
              )}

              {m.translation && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: `1px solid ${m.role === "user" ? "rgba(255,255,255,0.2)" : colors.navy100}`,
                  fontSize: 13, opacity: 0.85, fontStyle: "italic",
                }}>
                  {m.translation}
                </div>
              )}
            </div>

            {/* Aksiyonlar */}
            {(m.role === "teacher" || m.audioBase64) && (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {m.audioBase64 && (
                  <button
                    onClick={() => playAudio(m.audioBase64!)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: colors.white, border: `1px solid ${colors.navy100}`,
                      borderRadius: 100, padding: "4px 10px",
                      fontSize: 11, color: colors.navy400, cursor: "pointer",
                      fontFamily: fonts.heading, fontWeight: 700,
                    }}
                  >
                    <Play size={11} strokeWidth={2.5} />
                    Dinle
                  </button>
                )}
                {m.role === "teacher" && (
                  <button
                    onClick={() => translateMessage(m)}
                    disabled={translatingId === m.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: colors.white, border: `1px solid ${colors.navy100}`,
                      borderRadius: 100, padding: "4px 10px",
                      fontSize: 11, color: colors.navy400, cursor: "pointer",
                      fontFamily: fonts.heading, fontWeight: 700,
                      opacity: translatingId === m.id ? 0.5 : 1,
                    }}
                  >
                    <Languages size={11} strokeWidth={2.5} />
                    {translatingId === m.id ? "Çevriliyor…" : (m.translation ? "Gizle" : "Çevir")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {sending && (
        <LoadingState
          compact
          messages={[
            "Konuştuğun analiz ediliyor…",
            teacher.name + " cevap yazıyor…",
            "Ses hazırlanıyor…",
          ]}
        />
      )}

      {speaking && !sending && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, marginTop: 8, padding: 8,
        }}>
          <Volume2 size={14} color={colors.turq} strokeWidth={2.5} />
          <span style={{
            fontSize: 11, color: colors.turqDeep,
            fontFamily: fonts.heading, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{teacher.name} konuşuyor</span>
        </div>
      )}

      <div ref={bottomRef} style={{ height: 8 }} />

      <MicPermissionSheet
        visible={micPermSheet}
        onClose={() => setMicPermSheet(false)}
        onRetry={startMic}
      />
      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      background: colors.white, borderRadius: 12,
      padding: "10px 8px", border: `1px solid ${colors.navy50}`,
      textAlign: "center",
    }}>
      <div style={{ color: colors.turqDeep, marginBottom: 4, display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
        color: colors.navy, letterSpacing: "-0.01em",
      }}>{value}</div>
      <div style={{
        fontFamily: fonts.heading, fontWeight: 600, fontSize: 9,
        color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.04em",
        marginTop: 2,
      }}>{label}</div>
    </div>
  );
}

function ReportSection({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
        color: colors.navy, textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 10,
      }}>
        <span style={{ color: colors.turqDeep }}>{icon}</span>
        {title}
        <span style={{
          background: colors.navy, color: colors.white,
          borderRadius: 100, padding: "1px 6px", fontSize: 9,
          marginLeft: 4,
        }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

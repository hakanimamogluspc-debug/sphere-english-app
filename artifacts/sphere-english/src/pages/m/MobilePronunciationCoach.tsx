import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, ErrorState,
  MicButton, MicPermissionSheet, useMicRecorder,
  Toast, useToast,
  colors, fonts, radius,
} from "@/components/mobile";
import { Play, Volume2, ChevronRight, CheckCircle2 } from "lucide-react";

/**
 * /m/pratik/konusma-kocu — Mobil Konuşma Koçu
 *
 * Akış:
 *   1) Öğretmen seç (10 koç grid)
 *   2) Sohbet ekranı: mic + mesaj listesi + AI cevabı
 *
 * Backend:
 *   POST /api/pronunciation/chat (FormData: audio, voice, teacherName, systemPrompt, history)
 *   Response: { userText, wordScores, reply, audioBase64, speechAnalysis }
 */

const TOKEN_KEY = "sphere_token";
const MIN_RECORD_MS = 1500;

interface Teacher {
  id: string; name: string; flag: string;
  accentLabel: string; specialty: string; description: string;
  voice: string; color: string;
  systemPrompt: string;
}

// Mobil için kompakt öğretmen listesi — desktop'takiyle aynı çekirdek prompt.
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
interface Message {
  id: string; role: "user" | "teacher"; text: string;
  wordScores?: WordScore[]; audioBase64?: string;
}

export default function MobilePronunciationCoach() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micPermSheet, setMicPermSheet] = useState(false);
  const rec = useMicRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

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
        userText: string; wordScores: WordScore[]; reply: string; audioBase64: string;
      };

      setMessages(prev => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", text: data.userText, wordScores: data.wordScores },
        { id: `t-${Date.now() + 1}`, role: "teacher", text: data.reply, audioBase64: data.audioBase64 },
      ]);

      if (data.audioBase64) playAudio(data.audioBase64);
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    } finally {
      setSending(false);
    }
  };

  const replayMessage = (m: Message) => {
    if (m.audioBase64) playAudio(m.audioBase64);
  };

  const handleBackToSelect = () => {
    audioRef.current?.pause();
    if (rec.recording) rec.cancel();
    setTeacher(null);
    setMessages([]);
  };

  // ─── Ekran 1: Öğretmen seçimi ───────────────────────────────────────
  if (!teacher) {
    return (
      <ModuleShell title="Konuşma Koçu" subtitle="Bir koç seç, konuşmaya başla">
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
              onClick={() => setTeacher(t)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: 16,
                background: colors.white,
                border: `1px solid ${colors.navy100}`,
                borderRadius: radius.card,
                cursor: "pointer",
                textAlign: "left",
                transition: "transform 0.15s ease",
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
      </ModuleShell>
    );
  }

  // ─── Ekran 2: Sohbet ────────────────────────────────────────────────
  const canStopEarly = rec.recording && rec.duration * 1000 >= MIN_RECORD_MS;

  return (
    <ModuleShell
      title={teacher.name}
      subtitle={teacher.accentLabel + " · " + teacher.specialty}
      backTo="/m/pratik"
      rightAction={
        <button
          onClick={handleBackToSelect}
          style={{
            background: "transparent", border: "none",
            fontSize: 11, color: colors.turqDeep, cursor: "pointer",
            fontFamily: fonts.heading, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: 8,
          }}
        >Değiştir</button>
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
      {/* Mesajlar yoksa yönlendirme */}
      {messages.length === 0 && !sending && (
        <div style={{
          padding: "32px 20px",
          textAlign: "center",
        }}>
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
            maxWidth: 280, margin: "0 auto",
          }}>
            Aşağıdaki mikrofona bas, İngilizce konuş.
            {teacher.name} sana cevap verecek ve telaffuzunu geri bildirim yapacak.
          </div>
        </div>
      )}

      {/* Mesaj listesi */}
      {messages.map((m) => (
        <div key={m.id} style={{
          display: "flex",
          justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          marginBottom: 12,
        }}>
          <div style={{
            maxWidth: "80%",
            padding: "12px 16px",
            borderRadius: 16,
            background: m.role === "user" ? colors.navy : colors.navy50,
            color: m.role === "user" ? colors.white : colors.navy,
            fontFamily: fonts.body, fontSize: 14, lineHeight: 1.5,
            wordBreak: "break-word",
          }}>
            {/* Word-level renklendirme (kullanıcı mesajları) */}
            {m.role === "user" && m.wordScores && m.wordScores.length > 0 ? (
              <span>
                {m.wordScores.map((w, i) => (
                  <span key={i} style={{
                    color: w.ok ? colors.white : "#fca5a5",
                    fontWeight: w.ok ? 400 : 600,
                    marginRight: 4,
                  }}>{w.word}</span>
                ))}
              </span>
            ) : (
              m.text
            )}

            {/* Öğretmen cevabı için ses tekrar butonu */}
            {m.role === "teacher" && m.audioBase64 && (
              <button
                onClick={() => replayMessage(m)}
                style={{
                  marginTop: 8, display: "flex", alignItems: "center", gap: 6,
                  background: colors.white, border: `1px solid ${colors.navy100}`,
                  borderRadius: 100, padding: "4px 10px",
                  fontSize: 11, color: colors.navy400, cursor: "pointer",
                  fontFamily: fonts.heading, fontWeight: 700,
                }}
              >
                <Play size={11} strokeWidth={2.5} />
                Tekrar dinle
              </button>
            )}
          </div>
        </div>
      ))}

      {/* İşleniyor */}
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

      {/* AI konuşurken belirteç */}
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

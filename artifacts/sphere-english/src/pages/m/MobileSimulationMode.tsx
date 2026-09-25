import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, LoadingState, MicButton, MicPermissionSheet,
  useMicRecorder, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  ChevronRight, Play, Volume2, StopCircle, Languages,
  Briefcase, Sparkles, Zap,
} from "lucide-react";
import { SECTORS, COACHES, SECTOR_COACHES, SCENARIO_MAP } from "@/pages/student/SimulationMode";

/**
 * /m/pratik/is-senaryolari — Mobil İş Senaryoları (Simulation Mode)
 *
 * Akış: sektör → koç → mod (free/senaryo) → sohbet
 * Backend: POST /api/simulation/chat  (FormData: audio, voice, systemPrompt, sector, history)
 */

const TOKEN_KEY = "sphere_token";
const MIN_RECORD_MS = 2000;
const STORAGE_KEY = "mobile_sim_session_v1";

type Coach = typeof COACHES[number];
type Sector = typeof SECTORS[number];

interface Message {
  role: "user" | "coach";
  text: string;
  audioBase64?: string;
  translation?: string;
  turnAnalysis?: any;
}

interface Session {
  sectorId: string;
  coachId: string;
  mode: "free" | "scenario";
  scenario: string | null;
  messages: Message[];
  startedAt: number;
}

type Screen = "sector" | "coach" | "mode" | "chat";

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...s,
      messages: s.messages.map(({ role, text, translation, turnAnalysis }) => ({ role, text, translation, turnAnalysis })),
    }));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function MobileSimulationMode() {
  const [screen, setScreen] = useState<Screen>("sector");
  const [sector, setSector] = useState<Sector | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [mode, setMode] = useState<"free" | "scenario" | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("Sesin işleniyor…");
  const [micPermSheet, setMicPermSheet] = useState(false);
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);
  const rec = useMicRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  // Restore
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.messages.length > 0) {
      const s = SECTORS.find(x => x.id === saved.sectorId);
      const c = COACHES.find(x => x.id === saved.coachId);
      if (s && c) {
        setSector(s); setCoach(c);
        setMode(saved.mode); setScenario(saved.scenario);
        setMessages(saved.messages);
        startedAtRef.current = saved.startedAt || Date.now();
        setScreen("chat");
      }
    }
  }, []);

  useEffect(() => {
    if (sector && coach && mode && messages.length > 0) {
      saveSession({
        sectorId: sector.id, coachId: coach.id,
        mode, scenario, messages, startedAt: startedAtRef.current,
      });
    }
  }, [sector, coach, mode, scenario, messages]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages.length, sending]);

  const playAudio = useCallback((b64: string) => {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const a = new Audio(url);
      audioRef.current = a;
      setSpeaking(true);
      a.onended = () => { URL.revokeObjectURL(url); setSpeaking(false); audioRef.current = null; };
      a.onerror = () => { URL.revokeObjectURL(url); setSpeaking(false); };
      a.play().catch(() => setSpeaking(false));
    } catch { setSpeaking(false); }
  }, []);

  const startMic = async () => {
    try { await rec.start(); }
    catch (e: any) {
      if (rec.error?.code === "permission-denied" || e?.name === "NotAllowedError") setMicPermSheet(true);
      else showToast(rec.error?.message || "Mikrofon başlatılamadı", "error");
    }
  };

  const stopMicAndSend = async () => {
    if (rec.duration * 1000 < MIN_RECORD_MS) {
      rec.cancel();
      showToast("En az 2 saniye konuş", "warning");
      return;
    }
    const blob = await rec.stop();
    if (!blob || !coach || !sector) return;
    await sendAudio(blob);
  };

  const sendAudio = async (blob: Blob) => {
    if (!coach || !sector) return;
    setSending(true);
    audioRef.current?.pause();
    setSpeaking(false);

    const startedProcAt = Date.now();
    setProcessingStep("Sesin işleniyor…");
    const procTimer = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startedProcAt) / 1000);
      if (secs >= 12) setProcessingStep("Sesli yanıt hazırlanıyor…");
      else if (secs >= 6) setProcessingStep(coach.name + " cevap üretiyor…");
      else setProcessingStep("Sesin işleniyor…");
    }, 500);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(new Error("timeout")), 90_000);

    try {
      const history = messages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      // Senaryo modunda, ilk kullanıcı mesajından önce koça senaryo bağlamı verilir.
      // Basit yol: sistem prompt'un sonuna senaryo bilgisini ekle.
      let effectiveSystem = coach.systemPrompt;
      if (mode === "scenario" && scenario) {
        effectiveSystem += `\n\nScenario context: "${scenario}". Play your role fully; keep responses to 2-3 sentences.`;
      }

      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, `audio.${ext}`);
      fd.append("voice", coach.voice);
      fd.append("systemPrompt", effectiveSystem);
      fd.append("sector", sector.id);
      fd.append("history", JSON.stringify(history));

      const res = await fetch(`${API}/simulation/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
        body: fd,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as {
        userText: string; reply: string; audioBase64: string; turnAnalysis?: any;
      };
      setMessages(prev => [
        ...prev,
        { role: "user", text: data.userText, turnAnalysis: data.turnAnalysis },
        { role: "coach", text: data.reply, audioBase64: data.audioBase64 },
      ]);
      if (data.audioBase64) playAudio(data.audioBase64);
    } catch (e: any) {
      if (e?.name === "AbortError" || /timeout/i.test(String(e?.message))) {
        showToast("İşlem 90 saniyeyi aştı. Sunucu yoğun olabilir.", "error");
      } else {
        showToast(e?.message || "Bir hata oluştu", "error");
      }
    } finally {
      window.clearInterval(procTimer);
      window.clearTimeout(timeoutId);
      abortRef.current = null;
      setSending(false);
    }
  };

  const cancelProcessing = () => {
    abortRef.current?.abort();
    setSending(false);
  };

  const translateMessage = async (idx: number) => {
    const m = messages[idx];
    if (!m || m.role !== "coach") return;
    if (m.translation) {
      setMessages(prev => prev.map((x, i) => i === idx ? { ...x, translation: undefined } : x));
      return;
    }
    setTranslatingIdx(idx);
    try {
      const res = await fetch(`${API}/simulation/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
        },
        body: JSON.stringify({ text: m.text }),
      });
      const data = await res.json().catch(() => ({}));
      const translation = (data as any)?.translation || "Çeviri alınamadı.";
      setMessages(prev => prev.map((x, i) => i === idx ? { ...x, translation } : x));
    } catch {
      showToast("Çeviri alınamadı", "error");
    } finally {
      setTranslatingIdx(null);
    }
  };

  const resetSession = () => {
    audioRef.current?.pause();
    rec.cancel();
    abortRef.current?.abort();
    saveSession(null);
    setSector(null); setCoach(null); setMode(null);
    setScenario(null); setMessages([]);
    setScreen("sector");
  };

  // ─── EKRAN 1: Sektör ────────────────────────────────
  if (screen === "sector") {
    return (
      <ModuleShell title="İş Senaryoları" subtitle="Sektörünü seç">
        <MobileModuleIntro moduleKey="simulation_mode" />
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 6,
        }}>Sektörler</div>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 26,
          color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.15,
          marginBottom: 20,
        }}>Hangi{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            sektörde
            <span style={{
              position: "absolute", left: 0, right: 0, bottom: 2,
              height: 10, background: colors.turq, opacity: 0.85,
              transform: "skewY(-1deg)", zIndex: -1,
            }} />
          </span>?</div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          {SECTORS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSector(s); setScreen("coach"); }}
              style={{
                padding: 14, textAlign: "left",
                background: colors.white,
                border: `1px solid ${colors.navy100}`,
                borderRadius: 14, cursor: "pointer",
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: colors.navy50, color: colors.navy,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 8,
              }}>
                <Briefcase size={16} strokeWidth={2} />
              </div>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                color: colors.navy, letterSpacing: "-0.01em",
                marginBottom: 2,
              }}>{s.label}</div>
              <div style={{
                fontSize: 10, color: colors.neutral, lineHeight: 1.3,
              }}>{s.desc}</div>
            </button>
          ))}
        </div>
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── EKRAN 2: Koç ─────────────────────────────────
  if (screen === "coach" && sector) {
    const coachIds = SECTOR_COACHES[sector.id] || [];
    const sectorCoaches = coachIds.map(id => COACHES.find(c => c.id === id)).filter(Boolean) as Coach[];
    const otherCoaches = COACHES.filter(c => !coachIds.includes(c.id));
    return (
      <ModuleShell
        title={sector.label}
        subtitle="Koçunu seç"
        rightAction={
          <button
            onClick={() => { setSector(null); setScreen("sector"); }}
            style={{
              background: "transparent", border: "none",
              fontSize: 11, color: colors.turqDeep, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              padding: 8,
            }}
          >Değiştir</button>
        }
      >
        {sectorCoaches.length > 0 && (
          <>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 10,
            }}>Sektöre özel</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {sectorCoaches.map((c) => <CoachCard key={c.id} coach={c} onPick={() => { setCoach(c); setScreen("mode"); }} />)}
            </div>
          </>
        )}
        <div style={{
          fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
          color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 10,
        }}>Diğer koçlar</div>
        <div style={{ display: "grid", gap: 8 }}>
          {otherCoaches.map((c) => <CoachCard key={c.id} coach={c} onPick={() => { setCoach(c); setScreen("mode"); }} />)}
        </div>
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── EKRAN 3: Mod ────────────────────────────────
  if (screen === "mode" && sector && coach) {
    const scenarioList = (SCENARIO_MAP[sector.id]?.[coach.id]) || SCENARIO_MAP[sector.id]?.default || [];
    return (
      <ModuleShell
        title={coach.name}
        subtitle={sector.label + " · " + coach.specialty}
        rightAction={
          <button
            onClick={() => { setCoach(null); setScreen("coach"); }}
            style={{
              background: "transparent", border: "none",
              fontSize: 11, color: colors.turqDeep, cursor: "pointer",
              fontFamily: fonts.heading, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em",
              padding: 8,
            }}
          >Değiştir</button>
        }
      >
        <div style={{
          fontFamily: fonts.heading, fontWeight: 900, fontSize: 22,
          color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.2,
          marginBottom: 20,
        }}>Nasıl başlayalım?</div>

        {/* Serbest sohbet */}
        <button
          onClick={() => {
            setMode("free"); setScenario(null);
            startedAtRef.current = Date.now();
            setMessages([]);
            setScreen("chat");
          }}
          style={{
            width: "100%", padding: 16, marginBottom: 8,
            background: colors.navy, color: colors.white,
            border: "none", borderRadius: radius.card,
            display: "flex", alignItems: "center", gap: 12,
            cursor: "pointer", textAlign: "left",
          }}
        >
          <Zap size={22} color={colors.turq} strokeWidth={2} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 15,
              letterSpacing: "-0.01em", marginBottom: 2,
            }}>Serbest sohbet</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              İstediğin konuyu aç, {coach.name} eşlik etsin
            </div>
          </div>
          <ChevronRight size={18} color={colors.turq} strokeWidth={2.5} />
        </button>

        {/* Senaryo listesi */}
        {scenarioList.length > 0 && (
          <>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
              margin: "24px 0 10px",
            }}>Hazır senaryolar</div>
            <div style={{ display: "grid", gap: 8 }}>
              {scenarioList.map((sc, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setMode("scenario"); setScenario(sc);
                    startedAtRef.current = Date.now();
                    setMessages([]);
                    setScreen("chat");
                  }}
                  style={{
                    padding: 14, textAlign: "left",
                    background: colors.white,
                    border: `1px solid ${colors.navy100}`,
                    borderRadius: 12, cursor: "pointer",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11,
                    background: colors.navy50, color: colors.navy,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 11,
                    flexShrink: 0, marginTop: 2,
                  }}>{i + 1}</div>
                  <div style={{
                    flex: 1, fontSize: 13, color: colors.navy,
                    lineHeight: 1.45, fontFamily: fonts.body,
                  }}>{sc}</div>
                  <ChevronRight size={16} color={colors.navy400} strokeWidth={2} style={{ marginTop: 4, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}
        <Toast {...toast} onClose={hideToast} />
      </ModuleShell>
    );
  }

  // ─── EKRAN 4: Sohbet ────────────────────────────
  if (screen === "chat" && sector && coach) {
    return (
      <ModuleShell
        title={coach.name}
        subtitle={sector.label + (mode === "scenario" ? " · Senaryo" : " · Serbest")}
        backTo="/m/pratik"
        rightAction={
          <button
            onClick={resetSession}
            aria-label="Bitir"
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
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0", position: "relative" }}>
            <MicButton
              recording={rec.recording}
              level={rec.level}
              duration={rec.duration}
              disabled={sending || speaking}
              onStart={startMic}
              onStop={stopMicAndSend}
              size={84}
            />
            {sending && (
              <button
                onClick={cancelProcessing}
                style={{
                  position: "absolute", right: 16, top: "50%",
                  transform: "translateY(-50%)",
                  padding: "8px 12px", borderRadius: 100,
                  background: colors.navy50, color: colors.navy,
                  border: "none", fontFamily: fonts.heading,
                  fontWeight: 700, fontSize: 11, cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}
              >İptal</button>
            )}
          </div>
        }
      >
        {/* Senaryo bağlamı */}
        {scenario && messages.length === 0 && (
          <div style={{
            padding: 14, background: colors.navy50,
            borderRadius: 12, marginBottom: 16,
            borderLeft: `4px solid ${colors.turq}`,
          }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 6,
            }}>Senaryo</div>
            <div style={{
              fontSize: 13, color: colors.navy, lineHeight: 1.5,
            }}>{scenario}</div>
          </div>
        )}

        {/* Boş durum */}
        {messages.length === 0 && !sending && (
          <div style={{ padding: "20px 20px", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 32,
              background: `${coach.color}18`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 12px",
            }}>{coach.flag}</div>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 800, fontSize: 16,
              color: colors.navy, marginBottom: 4, letterSpacing: "-0.01em",
            }}>Hazırsan başlayalım</div>
            <div style={{
              fontSize: 12, color: colors.neutral, lineHeight: 1.5,
              maxWidth: 280, margin: "0 auto",
            }}>
              Mikrofona bas ve İngilizce konuş.
              {mode === "scenario" ? " Senaryoya uygun rol yap." : ""}
            </div>
          </div>
        )}

        {/* Mesajlar */}
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 12,
          }}>
            <div style={{ maxWidth: "82%" }}>
              <div style={{
                padding: "12px 16px", borderRadius: 16,
                background: m.role === "user" ? colors.navy : colors.navy50,
                color: m.role === "user" ? colors.white : colors.navy,
                fontFamily: fonts.body, fontSize: 14, lineHeight: 1.5,
                wordBreak: "break-word",
              }}>
                {m.text}
                {m.translation && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: `1px solid ${m.role === "user" ? "rgba(255,255,255,0.2)" : colors.navy100}`,
                    fontSize: 13, opacity: 0.85, fontStyle: "italic",
                  }}>{m.translation}</div>
                )}
              </div>
              {m.role === "coach" && (
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
                      <Play size={11} strokeWidth={2.5} /> Dinle
                    </button>
                  )}
                  <button
                    onClick={() => translateMessage(i)}
                    disabled={translatingIdx === i}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: colors.white, border: `1px solid ${colors.navy100}`,
                      borderRadius: 100, padding: "4px 10px",
                      fontSize: 11, color: colors.navy400, cursor: "pointer",
                      fontFamily: fonts.heading, fontWeight: 700,
                      opacity: translatingIdx === i ? 0.5 : 1,
                    }}
                  >
                    <Languages size={11} strokeWidth={2.5} />
                    {translatingIdx === i ? "Çevriliyor…" : (m.translation ? "Gizle" : "Çevir")}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <LoadingState
            compact
            messages={[processingStep]}
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
            }}>{coach.name} konuşuyor</span>
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

  return null;
}

function CoachCard({ coach, onPick }: { coach: Coach; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: 14, background: colors.white,
        border: `1px solid ${colors.navy100}`,
        borderRadius: radius.card, cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 22,
        background: `${coach.color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>{coach.flag}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: fonts.heading, fontWeight: 800, fontSize: 14,
          color: colors.navy, letterSpacing: "-0.01em", marginBottom: 2,
        }}>{coach.name}</div>
        <div style={{
          fontSize: 11, color: colors.neutral, lineHeight: 1.4,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          <span style={{ color: colors.navy400, fontWeight: 600 }}>{coach.accent}</span>
          {" · "}{coach.specialty}
        </div>
      </div>
      <ChevronRight size={16} color={colors.navy400} strokeWidth={2} />
    </button>
  );
}

import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api-url";
import {
  ModuleShell, Toast, useToast, MobileModuleIntro,
  colors, fonts, radius,
} from "@/components/mobile";
import {
  Sparkles, Send, Brain, Plus, MessageSquare,
  BookOpen, Briefcase, PenLine, Award, Type, Trash2, X, Menu,
} from "lucide-react";

/**
 * /m/pratik/ai-ogretmen — Mobil AI Öğretmen
 * Streaming metin sohbet — konuşma listesi, memory, focus, prompt önerileri.
 */

const TOKEN_KEY = "sphere_token";

interface Conversation {
  id: number; title: string; focusArea: string | null;
  archived: boolean; createdAt: string; lastMessageAt: string;
}
interface ChatMessage {
  id: number; conversationId: number;
  role: "user" | "assistant" | "system";
  content: string; meta?: any; createdAt: string;
}
interface MemoryFact { id: string; category: string; fact: string; createdAt: string; }
interface Memory { id: number; facts: MemoryFact[]; }

const FOCUS_OPTIONS = [
  { id: "free",         label: "Serbest",     desc: "Aklındaki her şey", icon: Sparkles },
  { id: "grammar",      label: "Dilbilgisi",  desc: "Tense, modal…",     icon: Type },
  { id: "vocabulary",   label: "Kelime",      desc: "Yeni kelime",       icon: BookOpen },
  { id: "conversation", label: "Sohbet",      desc: "Akıcılık",          icon: MessageSquare },
  { id: "exam_prep",    label: "Sınav",       desc: "TOEFL/IELTS/YDS",   icon: Award },
  { id: "business",     label: "İş İng.",     desc: "E-mail, sunum",     icon: Briefcase },
];

const CATEGORY_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  level:    { label: "Seviye",   bg: "#dbeafe", color: "#1e40af" },
  goal:     { label: "Hedef",    bg: "#ede9fe", color: "#5b21b6" },
  weakness: { label: "Zayıflık", bg: "#fef3c7", color: "#92400e" },
  strength: { label: "Güçlü",    bg: "#d1fae5", color: "#065f46" },
  interest: { label: "İlgi",     bg: "#fce7f3", color: "#9d174d" },
  context:  { label: "Bağlam",   bg: "#f3f4f6", color: "#374151" },
};

const SUGGESTED_PROMPTS = [
  { tr: "Past perfect ile present perfect arasındaki farkı örneklerle anlat", icon: Type },
  { tr: "B2 seviyesinde bir dialog yaz, sonra benimle pratik yap", icon: MessageSquare },
  { tr: "İşte nazikçe 'hayır' demek için 5 kalıp öğret", icon: Briefcase },
  { tr: "Bu cümleyi düzelt: 'I have went to London last year'", icon: PenLine },
  { tr: "TOEFL writing için iyi bir giriş nasıl yazılır?", icon: Award },
];

async function fetchAuth(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

export default function MobileAITutor() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showFocusPicker, setShowFocusPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { toast, show: showToast, hide: hideToast } = useToast();

  useEffect(() => {
    refreshConversations();
    refreshMemory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const refreshConversations = async () => {
    try {
      const r = await fetchAuth("/tutor/conversations");
      if (!r.ok) return;
      const d = await r.json();
      setConversations(d.conversations || []);
      if (!activeId && d.conversations?.length > 0) {
        loadConversation(d.conversations[0].id);
      }
    } catch {}
  };

  const refreshMemory = async () => {
    try {
      const r = await fetchAuth("/tutor/memory");
      if (!r.ok) return;
      const d = await r.json();
      setMemory(d.memory);
    } catch {}
  };

  const loadConversation = async (id: number) => {
    setLoadingConvo(true);
    try {
      const r = await fetchAuth(`/tutor/conversations/${id}`);
      if (!r.ok) return;
      const d = await r.json();
      setActiveId(id);
      setMessages(d.messages || []);
      setShowSidebar(false);
    } finally {
      setLoadingConvo(false);
    }
  };

  const startNewConvo = async (focusArea: string) => {
    try {
      const r = await fetchAuth("/tutor/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusArea }),
      });
      if (!r.ok) throw new Error("Sohbet başlatılamadı");
      const d = await r.json();
      setConversations((prev) => [d.conversation, ...prev]);
      setActiveId(d.conversation.id);
      setMessages([]);
      setShowSidebar(false);
      setShowFocusPicker(false);
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
    }
  };

  const deleteConvo = async (id: number) => {
    if (!confirm("Bu sohbeti silmek istediğinden emin misin?")) return;
    try {
      await fetchAuth(`/tutor/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch {}
  };

  const deleteFact = async (factId: string) => {
    try {
      await fetchAuth(`/tutor/memory/${factId}`, { method: "DELETE" });
      setMemory((m) => m ? { ...m, facts: m.facts.filter((f) => f.id !== factId) } : m);
    } catch {}
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    let convoId = activeId;
    if (!convoId) {
      try {
        const r = await fetchAuth("/tutor/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ focusArea: "free" }),
        });
        if (!r.ok) throw new Error("Sohbet açılamadı");
        const d = await r.json();
        convoId = d.conversation.id;
        setActiveId(convoId);
        setConversations((prev) => [d.conversation, ...prev]);
      } catch (e: any) {
        showToast(e?.message || "Bir hata oluştu", "error");
        return;
      }
    }

    const optimistic: ChatMessage = {
      id: -Date.now(), conversationId: convoId!, role: "user",
      content: text, createdAt: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    setInput("");
    setSending(true);

    const streamingId = -(Date.now() + 1);
    setMessages((p) => [...p, {
      id: streamingId, conversationId: convoId!, role: "assistant",
      content: "", createdAt: new Date().toISOString(),
    }]);

    try {
      const res = await fetchAuth(`/tutor/conversations/${convoId}/message-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || "Cevap alınamadı");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let sep;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          if (!raw.trim() || raw.startsWith(":")) continue;
          let evt = "message", data = "";
          for (const line of raw.split(/\r?\n/)) {
            if (line.startsWith("event: ")) evt = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          let parsed: any;
          try { parsed = JSON.parse(data); } catch { continue; }
          if (evt === "chunk" && typeof parsed.text === "string") {
            acc += parsed.text;
            setMessages((p) => p.map((m) => m.id === streamingId ? { ...m, content: acc } : m));
          } else if (evt === "error") {
            throw new Error(parsed.message || "Akış hatası");
          }
        }
      }
      // Yeni memory olabilir — arka planda yenile
      refreshMemory();
      refreshConversations();
    } catch (e: any) {
      showToast(e?.message || "Bir hata oluştu", "error");
      // Streaming mesajını kaldır
      setMessages((p) => p.filter((m) => m.id !== streamingId));
    } finally {
      setSending(false);
    }
  };

  const activeConvo = conversations.find((c) => c.id === activeId);
  const isEmpty = !activeConvo || messages.length === 0;

  return (
    <ModuleShell
      title={activeConvo?.title || "AI Öğretmen"}
      subtitle={activeConvo?.focusArea ? FOCUS_OPTIONS.find(f => f.id === activeConvo.focusArea)?.label : "Kişisel AI koçun"}
      backTo="/m/pratik"
      rightAction={
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setShowMemory(true)}
            aria-label="Hafıza"
            style={{
              background: colors.navy50, border: "none",
              width: 36, height: 36, borderRadius: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: colors.navy,
            }}
          >
            <Brain size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setShowSidebar(true)}
            aria-label="Sohbetler"
            style={{
              background: colors.navy50, border: "none",
              width: 36, height: 36, borderRadius: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: colors.navy,
            }}
          >
            <Menu size={16} strokeWidth={2.5} />
          </button>
        </div>
      }
      footer={
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Bir soru sor…"
            rows={1}
            disabled={sending}
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 20,
              border: `1px solid ${colors.navy100}`,
              fontFamily: fonts.body, fontSize: 14, lineHeight: 1.4,
              background: colors.white, color: colors.navy,
              outline: "none", resize: "none",
              maxHeight: 100, minHeight: 40,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 22,
              background: sending || !input.trim() ? colors.navy100 : colors.navy,
              color: colors.white, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: sending || !input.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <Send size={16} strokeWidth={2.5} />
          </button>
        </div>
      }
    >
      <MobileModuleIntro moduleKey="ai_tutor" />

      <div ref={scrollRef}>
        {/* Boş durum */}
        {isEmpty && !sending && (
          <div style={{ padding: "16px 0" }}>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.turqDeep, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 6,
            }}>{activeConvo ? "Sohbet başlangıcı" : "Yeni sohbet"}</div>
            <div style={{
              fontFamily: fonts.heading, fontWeight: 900, fontSize: 24,
              color: colors.navy, letterSpacing: "-0.02em", lineHeight: 1.2,
              marginBottom: 16,
            }}>Merhaba, {" "}
              <span style={{ position: "relative", display: "inline-block" }}>
                bugün ne
                <span style={{
                  position: "absolute", left: 0, right: 0, bottom: 2,
                  height: 10, background: colors.turq, opacity: 0.85,
                  transform: "skewY(-1deg)", zIndex: -1,
                }} />
              </span>{" "}
              çalışalım?
            </div>

            {/* Focus picker toggle */}
            {!activeConvo && (
              <>
                <button
                  onClick={() => setShowFocusPicker((v) => !v)}
                  style={{
                    marginBottom: 12, padding: "10px 16px", borderRadius: 100,
                    background: colors.navy50, color: colors.navy, border: "none",
                    fontFamily: fonts.heading, fontWeight: 700, fontSize: 12,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Odak alanı seç
                </button>

                {showFocusPicker && (
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
                    marginBottom: 20,
                  }}>
                    {FOCUS_OPTIONS.map(({ id, label, desc, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => startNewConvo(id)}
                        style={{
                          padding: 12, borderRadius: 12,
                          background: colors.white,
                          border: `1px solid ${colors.navy100}`,
                          cursor: "pointer", textAlign: "left",
                        }}
                      >
                        <Icon size={18} color={colors.turqDeep} strokeWidth={2} />
                        <div style={{
                          fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                          color: colors.navy, marginTop: 6, letterSpacing: "-0.01em",
                        }}>{label}</div>
                        <div style={{
                          fontSize: 10, color: colors.neutral, marginTop: 2,
                        }}>{desc}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Örnek istemler */}
            <div style={{
              fontFamily: fonts.heading, fontWeight: 700, fontSize: 11,
              color: colors.neutral, textTransform: "uppercase", letterSpacing: "0.06em",
              marginBottom: 10, marginTop: 8,
            }}>Öneri istemler</div>
            <div style={{ display: "grid", gap: 6 }}>
              {SUGGESTED_PROMPTS.map(({ tr, icon: Icon }, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(tr)}
                  disabled={sending}
                  style={{
                    padding: 12, borderRadius: 12,
                    background: colors.white,
                    border: `1px solid ${colors.navy100}`,
                    cursor: sending ? "not-allowed" : "pointer",
                    textAlign: "left",
                    display: "flex", gap: 10, alignItems: "flex-start",
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  <Icon size={16} color={colors.turqDeep} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{
                    fontSize: 13, color: colors.navy, lineHeight: 1.4,
                    fontFamily: fonts.body,
                  }}>{tr}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mesajlar */}
        {messages.map((m) => (
          <div key={m.id} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 12,
          }}>
            <div style={{
              maxWidth: "84%",
              padding: "12px 16px", borderRadius: 16,
              background: m.role === "user" ? colors.navy : colors.navy50,
              color: m.role === "user" ? colors.white : colors.navy,
              fontFamily: fonts.body, fontSize: 14, lineHeight: 1.55,
              wordBreak: "break-word", whiteSpace: "pre-wrap",
            }}>
              {m.content || (sending && m.role === "assistant" ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      {/* Sohbet sidebar */}
      {showSidebar && (
        <>
          <div
            onClick={() => setShowSidebar(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(10,20,40,0.55)",
              zIndex: 100,
            }}
          />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "84%", maxWidth: 340,
            background: colors.white, zIndex: 101,
            display: "flex", flexDirection: "column",
            animation: "slide-in 0.24s ease-out",
          }}>
            <style>{`
              @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
            `}</style>
            <div style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${colors.navy50}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 16,
                color: colors.navy, letterSpacing: "-0.01em",
              }}>Sohbetler</div>
              <button
                onClick={() => setShowSidebar(false)}
                style={{
                  background: "transparent", border: "none", padding: 4, cursor: "pointer",
                  color: colors.neutral,
                }}
                aria-label="Kapat"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              <button
                onClick={() => setShowFocusPicker(true)}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12,
                  background: colors.navy, color: colors.white, border: "none",
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                  cursor: "pointer", marginBottom: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Plus size={14} strokeWidth={2.5} />
                Yeni sohbet
              </button>

              {conversations.length === 0 ? (
                <div style={{
                  padding: 24, textAlign: "center",
                  color: colors.neutral, fontSize: 13,
                }}>Henüz sohbet yok</div>
              ) : conversations.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 10, marginBottom: 4, borderRadius: 10,
                    background: activeId === c.id ? colors.navy50 : "transparent",
                    display: "flex", gap: 8, alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => loadConversation(c.id)}
                >
                  <MessageSquare size={14} color={colors.navy} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: fonts.heading, fontWeight: 700, fontSize: 13,
                      color: colors.navy,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{c.title}</div>
                    {c.focusArea && (
                      <div style={{ fontSize: 10, color: colors.neutral, marginTop: 2 }}>
                        {FOCUS_OPTIONS.find(f => f.id === c.focusArea)?.label || c.focusArea}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConvo(c.id); }}
                    style={{
                      background: "transparent", border: "none", padding: 4, cursor: "pointer",
                      color: colors.neutral,
                    }}
                    aria-label="Sil"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Odak seçici modal (yeni sohbet için) */}
      {showFocusPicker && showSidebar === false && (
        <>
          <div
            onClick={() => setShowFocusPicker(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.55)", zIndex: 100 }}
          />
          <div style={{
            position: "fixed", left: 12, right: 12, top: "50%",
            transform: "translateY(-50%)", zIndex: 101,
            background: colors.white, borderRadius: radius.panel,
            padding: 20, maxHeight: "80vh", overflow: "auto",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 16,
            }}>
              <div style={{
                fontFamily: fonts.heading, fontWeight: 800, fontSize: 18,
                color: colors.navy, letterSpacing: "-0.01em",
              }}>Odak alanı seç</div>
              <button
                onClick={() => setShowFocusPicker(false)}
                style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: colors.neutral }}
                aria-label="Kapat"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {FOCUS_OPTIONS.map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => startNewConvo(id)}
                  style={{
                    padding: 14, borderRadius: 12,
                    background: colors.white,
                    border: `1px solid ${colors.navy100}`,
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <Icon size={20} color={colors.turqDeep} strokeWidth={2} />
                  <div style={{
                    fontFamily: fonts.heading, fontWeight: 800, fontSize: 13,
                    color: colors.navy, marginTop: 8, letterSpacing: "-0.01em",
                  }}>{label}</div>
                  <div style={{ fontSize: 10, color: colors.neutral, marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Memory sheet */}
      {showMemory && (
        <>
          <div
            onClick={() => setShowMemory(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(10,20,40,0.55)", zIndex: 100 }}
          />
          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 101,
            background: colors.white, borderRadius: "24px 24px 0 0",
            padding: "20px 20px 32px", maxHeight: "80vh", overflow: "auto",
          }}>
            <div style={{
              width: 36, height: 4, background: colors.navy100, borderRadius: 100,
              margin: "0 auto 20px",
            }} />
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              marginBottom: 16,
            }}>
              <div>
                <div style={{
                  fontFamily: fonts.heading, fontWeight: 800, fontSize: 18,
                  color: colors.navy, letterSpacing: "-0.01em",
                }}>AI hakkımda ne biliyor?</div>
                <div style={{
                  fontSize: 12, color: colors.neutral, marginTop: 2,
                }}>Öğretmenin sohbetlerinden öğrendikleri</div>
              </div>
              <button
                onClick={() => setShowMemory(false)}
                style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: colors.neutral }}
                aria-label="Kapat"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {!memory || memory.facts.length === 0 ? (
              <div style={{
                padding: 24, textAlign: "center",
                color: colors.neutral, fontSize: 13, lineHeight: 1.5,
              }}>
                <Brain size={32} color={colors.navy100} style={{ marginBottom: 12 }} />
                <div>Henüz bir şey öğrenmedim. Konuştukça hakkında bilgi biriktireceğim.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {memory.facts.map((f) => {
                  const badge = CATEGORY_BADGES[f.category] || CATEGORY_BADGES.context;
                  return (
                    <div key={f.id} style={{
                      padding: 12, background: colors.white,
                      border: `1px solid ${colors.navy50}`, borderRadius: 12,
                      display: "flex", alignItems: "flex-start", gap: 8,
                    }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 100,
                        background: badge.bg, color: badge.color,
                        fontFamily: fonts.heading, fontWeight: 800, fontSize: 10,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        flexShrink: 0,
                      }}>{badge.label}</span>
                      <div style={{
                        flex: 1, fontSize: 13, color: colors.navy, lineHeight: 1.5,
                      }}>{f.fact}</div>
                      <button
                        onClick={() => deleteFact(f.id)}
                        style={{
                          background: "transparent", border: "none", padding: 2, cursor: "pointer",
                          color: colors.neutral, flexShrink: 0,
                        }}
                        aria-label="Sil"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Toast {...toast} onClose={hideToast} />
    </ModuleShell>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  GraduationCap,
  Plus,
  Send,
  Trash2,
  Brain,
  Loader2,
  XCircle,
  MessageSquare,
  X,
  BookOpen,
  Briefcase,
  PenLine,
  Mic,
  Award,
  Type,
} from "lucide-react";
import { DictionaryHost } from "@/components/ClickableText";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const fetchAuth = (path: string, init?: RequestInit) => {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
};

interface Conversation {
  id: number;
  title: string;
  focusArea: string | null;
  archived: boolean;
  createdAt: string;
  lastMessageAt: string;
}
interface ChatMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  meta?: any;
  createdAt: string;
}
interface MemoryFact {
  id: string;
  category: string;
  fact: string;
  createdAt: string;
}
interface Memory {
  id: number;
  userId: number;
  facts: MemoryFact[];
  updatedAt: string;
}

const FOCUS_OPTIONS = [
  { id: "free", label: "Serbest", desc: "Aklındaki her şey", icon: Sparkles },
  { id: "grammar", label: "Dilbilgisi", desc: "Tense, modallar, koşul...", icon: Type },
  { id: "vocabulary", label: "Kelime", desc: "Yeni kelime ve collocation", icon: BookOpen },
  { id: "conversation", label: "Sohbet", desc: "Akıcılık & doğal konuşma", icon: MessageSquare },
  { id: "exam_prep", label: "Sınav", desc: "TOEFL/IELTS/YDS", icon: Award },
  { id: "business", label: "İş İng.", desc: "E-mail, sunum, müzakere", icon: Briefcase },
];

const FOCUS_LABEL: Record<string, string> = Object.fromEntries(FOCUS_OPTIONS.map((f) => [f.id, f.label]));

const CATEGORY_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  level: { label: "Seviye", bg: "#dbeafe", color: "#1e40af" },
  goal: { label: "Hedef", bg: "#ede9fe", color: "#5b21b6" },
  weakness: { label: "Zayıflık", bg: "#fef3c7", color: "#92400e" },
  strength: { label: "Güçlü", bg: "#d1fae5", color: "#065f46" },
  interest: { label: "İlgi", bg: "#fce7f3", color: "#9d174d" },
  context: { label: "Bağlam", bg: "#f3f4f6", color: "#374151" },
};

const SUGGESTED_PROMPTS = [
  { tr: "Past perfect ile present perfect arasındaki farkı bana örneklerle anlat", icon: Type },
  { tr: "Bana B2 seviyesinde bir İngilizce dialog yaz, sonra benimle pratik yap", icon: MessageSquare },
  { tr: "İş yerinde nazikçe 'hayır' demek için kullanabileceğim 5 kalıp öğret", icon: Briefcase },
  { tr: "Bu cümleyi düzelt: 'I have went to London last year and I see Big Ben.'", icon: PenLine },
  { tr: "TOEFL writing için iyi bir giriş paragrafı nasıl yazılır?", icon: Award },
];

export default function AITutor() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFocus, setCreatingFocus] = useState<string | null>(null); // showing focus picker
  const [showMemory, setShowMemory] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    refreshConversations();
    refreshMemory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
    setError(null);
    try {
      const r = await fetchAuth("/tutor/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusArea }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Sohbet açılamadı.");
      }
      const d = await r.json();
      setCreatingFocus(null);
      setConversations((prev) => [d.conversation, ...prev]);
      setActiveId(d.conversation.id);
      setMessages([]);
      setShowSidebar(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e: any) {
      setError(e?.message || "Hata");
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
      const r = await fetchAuth(`/tutor/memory/${factId}`, { method: "DELETE" });
      if (!r.ok) return;
      const d = await r.json();
      setMemory(d.memory);
    } catch {}
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    setError(null);

    let convoId = activeId;
    // Auto-create convo if none
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
        setError(e?.message || "Hata");
        return;
      }
    }

    // Optimistic UI
    const optimistic: ChatMessage = {
      id: -Date.now(),
      conversationId: convoId!,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);

    // Streaming icin placeholder assistant mesaji ekle
    const streamingId = -(Date.now() + 1);
    const streamingMsg: ChatMessage = {
      id: streamingId,
      conversationId: convoId!,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, streamingMsg]);

    try {
      const res = await fetchAuth(`/tutor/conversations/${convoId}/message-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Cevap alinamadi.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let doneData: any = null;
      let streamErr: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          if (!rawEvent.trim() || rawEvent.startsWith(":")) continue;

          let evtName = "message";
          let evtData = "";
          for (const line of rawEvent.split(/\r?\n/)) {
            if (line.startsWith("event: ")) evtName = line.slice(7).trim();
            else if (line.startsWith("data: ")) evtData += line.slice(6);
          }
          if (!evtData) continue;

          let parsed: any;
          try { parsed = JSON.parse(evtData); } catch { continue; }

          if (evtName === "chunk" && typeof parsed.text === "string") {
            accumulated += parsed.text;
            setMessages((prev) => prev.map((m) =>
              m.id === streamingId ? { ...m, content: accumulated } : m
            ));
          } else if (evtName === "done") {
            doneData = parsed;
          } else if (evtName === "error") {
            streamErr = parsed.message || "Akis hatasi";
          }
        }
      }

      if (streamErr) throw new Error(streamErr);
      if (!doneData) throw new Error("Akis tamamlanmadan kesildi.");

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id && m.id !== streamingId),
        doneData.userMessage,
        doneData.assistantMessage,
      ]);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convoId
            ? { ...c, title: doneData.conversationTitle || c.title, lastMessageAt: new Date().toISOString() }
            : c,
        ),
      );

      setTimeout(() => refreshMemory(), 1500);
    } catch (e: any) {
      setError(e?.message || "Hata");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id && m.id !== streamingId));
      setInput(text);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeConvo = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);

  return (
    <div className="max-w-7xl mx-auto -my-4 sm:-my-6">
      <div className="flex h-[calc(100vh-160px)] min-h-[560px] gap-4 relative">
        {/* Sidebar */}
        <aside className={`${showSidebar ? "block" : "hidden"} lg:block fixed lg:static top-0 left-0 z-40 w-72 h-full lg:h-auto bg-white border-r lg:border lg:rounded-2xl border-gray-200 shadow-xl lg:shadow-none flex-col`}>
          <div className="lg:rounded-t-2xl border-b border-gray-100 p-4 flex items-center justify-between">
            <h2 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <MessageSquare size={14} /> Sohbetler
            </h2>
            <button onClick={() => setShowSidebar(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={() => setCreatingFocus("__pick__")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700"
            >
              <Plus size={14} /> Yeni Sohbet
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[calc(100%-130px)]">
            {conversations.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8 px-3">Henüz sohbet yok. Yukarıdan başla.</p>
            )}
            {conversations.map((c) => {
              const sel = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={`group relative px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    sel ? "bg-purple-50 border border-purple-200" : "hover:bg-gray-50 border border-transparent"
                  }`}
                  onClick={() => loadConversation(c.id)}
                >
                  <p className="text-xs font-semibold text-gray-900 truncate pr-6">{c.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {c.focusArea && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-semibold uppercase">
                        {FOCUS_LABEL[c.focusArea] || c.focusArea}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(c.lastMessageAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConvo(c.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-opacity"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {showSidebar && (
          <div className="lg:hidden fixed inset-0 bg-black/20 z-30" onClick={() => setShowSidebar(false)} />
        )}

        {/* Main chat */}
        <main className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setShowSidebar(true)} className="lg:hidden p-1.5 rounded hover:bg-gray-100 text-gray-600">
                <MessageSquare size={16} />
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <GraduationCap size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">
                  {activeConvo?.title || "Sphere AI Öğretmen"}
                </p>
                <p className="text-[11px] text-gray-500">
                  Kişisel İngilizce öğretmenin
                  {activeConvo?.focusArea && ` · ${FOCUS_LABEL[activeConvo.focusArea]}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMemory(true)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
              title="Sphere'in seninle ilgili hatırladıkları"
            >
              <Brain size={12} />
              Hafıza ({memory?.facts.length ?? 0})
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4 bg-gray-50/40">
            {loadingConvo && (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                <Loader2 size={16} className="animate-spin mr-2" /> Yükleniyor...
              </div>
            )}

            {!loadingConvo && messages.length === 0 && (
              <div className="max-w-2xl mx-auto py-6">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white mb-3">
                    <GraduationCap size={28} />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Merhaba, ben Sphere</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Senin kişisel İngilizce öğretmeninim. Bana ne istersen sorabilirsin — hatalarını düzeltirim, yeni konular öğretirim, pratik yaparım.
                  </p>
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                  Önerilen başlangıçlar
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTED_PROMPTS.map((p, i) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => sendMessage(p.tr)}
                        className="text-left p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 bg-white transition-all flex gap-2 items-start"
                      >
                        <Icon size={14} className="text-purple-500 shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-700 leading-snug">{p.tr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[11px] font-bold ${
                    m.role === "user"
                      ? "bg-emerald-500"
                      : "bg-gradient-to-br from-purple-500 to-indigo-600"
                  }`}>
                    {m.role === "user" ? "Sen" : <GraduationCap size={14} />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    m.role === "user" ? "bg-emerald-500 text-white" : "bg-white border border-gray-100 text-gray-900"
                  }`}>
                    {m.role === "assistant" ? (
                      <DictionaryHost>
                        <MessageBody content={m.content} role={m.role} />
                      </DictionaryHost>
                    ) : (
                      <MessageBody content={m.content} role={m.role} />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {sending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                  <GraduationCap size={14} />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 sm:p-4 bg-white">
            {error && (
              <div className="mb-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-center gap-1">
                <XCircle size={12} /> {error}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = Math.min(160, e.currentTarget.scrollHeight) + "px";
                }}
                onKeyDown={onKey}
                disabled={sending}
                placeholder="Sphere'e bir şey sor... (Enter = gönder, Shift+Enter = yeni satır)"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm resize-none disabled:bg-gray-50"
                style={{ maxHeight: 160 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className="shrink-0 w-11 h-11 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* New conversation focus picker */}
      <AnimatePresence>
        {creatingFocus === "__pick__" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setCreatingFocus(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Hangi konuda çalışmak istersin?</h3>
                  <p className="text-xs text-gray-500">Bu sohbetin odağını seç. İstersen sonra serbest sohbet edebilirsin.</p>
                </div>
                <button onClick={() => setCreatingFocus(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FOCUS_OPTIONS.map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => startNewConvo(f.id)}
                      className="text-left p-3 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/40 transition-all"
                    >
                      <Icon size={16} className="text-purple-600 mb-1" />
                      <p className="text-sm font-bold text-gray-900">{f.label}</p>
                      <p className="text-[10px] text-gray-500 leading-snug">{f.desc}</p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory drawer */}
      <AnimatePresence>
        {showMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-end"
            onClick={() => setShowMemory(false)}
          >
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              className="bg-white w-full sm:max-w-md sm:h-full overflow-y-auto rounded-t-2xl sm:rounded-none p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Brain size={16} className="text-purple-600" /> Sphere'in Hafızası
                  </h3>
                  <p className="text-xs text-gray-500">Sohbetlerinden öğrendiklerim, sürekli hatırlıyorum.</p>
                </div>
                <button onClick={() => setShowMemory(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              {(!memory || memory.facts.length === 0) ? (
                <p className="text-sm text-gray-500 py-12 text-center">
                  Henüz seninle ilgili kalıcı bir hafızam yok. Sohbet ettikçe hedeflerini, zayıflıklarını, ilgilerini öğreneceğim.
                </p>
              ) : (
                <div className="space-y-2">
                  {memory.facts.map((f) => {
                    const badge = CATEGORY_BADGES[f.category] || CATEGORY_BADGES.context;
                    return (
                      <div key={f.id} className="group flex items-start gap-2 p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {badge.label}
                        </span>
                        <p className="flex-1 text-sm text-gray-800 leading-relaxed">{f.fact}</p>
                        <button
                          onClick={() => deleteFact(f.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-600 p-1 transition-opacity"
                          title="Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
                Hafıza, sana daha kişisel öğretebilmem için tutuyor. İstediğin zaman istemediklerini silebilirsin.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Message rendering ────────────────────────────────────

function MessageBody({ content, role }: { content: string; role: string }) {
  // Lightweight markdown-ish: bold, italic, code, line breaks
  const html = useMemo(() => {
    let s = escapeHtml(content);
    // code blocks ```...```
    s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre class="bg-gray-100 text-xs p-2 rounded my-1 overflow-x-auto"><code>${code}</code></pre>`);
    // inline code `...`
    s = s.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-[0.85em]">$1</code>');
    // bold **...**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic *...*
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // bullet lists
    s = s.replace(/(^|\n)[-•]\s(.+)/g, '$1<div class="flex gap-1.5 my-0.5"><span>•</span><span>$2</span></div>');
    // line breaks
    s = s.replace(/\n/g, "<br/>");
    return s;
  }, [content]);

  return (
    <div
      className={`text-sm leading-relaxed prose prose-sm max-w-none ${role === "user" ? "text-white" : "text-gray-800"}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

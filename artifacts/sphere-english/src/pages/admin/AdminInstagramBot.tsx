import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  RefreshCw,
  Loader2,
  AlertCircle,
  Bot,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  ChevronLeft,
  Power,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

interface Thread {
  id: number;
  ig_user_id: string;
  ig_username: string | null;
  ig_full_name: string | null;
  profile_pic_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_blocked: boolean;
  bot_enabled: boolean;
  escalated_at: string | null;
  escalation_reason: string | null;
}

interface Message {
  id: number;
  direction: "inbound" | "outbound";
  message_text: string | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  ai_model: string | null;
  ai_latency_ms: number | null;
  delivery_status: string;
  delivery_error: string | null;
  created_at: string;
  sent_at: string | null;
}

interface Stats {
  total_threads: number;
  active_24h: number;
  escalated: number;
  unread: number;
  dms_in_24h: number;
  dms_out_24h: number;
  comments_24h: number;
  comments_replied_24h: number;
  failed_24h: number;
  avg_latency_ms: number;
}

interface Comment {
  id: number;
  ig_comment_id: string;
  sender_username: string | null;
  comment_text: string | null;
  reply_text: string | null;
  ai_generated: boolean;
  reply_status: string;
  reply_error: string | null;
  skipped_reason: string | null;
  created_at: string;
  replied_at: string | null;
}

function fmtRelative(d: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk`;
  if (m < 1440) return `${Math.floor(m / 60)} sa`;
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function fmtFull(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminInstagramBot() {
  const [tab, setTab] = useState<"dms" | "comments">("dms");
  const [stats, setStats] = useState<Stats | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "escalated" | "bot_off">("all");
  const [search, setSearch] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [manualText, setManualText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function loadStats() {
    try {
      const data = await apiFetch("/admin/instagram-bot/overview");
      setStats(data.stats);
    } catch (e: any) {
      // sessizce geç
    }
  }

  async function loadThreads() {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
      const data = await apiFetch(`/admin/instagram-bot/threads?${params.toString()}`);
      setThreads(data.threads ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadComments() {
    try {
      const data = await apiFetch("/admin/instagram-bot/comments?limit=100");
      setComments(data.comments ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadThreadDetail(id: number) {
    try {
      const data = await apiFetch(`/admin/instagram-bot/threads/${id}`);
      setSelectedThread(data.thread);
      setMessages(data.messages ?? []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadThreads(), loadComments()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadThreads();
  }, [filter]);

  useEffect(() => {
    if (selectedThreadId) loadThreadDetail(selectedThreadId);
  }, [selectedThreadId]);

  // 20 sn auto-refresh
  useEffect(() => {
    const t = setInterval(() => {
      loadStats();
      loadThreads();
      if (selectedThreadId) loadThreadDetail(selectedThreadId);
      if (tab === "comments") loadComments();
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, tab, filter]);

  async function sendManual() {
    if (!selectedThreadId || !manualText.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/admin/instagram-bot/threads/${selectedThreadId}/send`, {
        method: "POST",
        body: JSON.stringify({ text: manualText.trim() }),
      });
      setManualText("");
      await loadThreadDetail(selectedThreadId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function toggleBot() {
    if (!selectedThread) return;
    try {
      await apiFetch(`/admin/instagram-bot/threads/${selectedThread.id}`, {
        method: "PATCH",
        body: JSON.stringify({ botEnabled: !selectedThread.bot_enabled }),
      });
      await loadThreadDetail(selectedThread.id);
      await loadThreads();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function clearEscalation() {
    if (!selectedThread) return;
    try {
      await apiFetch(`/admin/instagram-bot/threads/${selectedThread.id}`, {
        method: "PATCH",
        body: JSON.stringify({ clearEscalation: true, botEnabled: true }),
      });
      await loadThreadDetail(selectedThread.id);
      await loadThreads();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const filteredCount = useMemo(() => threads.length, [threads]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-7 h-7 text-pink-600" />
          <h1 className="text-2xl font-bold text-slate-900">Instagram Bot</h1>
        </div>
        <button
          onClick={() => {
            loadStats();
            loadThreads();
            loadComments();
            if (selectedThreadId) loadThreadDetail(selectedThreadId);
          }}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <RefreshCw size={14} /> Yenile
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        AI destekli Instagram DM & yorum cevaplama. 20 saniyede bir otomatik yenilenir.
      </p>

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Aktif Konuşma (24s)" value={stats.active_24h} icon={<MessageCircle size={16} />} color="pink" />
          <StatCard label="DM (24s)" value={`${stats.dms_in_24h}↓ / ${stats.dms_out_24h}↑`} icon={<Send size={16} />} color="sky" />
          <StatCard label="Yorum (24s)" value={`${stats.comments_24h} / ${stats.comments_replied_24h} cevap`} icon={<Sparkles size={16} />} color="violet" />
          <StatCard label="Eskalasyon" value={stats.escalated} icon={<AlertTriangle size={16} />} color={stats.escalated > 0 ? "amber" : "slate"} />
          <StatCard label="Ort. Cevap" value={`${stats.avg_latency_ms} ms`} icon={<Clock size={16} />} color="emerald" />
        </div>
      )}

      {/* ── Tab ── */}
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab("dms")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
            tab === "dms" ? "border-pink-600 text-pink-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          📩 DM Konuşmaları ({threads.length})
        </button>
        <button
          onClick={() => setTab("comments")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
            tab === "comments" ? "border-pink-600 text-pink-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          💬 Yorumlar ({comments.length})
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" /> Yükleniyor…
        </div>
      ) : tab === "dms" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Sol: Thread liste ── */}
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="p-3 border-b border-slate-100 space-y-2">
              <form
                onSubmit={(e) => { e.preventDefault(); loadThreads(); }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Kullanıcı / mesaj ara…"
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </form>
              <div className="flex gap-1 flex-wrap">
                {([
                  { key: "all", label: "Tümü" },
                  { key: "unread", label: "Okunmamış" },
                  { key: "escalated", label: "Eskalasyon" },
                  { key: "bot_off", label: "Bot Kapalı" },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      filter === f.key ? "bg-pink-100 text-pink-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
              {threads.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Henüz mesaj yok
                </div>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`w-full text-left p-3 hover:bg-slate-50 ${
                      selectedThreadId === t.id ? "bg-pink-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {t.profile_pic_url ? (
                        <img src={t.profile_pic_url} alt="" className="w-9 h-9 rounded-full" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                          {(t.ig_username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-sm text-slate-900 truncate flex items-center gap-1">
                            {t.ig_full_name || t.ig_username || t.ig_user_id.slice(0, 12)}
                            {t.escalated_at && <AlertTriangle size={11} className="text-amber-600" />}
                            {!t.bot_enabled && !t.escalated_at && <Ban size={11} className="text-slate-400" />}
                          </div>
                          {t.unread_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-bold">
                              {t.unread_count}
                            </span>
                          )}
                        </div>
                        {t.ig_username && t.ig_full_name && (
                          <div className="text-[11px] text-slate-500 truncate">@{t.ig_username}</div>
                        )}
                        <div className="text-xs text-slate-600 truncate mt-0.5">
                          {t.last_message_text ?? "—"}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {fmtRelative(t.last_message_at)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Sağ: Aktif konuşma ── */}
          <div className="lg:col-span-2">
            {!selectedThread ? (
              <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                Bir konuşma seç → mesajlar ve manuel cevap formu açılır
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl flex flex-col" style={{ height: "660px" }}>
                {/* Konuşma başlığı */}
                <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => setSelectedThreadId(null)} className="lg:hidden p-1 hover:bg-slate-100 rounded">
                      <ChevronLeft size={16} />
                    </button>
                    {selectedThread.profile_pic_url ? (
                      <img src={selectedThread.profile_pic_url} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                        {(selectedThread.ig_username ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {selectedThread.ig_full_name || selectedThread.ig_username || selectedThread.ig_user_id.slice(0, 12)}
                      </div>
                      {selectedThread.ig_username && (
                        <a
                          href={`https://instagram.com/${selectedThread.ig_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-pink-600 hover:underline"
                        >
                          @{selectedThread.ig_username}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedThread.escalated_at ? (
                      <button
                        onClick={clearEscalation}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200"
                        title={selectedThread.escalation_reason ?? ""}
                      >
                        <AlertTriangle size={11} /> Eskalasyon (Aç)
                      </button>
                    ) : (
                      <button
                        onClick={toggleBot}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold ${
                          selectedThread.bot_enabled
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                      >
                        <Power size={11} /> Bot {selectedThread.bot_enabled ? "Açık" : "Kapalı"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Mesaj listesi */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Manuel cevap formu */}
                <div className="p-3 border-t border-slate-200">
                  <form
                    onSubmit={(e) => { e.preventDefault(); sendManual(); }}
                    className="flex items-end gap-2"
                  >
                    <textarea
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Manuel cevap yaz (Enter ile gönder, Shift+Enter satır)"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendManual();
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !manualText.trim()}
                      className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center gap-1.5"
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Gönder
                    </button>
                  </form>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Manuel cevap gönderirsen bot devre dışı kalmaz. Botu kapatmak istersen "Bot Açık" toggle'a tıkla.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Yorumlar tab ── */
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {comments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                Henüz yorum yok
              </div>
            ) : (
              comments.map((c) => <CommentRow key={c.id} comment={c} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: JSX.Element;
  color: "pink" | "sky" | "violet" | "amber" | "emerald" | "slate";
}) {
  const colorMap: Record<string, string> = {
    pink: "bg-pink-50 text-pink-700 border-pink-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };
  return (
    <div className={`p-3 rounded-xl border ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
        {icon}
      </div>
      <div className="text-lg font-extrabold">{value}</div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isIn = message.direction === "inbound";
  const failed = message.delivery_status === "failed";
  return (
    <div className={`flex ${isIn ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[75%] ${isIn ? "" : "items-end"}`}>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isIn
              ? "bg-slate-100 text-slate-800 rounded-bl-md"
              : failed
                ? "bg-red-100 text-red-900 rounded-br-md border border-red-200"
                : "bg-gradient-to-br from-pink-500 to-violet-500 text-white rounded-br-md"
          }`}
        >
          {message.message_text}
        </div>
        <div className={`flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 ${isIn ? "" : "justify-end"}`}>
          {message.ai_generated && (
            <span className="inline-flex items-center gap-0.5 text-violet-600">
              <Bot size={10} /> AI
            </span>
          )}
          {message.ai_latency_ms && (
            <span>{message.ai_latency_ms}ms</span>
          )}
          {failed && <span className="text-red-600 inline-flex items-center gap-0.5"><XCircle size={10} /> Başarısız</span>}
          <span>{fmtFull(message.sent_at ?? message.created_at)}</span>
        </div>
        {failed && message.delivery_error && (
          <div className="mt-1 text-[10px] text-red-700 italic">
            {message.delivery_error}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  const statusBadge = () => {
    if (comment.reply_status === "sent")
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800"><CheckCircle2 size={10} /> Cevaplandı</span>;
    if (comment.reply_status === "skipped")
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600"><Ban size={10} /> Atlandı</span>;
    if (comment.reply_status === "failed")
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800"><XCircle size={10} /> Hata</span>;
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800"><Clock size={10} /> Bekliyor</span>;
  };

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <UserIcon size={12} className="text-slate-400" />
            <span className="font-bold text-sm text-slate-900">
              {comment.sender_username ? `@${comment.sender_username}` : comment.id}
            </span>
            <span className="text-[10px] text-slate-400">· {fmtRelative(comment.created_at)}</span>
          </div>
          <p className="text-sm text-slate-700 italic">"{comment.comment_text}"</p>
        </div>
        {statusBadge()}
      </div>

      {comment.reply_text && (
        <div className="mt-2 pl-4 border-l-2 border-pink-300 bg-pink-50/50 p-2 rounded">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-700 mb-0.5">
            <Bot size={11} /> Sphere Asistanı cevabı:
          </div>
          <p className="text-sm text-pink-900">{comment.reply_text}</p>
        </div>
      )}

      {comment.skipped_reason && (
        <div className="mt-2 text-[11px] text-slate-500 italic">
          ⏭ {comment.skipped_reason}
        </div>
      )}

      {comment.reply_error && (
        <div className="mt-2 text-[11px] text-red-700 italic">
          ⚠ {comment.reply_error}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  RefreshCw,
  Loader2,
  AlertCircle,
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  ChevronLeft,
  Power,
  Phone,
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
  wa_phone_number: string;
  wa_profile_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_blocked: boolean;
  bot_enabled: boolean;
  escalated_at: string | null;
  escalation_reason: string | null;
  first_seen_at: string;
}

interface Message {
  id: number;
  direction: "inbound" | "outbound";
  message_text: string | null;
  message_type: string | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  ai_model: string | null;
  ai_latency_ms: number | null;
  delivery_status: string | null;
  delivery_error: string | null;
  created_at: string;
  sent_at: string | null;
}

interface Stats {
  total_threads: number;
  active_24h: number;
  escalated: number;
  unread: number;
  msgs_in_24h: number;
  msgs_out_24h: number;
  failed_24h: number;
  avg_latency_ms: number;
}

interface SettingRow {
  key: string;
  value: string | null;
  updated_at: string;
}

export default function AdminWhatsAppBot() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "escalated" | "bot_off">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function loadStats() {
    try {
      const data = await apiFetch("/admin/whatsapp-bot/overview");
      setStats(data.stats);
    } catch (e: any) {
      console.error("stats load fail:", e);
    }
  }

  async function loadThreads() {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ filter, limit: "100" });
      if (search.trim()) qs.set("search", search.trim());
      const data = await apiFetch(`/admin/whatsapp-bot/threads?${qs.toString()}`);
      setThreads(data.threads ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadThreadDetail(id: number) {
    try {
      const data = await apiFetch(`/admin/whatsapp-bot/threads/${id}`);
      setSelectedThread(data.thread);
      setMessages(data.messages ?? []);
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)),
      );
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadSettings() {
    try {
      const data = await apiFetch("/admin/whatsapp-bot/settings");
      setSettings(data.settings ?? []);
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadStats();
    loadThreads();
    loadSettings();
    const interval = setInterval(() => {
      loadStats();
      loadThreads();
      if (selectedId) loadThreadDetail(selectedId);
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (selectedId) loadThreadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const t = setTimeout(loadThreads, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function sendManual() {
    if (!selectedId || !composeText.trim()) return;
    try {
      setSending(true);
      await apiFetch(`/admin/whatsapp-bot/threads/${selectedId}/send`, {
        method: "POST",
        body: JSON.stringify({ text: composeText.trim() }),
      });
      setComposeText("");
      await loadThreadDetail(selectedId);
      await loadStats();
      await loadThreads();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function patchThread(updates: any) {
    if (!selectedId) return;
    try {
      await apiFetch(`/admin/whatsapp-bot/threads/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await loadThreadDetail(selectedId);
      await loadThreads();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function updateSetting(key: string, value: string) {
    try {
      await apiFetch("/admin/whatsapp-bot/settings", {
        method: "PATCH",
        body: JSON.stringify({ key, value }),
      });
      await loadSettings();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const botGlobalEnabled = useMemo(
    () => settings.find((s) => s.key === "bot_enabled")?.value === "true",
    [settings],
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
            <Phone size={26} /> WhatsApp Bot
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ezgi karakteriyle WhatsApp DM cevaplama. 20 saniyede bir otomatik yenilenir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadStats();
              loadThreads();
              if (selectedId) loadThreadDetail(selectedId);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm"
          >
            <RefreshCw size={14} /> Yenile
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm ${
              showSettings
                ? "bg-emerald-600 text-white"
                : "bg-white border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ShieldCheck size={14} /> Ayarlar
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
          <span className="text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <StatCard label="Toplam Sohbet" value={stats.total_threads} icon={<MessageCircle size={16} />} color="emerald" />
          <StatCard label="Son 24s Aktif" value={stats.active_24h} icon={<Clock size={16} />} color="blue" />
          <StatCard label="Okunmamış" value={stats.unread} icon={<AlertCircle size={16} />} color="amber" />
          <StatCard label="Eskalasyon" value={stats.escalated} icon={<AlertTriangle size={16} />} color="red" />
          <StatCard label="Mesaj (24s)" value={`${stats.msgs_in_24h}↓ / ${stats.msgs_out_24h}↑`} icon={<Send size={16} />} color="sky" />
          <StatCard label="Başarısız (24s)" value={stats.failed_24h} icon={<XCircle size={16} />} color="rose" />
          <StatCard label="Ort. AI Süre" value={`${stats.avg_latency_ms}ms`} icon={<Sparkles size={16} />} color="violet" />
        </div>
      )}

      {showSettings && (
        <div className="mb-4 p-4 bg-white border border-slate-200 rounded-lg">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck size={16} /> Bot Ayarları
          </h3>
          <div className="space-y-2">
            <SettingToggle
              label="Bot küresel aktif"
              currentValue={botGlobalEnabled}
              onChange={(v) => updateSetting("bot_enabled", v ? "true" : "false")}
            />
            <SettingToggle
              label="DM mesajlarını otomatik cevapla"
              currentValue={settings.find((s) => s.key === "reply_to_dms")?.value === "true"}
              onChange={(v) => updateSetting("reply_to_dms", v ? "true" : "false")}
            />
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              Persona: <strong>Ezgi</strong> · Ton: <strong>samimi-pazarlama uzmanı</strong>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 min-h-[600px]">
        {/* Sol: thread listesi */}
        <div className="col-span-12 md:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Telefon, isim, mesaj ara…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-1 text-xs">
              {(["all", "unread", "escalated", "bot_off"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 px-2 py-1 rounded ${
                    filter === f ? "bg-emerald-100 text-emerald-700 font-medium" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {f === "all" ? "Tümü" : f === "unread" ? "Yeni" : f === "escalated" ? "Eskalasyon" : "Bot Off"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[700px]">
            {loading && threads.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-slate-400" size={20} />
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-40" />
                Henüz mesaj yok
              </div>
            ) : (
              threads.map((t) => (
                <ThreadListItem
                  key={t.id}
                  thread={t}
                  selected={selectedId === t.id}
                  onClick={() => setSelectedId(t.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Sağ: sohbet detay */}
        <div className="col-span-12 md:col-span-8 bg-white border border-slate-200 rounded-lg flex flex-col">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-3 py-12">
              <Phone size={48} className="opacity-30" />
              <p>Bir sohbet seç</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-slate-100 flex items-center gap-3">
                <button
                  onClick={() => setSelectedId(null)}
                  className="md:hidden text-slate-500"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-semibold">
                  {(selectedThread.wa_profile_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {selectedThread.wa_profile_name ?? selectedThread.wa_phone_number}
                    </h2>
                    {selectedThread.escalated_at && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                        ESKALASYON
                      </span>
                    )}
                    {!selectedThread.bot_enabled && !selectedThread.escalated_at && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        BOT OFF
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    📱 {selectedThread.wa_phone_number}
                    {selectedThread.escalation_reason && (
                      <span className="text-red-600 ml-2">· {selectedThread.escalation_reason}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => patchThread({ botEnabled: !selectedThread.bot_enabled })}
                    className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                      selectedThread.bot_enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Power size={12} /> Bot {selectedThread.bot_enabled ? "Aç" : "Kpl"}
                  </button>
                  {selectedThread.escalated_at && (
                    <button
                      onClick={() => patchThread({ clearEscalation: true, botEnabled: true })}
                      className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
                    >
                      Eskalasyon Kaldır
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 min-h-[400px] max-h-[600px]">
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-slate-400 py-8">Mesaj yok</div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <textarea
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        sendManual();
                      }
                    }}
                    placeholder={
                      selectedThread.escalated_at
                        ? "Eskalasyon aktif — manuel cevap için yaz…"
                        : "Manuel cevap yaz… (Ctrl+Enter ile gönder)"
                    }
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  />
                  <button
                    onClick={sendManual}
                    disabled={sending || !composeText.trim()}
                    className="px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  </button>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Manuel cevap göndersen bile bot bir sonraki gelen mesaja otomatik cevap verir
                  (kapatmak için sağ üst Bot Kpl).
                </div>
              </div>
            </>
          )}
        </div>
      </div>
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
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <div className={`border rounded-lg p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80 mb-1">
        {icon} {label}
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function ThreadListItem({
  thread,
  selected,
  onClick,
}: {
  thread: Thread;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-slate-50 hover:bg-slate-50 ${
        selected ? "bg-emerald-50 border-emerald-100" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-semibold flex-shrink-0">
          {(thread.wa_profile_name ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-medium text-sm truncate">
              {thread.wa_profile_name ?? thread.wa_phone_number}
            </span>
            {thread.unread_count > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 rounded-full font-semibold">
                {thread.unread_count}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {thread.last_message_text ?? "—"}
          </div>
          <div className="flex items-center gap-1 mt-1">
            {thread.escalated_at && (
              <span className="text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded">
                ESKALASYON
              </span>
            )}
            {!thread.bot_enabled && !thread.escalated_at && (
              <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded">
                BOT OFF
              </span>
            )}
            <span className="text-[10px] text-slate-400 ml-auto">
              {fmtRelative(thread.last_message_at ?? thread.first_seen_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const inbound = message.direction === "inbound";
  const statusIcon =
    message.delivery_status === "sent" || message.delivery_status === "delivered" || message.delivery_status === "read" ? (
      <CheckCircle2 size={11} className="text-emerald-300" />
    ) : message.delivery_status === "failed" ? (
      <XCircle size={11} className="text-red-300" />
    ) : (
      <Clock size={11} className="text-emerald-200" />
    );

  return (
    <div className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
          inbound
            ? "bg-white border border-slate-200 text-slate-800"
            : "bg-emerald-600 text-white"
        }`}
      >
        {!inbound && message.ai_generated && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-100 mb-1">
            <Bot size={10} /> Ezgi AI
            {message.ai_latency_ms && <span>· {message.ai_latency_ms}ms</span>}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.message_text || (message.message_type ? `[${message.message_type}]` : "—")}
        </div>
        <div
          className={`text-[10px] mt-1 flex items-center gap-1 ${
            inbound ? "text-slate-400 justify-start" : "text-emerald-100 justify-end"
          }`}
        >
          {!inbound && statusIcon}
          {fmtTime(message.created_at)}
          {message.delivery_error && !inbound && (
            <span className="text-red-200">· {message.delivery_error.slice(0, 30)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  currentValue,
  onChange,
}: {
  label: string;
  currentValue: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => onChange(!currentValue)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          currentValue ? "bg-emerald-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
            currentValue ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function fmtTime(dt: string): string {
  return new Date(dt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(dt: string): string {
  const d = new Date(dt);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "şimdi";
  if (diffMin < 60) return `${diffMin}dk`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}sa`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}g`;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
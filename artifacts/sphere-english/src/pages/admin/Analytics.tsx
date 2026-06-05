import { useState, useEffect, useMemo } from "react";
import {
  Activity, Users, Clock, TrendingUp, RefreshCw, Search, ChevronRight,
  X, Calendar, BarChart3,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const TOKEN_KEY = "sphere_token";

function getApiBase() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base.replace("/sphere-english", "/api-server");
}

async function apiFetch<T = any>(path: string): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

interface Summary {
  from: string;
  to: string;
  activeUsers: number;
  totalMinutes: number;
  avgMinutesPerUser: number;
  topModule: { module: string; minutes: number } | null;
}

interface UserDailyItem {
  userId: number;
  name: string;
  email: string;
  role: string;
  level: string | null;
  studentNumber: string | null;
  totalMinutes: number;
  activeDays: number;
  lastActive: string;
}

interface UserDailyResponse {
  from: string;
  to: string;
  total: number;
  items: UserDailyItem[];
}

interface TrendPoint {
  date: string;
  minutes: number;
  activeUsers: number;
}

interface UserDetail {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    level: string | null;
    studentNumber: string | null;
    createdAt: string;
  };
  from: string;
  to: string;
  totalMinutes: number;
  activeDays: number;
  modules: { module: string; minutes: number }[];
  daily: { date: string; minutes: number }[];
}

// ─── Modül adlarını Türkçe etiketle ───────────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
  pronunciation: "Telaffuz Koçu",
  writing: "Yazma Koçu",
  grammar: "Dilbilgisi Koçu",
  vocab: "Kelime Oyunu",
  simulation: "İş Senaryoları",
  interview: "Mülakat Sim.",
  presentation: "Sunum Sim.",
  "ai-quiz": "Akıllı Quiz",
  "ai-tutor": "Kişisel Tutor",
  "learning-path": "Öğrenme Yolu",
  "level-exam": "Seviye Sınavı",
  materials: "Materyaller",
  courses: "Kurslar",
  "speaking-club": "Speaking Club",
  "live-class": "Canlı Ders",
  quizzes: "Alıştırmalar",
  forum: "Forum",
  messages: "Mesajlar",
  subscription: "Abonelik",
  dashboard: "Dashboard",
  leaderboard: "Sıralama",
  progress: "İlerleme",
  certificates: "Sertifikalar",
  "placement-test": "Seviye Tespit",
  "teacher-area": "Öğretmen Paneli",
  "admin-area": "Admin Paneli",
  "corporate-area": "Kurumsal Panel",
  general: "Diğer",
};

function labelFor(m: string): string {
  return MODULE_LABELS[m] ?? m;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} dk`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "az önce";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk önce`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa önce`;
  return `${Math.floor(seconds / 86400)} gün önce`;
}

// Renk paleti — modül kırılımı pie chart için
const COLORS = [
  "#0ea5e9", "#1B365D", "#f59e0b", "#10b981", "#8b5cf6",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#ec4899",
  "#6366f1", "#14b8a6", "#a855f7", "#eab308", "#22c55e",
];

// ─── Tarih yardımcıları ───────────────────────────────────────────────────
function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Hızlı tarih seçenekleri ─────────────────────────────────────────────
const DATE_PRESETS = [
  { label: "Bugün", from: () => todayUtc(), to: () => todayUtc() },
  { label: "Son 7 gün", from: () => dateNDaysAgo(6), to: () => todayUtc() },
  { label: "Son 30 gün", from: () => dateNDaysAgo(29), to: () => todayUtc() },
  { label: "Son 90 gün", from: () => dateNDaysAgo(89), to: () => todayUtc() },
];

// ────────────────────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [from, setFrom] = useState<string>(dateNDaysAgo(6));
  const [to, setTo] = useState<string>(todayUtc());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [users, setUsers] = useState<UserDailyItem[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sayfa açıldığında ve tarih/filtre değişince veriyi çek
  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      if (search) qs.set("q", search);
      if (roleFilter) qs.set("role", roleFilter);
      qs.set("limit", "100");

      const [s, u, t] = await Promise.all([
        apiFetch<Summary>(`/api/admin/analytics/summary?${new URLSearchParams({ from, to })}`),
        apiFetch<UserDailyResponse>(`/api/admin/analytics/users-daily?${qs}`),
        apiFetch<{ daily: TrendPoint[] }>(
          `/api/admin/analytics/trend?${new URLSearchParams({ from, to })}`,
        ),
      ]);
      setSummary(s);
      setUsers(u.items);
      setTotalUsers(u.total);
      setTrend(t.daily);
    } catch (e: any) {
      setError(e.message || "Veri alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, roleFilter]);

  // Search debouncing — kullanıcı yazınca her tuşa istek atmamak için
  useEffect(() => {
    const t = setTimeout(() => loadAll(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openUserDetail = async (userId: number) => {
    setSelectedUser(null);
    setDetailLoading(true);
    try {
      const data = await apiFetch<UserDetail>(
        `/api/admin/analytics/user-detail/${userId}?${new URLSearchParams({ from, to })}`,
      );
      setSelectedUser(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const pieData = useMemo(() => {
    if (!selectedUser) return [];
    return selectedUser.modules.map((m, i) => ({
      name: labelFor(m.module),
      value: m.minutes,
      color: COLORS[i % COLORS.length],
    }));
  }, [selectedUser]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={26} className="text-blue-600" />
            Aktivite Analizi
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kullanıcıların günlük, haftalık ve aylık uygulamada geçirdiği zamanlar
          </p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Yenile
        </button>
      </div>

      {/* Hızlı tarih seçenekleri + custom tarih */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setFrom(p.from()); setTo(p.to()); }}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                from === p.from() && to === p.to()
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-gray-200 hidden sm:block" />
        <div className="flex items-center gap-2 text-sm">
          <Calendar size={14} className="text-gray-400" />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Users size={20} />}
          label="Aktif Kullanıcı"
          value={summary?.activeUsers ?? 0}
          color="blue"
          loading={loading}
        />
        <SummaryCard
          icon={<Clock size={20} />}
          label="Toplam Süre"
          value={formatMinutes(summary?.totalMinutes ?? 0)}
          color="cyan"
          loading={loading}
        />
        <SummaryCard
          icon={<TrendingUp size={20} />}
          label="Ortalama (kullanıcı başına)"
          value={formatMinutes(summary?.avgMinutesPerUser ?? 0)}
          color="emerald"
          loading={loading}
        />
        <SummaryCard
          icon={<BarChart3 size={20} />}
          label="En Aktif Modül"
          value={summary?.topModule ? labelFor(summary.topModule.module) : "—"}
          sub={summary?.topModule ? formatMinutes(summary.topModule.minutes) : ""}
          color="amber"
          loading={loading}
        />
      </div>

      {/* Trend grafiği */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Günlük Trend</h3>
        <p className="text-xs text-gray-500 mb-4">
          Seçili aralıkta günlük toplam dakika + aktif kullanıcı sayısı
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                formatter={(val: any, name: any) => {
                  if (name === "minutes") return [formatMinutes(val as number), "Toplam Süre"];
                  if (name === "activeUsers") return [val, "Aktif Kullanıcı"];
                  return val;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="minutes"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                name="Toplam Süre (dk)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="activeUsers"
                stroke="#1B365D"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2 }}
                name="Aktif Kullanıcı"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Kullanıcı listesi */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Kullanıcılar</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalUsers} aktif kullanıcı · seçili aralıkta en çok süre harcayan üstte
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="">Tüm Roller</option>
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
              <option value="admin">Admin</option>
              <option value="corporate">Kurumsal</option>
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Ad, e-posta…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-48"
              />
            </div>
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Yükleniyor…</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            Bu aralıkta aktif kullanıcı yok.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <button
                key={u.userId}
                onClick={() => openUserDetail(u.userId)}
                className="w-full px-5 py-3 hover:bg-gray-50 transition flex items-center gap-4 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-semibold flex-shrink-0 text-sm">
                  {(u.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm truncate">{u.name || u.email}</p>
                    {u.level && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {u.level}
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">{u.role}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-sm">{formatMinutes(u.totalMinutes)}</p>
                  <p className="text-[11px] text-gray-400">{u.activeDays} aktif gün · son: {formatRelativeTime(u.lastActive)}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detay modal */}
      {(selectedUser || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="p-12 text-center text-gray-400 text-sm">Yükleniyor…</div>
            ) : selectedUser ? (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedUser.user.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedUser.user.email} · {selectedUser.user.role}
                      {selectedUser.user.level ? ` · ${selectedUser.user.level}` : ""}
                      {selectedUser.user.studentNumber ? ` · #${selectedUser.user.studentNumber}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Üst kartlar */}
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Toplam Süre</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatMinutes(selectedUser.totalMinutes)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Aktif Gün</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{selectedUser.activeDays}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Ort. Günlük</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {selectedUser.activeDays > 0
                        ? formatMinutes(Math.round(selectedUser.totalMinutes / selectedUser.activeDays))
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Modül dağılımı pie */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Modül Dağılımı</h4>
                    {pieData.length === 0 ? (
                      <p className="text-xs text-gray-400">Veri yok.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={75}
                              innerRadius={35}
                              label={(d: any) => `${d.name} (${formatMinutes(d.value)})`}
                              labelLine={false}
                              fontSize={10}
                            >
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val: any, name: any) => [formatMinutes(val as number), name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Günlük seri */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Günlük Süre</h4>
                    {selectedUser.daily.length === 0 ? (
                      <p className="text-xs text-gray-400">Veri yok.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={selectedUser.daily}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                            <Tooltip formatter={(val: any) => formatMinutes(val as number)} />
                            <Line
                              type="monotone"
                              dataKey="minutes"
                              stroke="#0ea5e9"
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modül listesi tablo */}
                <div className="px-5 pb-5">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Modül Detayı</h4>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 border border-gray-100">
                    {selectedUser.modules.length === 0 ? (
                      <p className="p-3 text-xs text-gray-400 text-center">Veri yok.</p>
                    ) : (
                      selectedUser.modules.map((m, i) => (
                        <div key={m.module} className="px-3 py-2 flex items-center gap-3">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          <p className="flex-1 text-sm text-gray-700">{labelFor(m.module)}</p>
                          <p className="text-sm font-semibold text-gray-900">{formatMinutes(m.minutes)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Yardımcı: özet kartı ─────────────────────────────────────────────────
function SummaryCard({
  icon, label, value, sub, color, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: "blue" | "cyan" | "emerald" | "amber" | "purple";
  loading: boolean;
}) {
  const palette = {
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
    amber: { bg: "bg-amber-50", text: "text-amber-600" },
    purple: { bg: "bg-purple-50", text: "text-purple-600" },
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl ${palette.bg} ${palette.text} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">{label}</p>
        <p className={`text-xl font-bold text-gray-900 mt-1 ${loading ? "opacity-50" : ""} truncate`}>
          {value}
        </p>
        {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

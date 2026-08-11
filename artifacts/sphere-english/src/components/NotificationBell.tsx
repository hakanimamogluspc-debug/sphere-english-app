import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Check, X, Award, Flame, Calendar, TrendingUp, Sparkles, Loader2, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

const TOKEN_KEY = "sphere_token";
const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  actionUrl: string | null;
  iconKind: string;
  priority: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  bell: Bell,
  award: Award,
  flame: Flame,
  calendar: Calendar,
  "trending-up": TrendingUp,
  sparkles: Sparkles,
};

const COLOR_BY_KIND: Record<string, { bg: string; text: string; ring: string }> = {
  streak_risk: { bg: "bg-orange-50", text: "text-orange-600", ring: "ring-orange-200" },
  inactivity_3d: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200" },
  inactivity_7d: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200" },
  new_assessment: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200" },
  level_up: { bg: "bg-purple-50", text: "text-purple-600", ring: "ring-purple-200" },
  new_quiz: { bg: "bg-cyan-50", text: "text-cyan-600", ring: "ring-cyan-200" },
  weekly_digest: { bg: "bg-slate-50", text: "text-slate-600", ring: "ring-slate-200" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "az önce";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const res = await fetch(`${API}/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setHasFetched(true);
    } catch {
      /* swallow */
    }
  }, []);

  // Initial poll + interval
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refetch when opening
  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [open, fetchNotifications]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await fetch(`${API}/notifications/mark-all-read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      /* swallow */
    }
  };

  const markRead = async (id: number) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await fetch(`${API}/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* swallow */
    }
  };

  const deleteOne = async (id: number) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const wasUnread = notifications.find((n) => n.id === id)?.readAt == null;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`${API}/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* swallow */
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full hover:bg-secondary/60 transition-colors"
        aria-label="Bildirimler"
      >
        <Bell className="h-5 w-5 text-foreground/80" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Bildirimler</h3>
                {unreadCount > 0 && (
                  <p className="text-[11px] text-gray-500">{unreadCount} okunmamış</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50"
                  >
                    Tümünü okundu yap
                  </button>
                )}
                <Link
                  href="/student/settings"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  title="Bildirim ayarları"
                >
                  <Settings size={14} />
                </Link>
              </div>
            </div>

            <div className="max-h-[440px] overflow-y-auto">
              {loading && !hasFetched && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                    <Bell className="h-5 w-5 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Henüz bildirim yok</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Yeni AI raporun veya seri uyarın olduğunda burada görünecek.
                  </p>
                </div>
              )}

              {notifications.map((n) => {
                const Icon = ICON_MAP[n.iconKind] || Bell;
                const colors = COLOR_BY_KIND[n.kind] || { bg: "bg-gray-50", text: "text-gray-600", ring: "ring-gray-200" };
                const isUnread = !n.readAt;
                const Wrapper: any = n.actionUrl ? "a" : "div";
                return (
                  <Wrapper
                    key={n.id}
                    href={n.actionUrl || undefined}
                    onClick={() => {
                      if (isUnread) markRead(n.id);
                      if (n.actionUrl) setOpen(false);
                    }}
                    className={`group block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                      isUnread ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center ring-1 ${colors.ring}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                            {n.title}
                          </p>
                          {isUnread && <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{n.body}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[10px] text-gray-400">{timeAgo(n.createdAt)}</p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isUnread && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  markRead(n.id);
                                }}
                                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100"
                                title="Okundu işaretle"
                              >
                                <Check size={12} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteOne(n.id);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-100"
                              title="Sil"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Wrapper>
                );
              })}
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
                <Link
                  href="/student/settings"
                  onClick={() => setOpen(false)}
                  className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
                >
                  <Settings size={11} />
                  Bildirim tercihlerini yönet
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

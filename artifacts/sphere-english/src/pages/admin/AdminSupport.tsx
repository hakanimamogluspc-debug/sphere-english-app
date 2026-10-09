import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Badge } from "@/components/ui/core";
import {
  LifeBuoy, Bug, Lightbulb, HelpCircle, HelpCircle as OtherIcon,
  Clock, PlayCircle, CheckCircle2, XCircle, Send, Lock, User as UserIcon,
} from "lucide-react";

type Status = "open" | "in_progress" | "resolved" | "closed";
type Kind = "bug" | "feature" | "question" | "other";
type Severity = "low" | "normal" | "high" | "critical";

interface TicketListItem {
  id: number;
  userId: number | null;
  kind: Kind;
  status: Status;
  severity: Severity;
  title: string;
  createdAt: string;
  updatedAt: string;
  user: { id: number; firstName: string; lastName: string; email: string } | null;
}

interface Message {
  id: number;
  ticketId: number;
  authorId: number | null;
  body: string;
  isInternal: number;
  createdAt: string;
  author: { id: number; firstName: string; lastName: string; role: string } | null;
}

interface TicketDetail {
  ticket: {
    id: number;
    userId: number | null;
    assignedToId: number | null;
    kind: Kind;
    status: Status;
    severity: Severity;
    title: string;
    body: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
  };
  messages: Message[];
}

const KIND_META: Record<Kind, { label: string; Icon: any; color: string }> = {
  bug: { label: "Hata", Icon: Bug, color: "text-red-600 bg-red-50" },
  feature: { label: "Öneri", Icon: Lightbulb, color: "text-amber-600 bg-amber-50" },
  question: { label: "Soru", Icon: HelpCircle, color: "text-blue-600 bg-blue-50" },
  other: { label: "Diğer", Icon: OtherIcon, color: "text-slate-600 bg-slate-50" },
};

const STATUS_META: Record<Status, { label: string; Icon: any; color: string }> = {
  open: { label: "Açık", Icon: Clock, color: "text-amber-600 bg-amber-50" },
  in_progress: { label: "İnceleniyor", Icon: PlayCircle, color: "text-blue-600 bg-blue-50" },
  resolved: { label: "Çözüldü", Icon: CheckCircle2, color: "text-green-600 bg-green-50" },
  closed: { label: "Kapandı", Icon: XCircle, color: "text-slate-600 bg-slate-50" },
};

async function apiJson(path: string, init?: RequestInit) {
  const token = localStorage.getItem("sphere_token");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Hata" }));
    throw new Error(data.error || "Hata");
  }
  return res.json();
}

export default function AdminSupport() {
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [kindFilter, setKindFilter] = useState<Kind | "">("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  if (kindFilter) queryParams.set("kind", kindFilter);
  if (search.trim()) queryParams.set("q", search.trim());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter, kindFilter, search],
    queryFn: () => apiJson(`/api/admin/support/tickets?${queryParams.toString()}`),
  });

  const { data: statsData } = useQuery({
    queryKey: ["admin-support-stats"],
    queryFn: () => apiJson("/api/admin/support/stats"),
  });

  const tickets: TicketListItem[] = data?.tickets ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-primary" />
          Destek Talepleri
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Kullanıcı bildirimleri, hata raporları ve öneriler</p>
      </div>

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsData.byStatus.map((s: any) => {
            const meta = STATUS_META[s.status as Status];
            if (!meta) return null;
            const Icon = meta.Icon;
            return (
              <Card key={s.status} className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${meta.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="text-xl font-bold">{s.count}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Başlıkta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "")}
            className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tüm durumlar</option>
            <option value="open">Açık</option>
            <option value="in_progress">İnceleniyor</option>
            <option value="resolved">Çözüldü</option>
            <option value="closed">Kapandı</option>
          </select>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as Kind | "")}
            className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tüm türler</option>
            <option value="bug">Hata</option>
            <option value="feature">Öneri</option>
            <option value="question">Soru</option>
            <option value="other">Diğer</option>
          </select>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="p-12 text-center">
          <LifeBuoy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Henüz destek talebi yok</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const kindMeta = KIND_META[t.kind];
            const statusMeta = STATUS_META[t.status];
            const KindIcon = kindMeta.Icon;
            const StatusIcon = statusMeta.Icon;
            return (
              <Card
                key={t.id}
                className="p-4 cursor-pointer hover:border-primary/30 transition-colors border-2 border-border"
                onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${kindMeta.color}`}>
                    <KindIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.user ? `${t.user.firstName} ${t.user.lastName}` : "Anonim"}
                      {" · "}
                      {new Date(t.createdAt).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.severity === "critical" && <Badge variant="destructive">Kritik</Badge>}
                    {t.severity === "high" && <Badge className="bg-orange-100 text-orange-700">Yüksek</Badge>}
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1 ${statusMeta.color}`}>
                      <StatusIcon className="h-3 w-3" /> {statusMeta.label}
                    </span>
                  </div>
                </div>

                {selectedId === t.id && (
                  <TicketDetailView ticketId={t.id} onChange={() => refetch()} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketDetailView({ ticketId, onChange }: { ticketId: number; onChange: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<TicketDetail>({
    queryKey: ["admin-support-ticket", ticketId],
    queryFn: () => apiJson(`/api/support/tickets/${ticketId}`),
  });

  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const patchMut = useMutation({
    mutationFn: (patch: Partial<{ status: Status; severity: Severity }>) =>
      apiJson(`/api/admin/support/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      refetch();
      onChange();
      qc.invalidateQueries({ queryKey: ["admin-support-stats"] });
    },
  });

  const sendMut = useMutation({
    mutationFn: (payload: { body: string; isInternal: boolean }) =>
      apiJson(`/api/support/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setReply("");
      setIsInternal(false);
      refetch();
      onChange();
    },
  });

  if (isLoading) return <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">Yükleniyor...</div>;
  if (!data) return null;

  const { ticket, messages } = data;

  return (
    <div className="mt-4 pt-4 border-t space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Admin controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={ticket.status}
          onChange={(e) => patchMut.mutate({ status: e.target.value as Status })}
          className="text-xs px-2 py-1 border border-border rounded-lg bg-background"
        >
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={ticket.severity}
          onChange={(e) => patchMut.mutate({ severity: e.target.value as Severity })}
          className="text-xs px-2 py-1 border border-border rounded-lg bg-background"
        >
          <option value="low">Düşük</option>
          <option value="normal">Normal</option>
          <option value="high">Yüksek</option>
          <option value="critical">Kritik</option>
        </select>
      </div>

      {/* Original body */}
      <div className="bg-secondary/40 rounded-lg p-3">
        <p className="text-sm whitespace-pre-wrap">{ticket.body}</p>
      </div>

      {/* Metadata */}
      {ticket.metadata && Object.keys(ticket.metadata).length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Teknik bilgi</summary>
          <pre className="mt-2 p-2 bg-secondary/40 rounded overflow-auto text-[11px]">
            {JSON.stringify(ticket.metadata, null, 2)}
          </pre>
        </details>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Yazışmalar</p>
          {messages.map((m) => {
            const isAdminMsg = m.author?.role === "admin";
            return (
              <div
                key={m.id}
                className={`p-3 rounded-lg text-sm ${
                  m.isInternal ? "bg-amber-50 border border-amber-200" :
                  isAdminMsg ? "bg-primary/5 border border-primary/20" :
                  "bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {m.isInternal && <Lock className="h-3 w-3 text-amber-600" />}
                    <UserIcon className="h-3 w-3" />
                    {m.author ? `${m.author.firstName} ${m.author.lastName}` : "Sistem"}
                    {isAdminMsg && <span className="text-primary">(Admin)</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString("tr-TR")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply */}
      <div className="space-y-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Yanıt yaz..."
          rows={3}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
        />
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
            />
            <Lock className="h-3 w-3" />
            Dahili not (kullanıcı görmez)
          </label>
          <button
            type="button"
            onClick={() => reply.trim() && sendMut.mutate({ body: reply.trim(), isInternal })}
            disabled={!reply.trim() || sendMut.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {sendMut.isPending ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}

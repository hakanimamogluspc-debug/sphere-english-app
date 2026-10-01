import { useEffect, useState } from "react";
import { API } from "@/lib/api-url";
import { Card, CardContent, Button, Input, Label } from "@/components/ui/core";
import {
  CreditCard, AlertCircle, CheckCircle2, X, RefreshCcw, Receipt, Filter, Eye,
} from "lucide-react";

const TOKEN_KEY = "sphere_token";

async function api(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as any)?.error || `HTTP ${res.status}`);
  return d;
}

interface Payment {
  id: number;
  userId: number;
  userEmail: string | null;
  userName: string | null;
  eventType: string;
  status: string;
  amount: string | null;
  currency: string;
  providerPaymentId: string | null;
  providerConversationId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ event_type: "", status: "success", user_id: "" });
  const [refundModal, setRefundModal] = useState<Payment | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (filters.event_type) params.set("event_type", filters.event_type);
    if (filters.status) params.set("status", filters.status);
    if (filters.user_id) params.set("user_id", filters.user_id);
    api(`/admin/payments?${params}`)
      .then(d => { setPayments(d.items || []); setTotal(d.total || 0); })
      .catch(e => showToast(e?.message || "Yükleme hatası", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const fmtTry = (amount: string | null) => {
    if (!amount) return "—";
    return `₺${Number(amount).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtDate = (iso: string) => {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: "bg-emerald-100 text-emerald-700",
      failed: "bg-red-100 text-red-700",
      pending: "bg-amber-100 text-amber-700",
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${map[status] || "bg-slate-100 text-slate-600"}`}>
        {status}
      </span>
    );
  };

  const eventBadge = (type: string) => {
    const map: Record<string, { label: string; color: string }> = {
      checkout_success: { label: "Ödeme", color: "bg-blue-100 text-blue-700" },
      checkout_failed: { label: "Fail", color: "bg-red-100 text-red-700" },
      subscription_charged: { label: "Yenileme", color: "bg-purple-100 text-purple-700" },
      refund: { label: "İade", color: "bg-amber-100 text-amber-700" },
      webhook_received: { label: "Webhook", color: "bg-slate-100 text-slate-600" },
    };
    const m = map[type] || { label: type, color: "bg-slate-100 text-slate-600" };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${m.color}`}>
        {m.label}
      </span>
    );
  };

  const canRefund = (p: Payment) =>
    p.status === "success" && (p.eventType === "checkout_success" || p.eventType === "subscription_charged");

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#1e3a6e] flex items-center gap-2">
          <CreditCard className="h-8 w-8 text-[#13a9e0]" />
          Ödeme Yönetimi
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Tüm Iyzico ödemeleri + iade işlemleri
        </p>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Durum</Label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Tümü</option>
              <option value="success">Başarılı</option>
              <option value="failed">Başarısız</option>
              <option value="pending">Beklemede</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Olay Tipi</Label>
            <select
              value={filters.event_type}
              onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Tümü</option>
              <option value="checkout_success">İlk Ödeme</option>
              <option value="subscription_charged">Yenileme</option>
              <option value="refund">İade</option>
              <option value="checkout_failed">Başarısız Deneme</option>
              <option value="webhook_received">Webhook</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Kullanıcı ID</Label>
            <Input
              placeholder="örn. 42"
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
            />
          </div>
          <Button variant="outline" onClick={load} className="shrink-0">
            <RefreshCcw size={14} className="mr-1" /> Yenile
          </Button>
        </CardContent>
      </Card>

      {/* Toplam */}
      <div className="text-xs text-slate-500">
        Toplam: <strong>{total}</strong> kayıt · Gösterilen: <strong>{payments.length}</strong>
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Yükleniyor…</div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600 font-semibold">Kayıt yok</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs uppercase font-bold text-slate-500">
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Iyzico ID</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[#1e3a6e] text-xs">{p.userName || p.userEmail || `User #${p.userId}`}</div>
                    <div className="text-[10px] text-slate-500">{p.userEmail}</div>
                  </td>
                  <td className="px-3 py-2">{eventBadge(p.eventType)}</td>
                  <td className="px-3 py-2 font-bold text-[#1e3a6e] whitespace-nowrap">
                    {p.eventType === "refund" ? `-${fmtTry(p.amount)}` : fmtTry(p.amount)}
                  </td>
                  <td className="px-3 py-2">{statusBadge(p.status)}</td>
                  <td className="px-3 py-2 text-[10px] font-mono text-slate-500">
                    {p.providerPaymentId?.slice(0, 12) || "—"}
                    {p.errorMessage && (
                      <div className="text-red-500 mt-1 max-w-[200px] truncate" title={p.errorMessage}>
                        {p.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canRefund(p) && (
                      <button
                        onClick={() => setRefundModal(p)}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-bold uppercase tracking-wider px-2 py-1 rounded border border-amber-300 hover:bg-amber-50"
                      >
                        İade Et
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {refundModal && (
        <RefundModal
          payment={refundModal}
          onClose={() => setRefundModal(null)}
          onDone={(msg, success) => {
            setRefundModal(null);
            showToast(msg, success ? "success" : "error");
            if (success) load();
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-full shadow-lg text-white font-semibold flex items-center gap-2 ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function RefundModal({ payment, onClose, onDone }: {
  payment: Payment;
  onClose: () => void;
  onDone: (msg: string, success: boolean) => void;
}) {
  const originalAmount = Number(payment.amount || 0);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState<string>(originalAmount.toFixed(2));
  const [reason, setReason] = useState("customer_request");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const submit = async () => {
    if (!confirm(
      refundType === "full"
        ? `Tam iade: ₺${originalAmount.toFixed(2)}. Devam edilsin mi?`
        : `Kısmi iade: ₺${Number(amount).toFixed(2)}. Devam edilsin mi?`,
    )) return;

    setProcessing(true);
    try {
      const result = await api(`/admin/payments/${payment.id}/refund`, {
        method: "POST",
        body: JSON.stringify({
          amount: refundType === "partial" ? Number(amount) : null,
          reason,
          notes,
        }),
      });
      onDone(`İade başarılı · ₺${result.amount?.toFixed(2) || "?"}`, true);
    } catch (e: any) {
      onDone(e?.message || "İade başarısız", false);
    } finally { setProcessing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-auto p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="font-bold text-[#1e3a6e]">İade İşlemi</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg text-sm">
            <div className="font-semibold text-[#1e3a6e]">Orijinal Ödeme</div>
            <div className="text-xs text-slate-600 mt-1">
              Tutar: <strong>₺{originalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</strong><br/>
              Kullanıcı: {payment.userEmail}<br/>
              Iyzico ID: <code className="text-[10px]">{payment.providerPaymentId}</code>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">İade Tipi</Label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setRefundType("full"); setAmount(originalAmount.toFixed(2)); }}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold ${refundType === "full" ? "border-[#13a9e0] bg-blue-50 text-[#1e3a6e]" : "border-slate-200 text-slate-500"}`}
              >Tam İade</button>
              <button
                onClick={() => setRefundType("partial")}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold ${refundType === "partial" ? "border-[#13a9e0] bg-blue-50 text-[#1e3a6e]" : "border-slate-200 text-slate-500"}`}
              >Kısmi İade</button>
            </div>
          </div>

          {refundType === "partial" && (
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Tutar (TL)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={originalAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="text-[11px] text-slate-500 mt-1">Maks: ₺{originalAmount.toFixed(2)}</div>
            </div>
          )}

          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">Sebep</Label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white mt-1"
            >
              <option value="customer_request">Müşteri talebi</option>
              <option value="duplicate_charge">Çift tahsilat</option>
              <option value="fraud">Dolandırıcılık şüphesi</option>
              <option value="service_failure">Hizmet verilemedi</option>
              <option value="other">Diğer</option>
            </select>
          </div>

          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">Admin Notu</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1"
              placeholder="İsteğe bağlı — iade sebebine ek detay"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            ⚠️ Bu işlem geri alınamaz. İade Iyzico üzerinden anlık yapılır ve kullanıcının kartına 3-10 iş günü içinde yansır.
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Vazgeç</Button>
            <Button
              onClick={submit}
              disabled={processing}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {processing ? "İade ediliyor…" : "İadeyi Onayla"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

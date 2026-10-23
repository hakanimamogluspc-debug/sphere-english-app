import { useEffect, useState } from "react";
import { HardDrive, RefreshCw, Loader2, Play, Trash2, Download, AlertCircle } from "lucide-react";
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

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AdminBackups() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offsite, setOffsite] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [storage, setStorage] = useState<any>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateLog, setMigrateLog] = useState<string | null>(null);

  async function loadStorage() {
    try { setStorage(await apiFetch("/admin/storage/status")); } catch { /* yoksay */ }
  }

  async function migrate() {
    if (!confirm("Veritabanındaki e-kitap dosyaları Hetzner Object Storage'a taşınsın mı? Satışlar etkilenmez.")) return;
    setMigrating(true);
    setMigrateLog(null);
    let total = 0;
    try {
      for (let i = 0; i < 50; i++) {
        const r = await apiFetch("/admin/storage/migrate-ebooks", { method: "POST", body: JSON.stringify({ limit: 10 }) });
        total += r.moved;
        setMigrateLog(`${total} dosya taşındı, ${r.remaining} kaldı${r.failed?.length ? ` · ${r.failed.length} hata: ${r.failed[0].error}` : ""}`);
        if (r.remaining === 0 || r.moved === 0) break;
      }
      await loadStorage();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMigrating(false);
    }
  }

  async function load() {
    setLoading(true);
    loadStorage();
    try {
      const data = await apiFetch("/admin/backups");
      setBackups(data.backups ?? []);
      setOffsite(data.offsite ?? null);
      setRuns(data.runs ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function run() {
    if (!confirm("Manuel yedek çalıştırılsın mı? (Birkaç saniye sürebilir)")) return;
    setRunning(true);
    try {
      const r = await apiFetch("/admin/backups/run", { method: "POST" });
      if (r.ok) {
        const remoteMsg = r.remote?.ok
          ? `\nStorage Box: ✓ ${r.remote.file}`
          : `\nStorage Box: ✗ ${r.remote?.error || r.remote?.skipped || "gönderilmedi"}`;
        alert(`Yedek alındı: ${(r.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${(r.durationMs / 1000).toFixed(1)}s${remoteMsg}`);
        await load();
      } else {
        setError(r.error || "Yedek alınamadı");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function prune() {
    if (!confirm("7 günden eski yedekleri sil?")) return;
    try {
      const r = await apiFetch("/admin/backups/prune", { method: "POST" });
      alert(`${r.deleted} eski yedek silindi`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const totalSize = backups.reduce((s, b) => s + b.sizeBytes, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
            <HardDrive size={26} /> DB Yedekleri
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Günlük otomatik yedek · 7 gün retention · {backups.length} kayıt, toplam {fmtSize(totalSize)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-sm">
            <RefreshCw size={14} /> Yenile
          </button>
          <button onClick={prune}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-100 text-amber-800 text-sm hover:bg-amber-200">
            <Trash2 size={14} /> Eskileri Sil
          </button>
          <button onClick={run} disabled={running}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-50">
            {running ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
            {running ? "Çalışıyor..." : "Manuel Yedek"}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Sunucu dışı yedek (Hetzner Storage Box) */}
      <div className={`mb-4 p-4 rounded-lg border ${offsite?.configured ? (runs[0]?.remote_ok ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200") : "bg-red-50 border-red-200"}`}>
        <p className="font-semibold text-sm text-slate-800 mb-1">Sunucu dışı yedek — Hetzner Storage Box</p>
        {!offsite?.configured ? (
          <p className="text-sm text-red-700">
            Yapılandırılmamış — yedekler yalnız sunucuda duruyor. Eksik ortam değişkenleri: <code>{(offsite?.missing ?? []).join(", ")}</code>
          </p>
        ) : (
          <div className="text-sm text-slate-700 space-y-1">
            <p>
              Son çalışma: {runs[0] ? `${new Date(runs[0].started_at).toLocaleString("tr-TR")} — ${runs[0].remote_ok ? `✓ ${runs[0].remote_file}` : `✗ ${runs[0].error || "başarısız"}`}` : "henüz yok"}
            </p>
            <p>Storage Box'ta {offsite.remote?.length ?? 0} şifreli yedek{offsite.remote?.[0] ? ` · en yenisi ${offsite.remote[0].name}` : ""}{offsite.remoteError ? ` · listeleme hatası: ${offsite.remoteError}` : ""}</p>
          </div>
        )}
      </div>

      {/* E-kitap dosyaları (Hetzner Object Storage) */}
      {storage && (
        <div className={`mb-6 p-4 rounded-lg border ${storage.enabled && storage.connection?.ok ? "bg-white border-slate-200" : "bg-amber-50 border-amber-200"}`}>
          <p className="font-semibold text-sm text-slate-800 mb-1">E-kitap dosyaları — Hetzner Object Storage</p>
          {!storage.enabled ? (
            <p className="text-sm text-amber-800">Yapılandırılmamış — dosyalar veritabanında (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY eksik).</p>
          ) : !storage.connection?.ok ? (
            <p className="text-sm text-red-700">Bağlantı hatası: {storage.connection?.error}</p>
          ) : (
            <p className="text-sm text-emerald-700">Bağlantı ✓</p>
          )}
          <p className="text-sm text-slate-600 mt-1">
            Veritabanında: <strong>{storage.ebooks?.inDb}</strong> dosya · Bucket'ta: <strong>{storage.ebooks?.inStorage}</strong> dosya · ebook_assets tablosu: {storage.ebooks?.tableSize}
          </p>
          {storage.enabled && storage.connection?.ok && storage.ebooks?.inDb > 0 && (
            <button onClick={migrate} disabled={migrating}
              className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-50">
              {migrating ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />} Dosyaları bucket'a taşı
            </button>
          )}
          {migrateLog && <p className="text-xs text-slate-600 mt-2">{migrateLog}</p>}
        </div>
      )}

      <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Sunucudaki yerel yedekler</p>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Dosya</th>
              <th className="px-3 py-2 text-right">Boyut</th>
              <th className="px-3 py-2 text-left">Oluşturma</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-center p-6"><Loader2 className="animate-spin inline" /></td></tr>
            ) : backups.length === 0 ? (
              <tr><td colSpan={3} className="text-center p-8 text-slate-400">Henüz yedek yok</td></tr>
            ) : backups.map((b) => (
              <tr key={b.name} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{b.name}</td>
                <td className="px-3 py-2 text-right">{fmtSize(b.sizeBytes)}</td>
                <td className="px-3 py-2 text-slate-600">{new Date(b.createdAt).toLocaleString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
        <strong>🔧 Geri yükleme:</strong> Adım adım tarif repo'daki <code className="bg-slate-200 px-1 rounded">BACKUP.md</code> dosyasında
        (Storage Box'tan indir → <code className="bg-slate-200 px-1 rounded">decrypt-backup.mjs</code> ile çöz → staging'e yükleyip dene).
        <br />
        <strong>📁 Yerel kopya:</strong> Container içinde <code className="bg-slate-200 px-1 rounded">/app/backups/</code> — container yeniden oluşturulunca silinir;
        asıl güvence Storage Box'taki şifreli kopyadır.
      </div>
    </div>
  );
}

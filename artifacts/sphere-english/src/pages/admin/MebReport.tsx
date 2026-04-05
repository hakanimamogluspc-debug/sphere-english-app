import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/core";
import { Button } from "@/components/ui/core";
import { FileText, Download, Search, Users, Clock, BookOpen, Calendar } from "lucide-react";
import { API } from "@/lib/api-url";

type LogEntry = {
  id: number;
  userId: number;
  lessonId: number;
  courseId: number;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  durationMinutes: number;
  watchedPercent: number;
  deviceInfo: string | null;
  user: { id: number; firstName: string; lastName: string; email: string } | null;
  lesson: { id: number; title: string; type: string } | null;
  course: { id: number; title: string } | null;
};

type Summary = {
  totalLogs: number;
  totalMinutes: number;
  totalHours: number;
  uniqueStudents: number;
  dateRange: { startDate: string; endDate: string };
};

type ReportData = { logs: LogEntry[]; summary: Summary };

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}s ${m}dk`;
  if (m > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MebReport() {
  const today = new Date().toISOString().split("T")[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today);
  const [studentId, setStudentId] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("sphere_token");
      const params = new URLSearchParams({ startDate, endDate });
      if (studentId) params.set("studentId", studentId);

      const res = await fetch(`${API}/api/reports/meb?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Rapor alınamadı");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8" />
        <title>MEB Uyumlu Aktivite Raporu — Sphere English</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a2e; padding: 20mm; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 18px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .logo-box { width: 44px; height: 44px; background: #6366f1; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 18px; }
          .org-name { font-size: 18px; font-weight: 800; color: #6366f1; }
          .org-sub { font-size: 10px; color: #64748b; }
          .report-title { font-size: 10px; text-align: right; color: #64748b; line-height: 1.6; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
          .summary-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
          .summary-value { font-size: 20px; font-weight: 800; color: #6366f1; }
          .summary-label { font-size: 9px; color: #64748b; margin-top: 2px; }
          .section-title { font-size: 12px; font-weight: 700; color: #1a1a2e; margin: 16px 0 8px; border-left: 3px solid #6366f1; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #6366f1; color: white; padding: 7px 8px; text-align: left; font-weight: 600; }
          td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
          tr:nth-child(even) td { background: #f8fafc; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
          .badge-high { background: #dcfce7; color: #166534; }
          .badge-mid  { background: #fef9c3; color: #854d0e; }
          .badge-low  { background: #fee2e2; color: #991b1b; }
          .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
          @page { size: A4 landscape; margin: 15mm; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="logo-box">SE</div>
            <div>
              <div class="org-name">Sphere English</div>
              <div class="org-sub">Özel İngilizce Dil Kurumu</div>
            </div>
          </div>
          <div class="report-title">
            <strong>MEB UYUMLU AKTİVİTE KATILIM ÇİZELGESİ</strong><br/>
            Rapor Tarihi: ${new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}<br/>
            Dönem: ${startDate} — ${endDate}<br/>
            Oluşturan: Sistem Yöneticisi
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-box">
            <div class="summary-value">${data?.summary.uniqueStudents || 0}</div>
            <div class="summary-label">Aktif Öğrenci</div>
          </div>
          <div class="summary-box">
            <div class="summary-value">${data?.summary.totalLogs || 0}</div>
            <div class="summary-label">Toplam Oturum</div>
          </div>
          <div class="summary-box">
            <div class="summary-value">${data?.summary.totalHours || 0}</div>
            <div class="summary-label">Toplam Saat</div>
          </div>
          <div class="summary-box">
            <div class="summary-value">${data?.summary.totalMinutes || 0}</div>
            <div class="summary-label">Toplam Dakika</div>
          </div>
        </div>

        <div class="section-title">Öğrenci Aktivite Detayları</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Öğrenci Adı</th>
              <th>E-posta</th>
              <th>Kurs</th>
              <th>Ders</th>
              <th>Giriş Zamanı</th>
              <th>Çıkış Zamanı</th>
              <th>Süre</th>
              <th>İzleme %</th>
              <th>Cihaz</th>
            </tr>
          </thead>
          <tbody>
            ${data?.logs.map((log, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${log.user ? `${log.user.firstName} ${log.user.lastName}` : "—"}</td>
                <td>${log.user?.email || "—"}</td>
                <td>${log.course?.title || "—"}</td>
                <td>${log.lesson?.title || "—"}</td>
                <td>${formatDateTime(log.startTime)}</td>
                <td>${log.endTime ? formatDateTime(log.endTime) : "—"}</td>
                <td>${formatDuration(log.durationSeconds)}</td>
                <td>
                  <span class="badge ${log.watchedPercent >= 90 ? 'badge-high' : log.watchedPercent >= 50 ? 'badge-mid' : 'badge-low'}">
                    %${log.watchedPercent}
                  </span>
                </td>
                <td>${(log.deviceInfo || "").slice(0, 30) || "—"}</td>
              </tr>
            `).join("") || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#94a3b8;">Bu dönemde kayıt bulunamadı.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          <span>Bu rapor Sphere English LMS tarafından otomatik olarak oluşturulmuştur. MEB Özel Öğretim Kurumları Yönetmeliği kapsamında geçerlidir.</span>
          <span>Sayfa 1/1</span>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">MEB Rapor Altyapısı</h1>
          <p className="text-muted-foreground mt-1">Öğrenci aktivite kayıtları ve MEB uyumlu katılım çizelgesi</p>
        </div>
        <Button onClick={handlePrint} disabled={!data || loading} className="gap-2">
          <Download size={16} />
          PDF İndir / Yazdır
        </Button>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search size={16} />
            Rapor Filtreleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-36">
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-1 min-w-36">
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">Bitiş Tarihi</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex-1 min-w-36">
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">Öğrenci ID (opsiyonel)</label>
              <input
                type="number"
                placeholder="Tüm öğrenciler"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button onClick={fetchReport} isLoading={loading} className="gap-2 shrink-0">
              <Search size={16} />
              Raporu Getir
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Özet Kartları */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Aktif Öğrenci", value: data.summary.uniqueStudents, color: "text-primary" },
            { icon: BookOpen, label: "Toplam Oturum", value: data.summary.totalLogs, color: "text-accent" },
            { icon: Clock, label: "Toplam Saat", value: `${data.summary.totalHours}s`, color: "text-green-600" },
            { icon: Calendar, label: "Toplam Dakika", value: data.summary.totalMinutes, color: "text-orange-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <Icon className={`h-5 w-5 ${color} mb-2`} />
                <p className="text-muted-foreground text-xs font-medium">{label}</p>
                <p className="text-2xl font-bold font-display mt-0.5">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tablo */}
      <Card ref={printRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText size={16} />
            Aktivite Kayıtları
            {data && <span className="text-muted-foreground font-normal text-sm">({data.logs.length} kayıt)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              Veriler yükleniyor...
            </div>
          ) : data?.logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              Bu dönemde aktivite kaydı bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Öğrenci</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Kurs</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ders</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Giriş</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Süre</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">İzleme %</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.logs.map((log, i) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{log.user ? `${log.user.firstName} ${log.user.lastName}` : "—"}</p>
                        <p className="text-xs text-muted-foreground">{log.user?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{log.course?.title || "—"}</td>
                      <td className="px-4 py-3">{log.lesson?.title || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(log.startTime)}</td>
                      <td className="px-4 py-3 font-medium">{formatDuration(log.durationSeconds)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                log.watchedPercent >= 90 ? "bg-green-500" :
                                log.watchedPercent >= 50 ? "bg-amber-500" : "bg-red-400"
                              }`}
                              style={{ width: `${log.watchedPercent}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${
                            log.watchedPercent >= 90 ? "text-green-600" :
                            log.watchedPercent >= 50 ? "text-amber-600" : "text-red-500"
                          }`}>%{log.watchedPercent}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Button, Input, Modal } from "@/components/ui/core";
import { Users, Search, GraduationCap, Star, Flame, BookOpen, Calendar, Hash, Mail, Phone, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { API } from "@/lib/api-url";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Student {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  studentNumber: string | null;
  currentLevel: string | null;
  totalPoints: number;
  streak: number;
  badges: string[];
  createdAt: string;
  companyId: number | null;
}

interface Enrollment {
  id: number;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  enrolledAt: string;
}


const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-slate-100 text-slate-700",
  A2: "bg-blue-100 text-blue-700",
  B1: "bg-green-100 text-green-700",
  B2: "bg-yellow-100 text-yellow-700",
  C1: "bg-orange-100 text-orange-700",
  C2: "bg-red-100 text-red-700",
};

function authHeaders() {
  const token = localStorage.getItem("sphere_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url: string) {
  const res = await fetch(url, { headers: authHeaders() as HeadersInit });
  if (!res.ok) throw new Error("Hata oluştu");
  return res.json();
}

// ─── Öğrenci Detay Modalı ─────────────────────────────────────────────────
function StudentDetailModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["/api/admin/students/enrollments", student.id],
    queryFn: () => apiFetch(`${API}/admin/students/${student.id}/enrollments`),
  });

  return (
    <Modal isOpen onClose={onClose} title="Öğrenci Detayı" maxWidth="max-w-2xl">
      <div className="space-y-6">
        {/* Kimlik Başlığı */}
        <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl flex-shrink-0">
            {student.firstName[0]}{student.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold font-display">{student.firstName} {student.lastName}</h3>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {student.studentNumber && (
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg">
                  <Hash size={12} /> {student.studentNumber}
                </span>
              )}
              {student.currentLevel && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ${LEVEL_COLORS[student.currentLevel] || "bg-muted text-muted-foreground"}`}>
                  {student.currentLevel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* İletişim */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail size={14} className="flex-shrink-0" />
            <span className="truncate">{student.email}</span>
          </div>
          {student.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone size={14} className="flex-shrink-0" />
              <span>{student.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar size={14} className="flex-shrink-0" />
            <span>Kayıt: {new Date(student.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-yellow-50 rounded-xl border border-yellow-200">
            <Star size={18} className="mx-auto mb-1 text-yellow-500" />
            <p className="text-xl font-bold font-display">{student.totalPoints}</p>
            <p className="text-xs text-muted-foreground">Toplam Puan</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-200">
            <Flame size={18} className="mx-auto mb-1 text-orange-500" />
            <p className="text-xl font-bold font-display">{student.streak}</p>
            <p className="text-xs text-muted-foreground">Günlük Seri</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-200">
            <BookOpen size={18} className="mx-auto mb-1 text-blue-500" />
            <p className="text-xl font-bold font-display">{enrollments.length}</p>
            <p className="text-xs text-muted-foreground">Kurs Sayısı</p>
          </div>
        </div>

        {/* Kayıtlı Kurslar */}
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
            <BookOpen size={14} className="text-primary" /> Kayıtlı Kurslar
          </h4>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Henüz bir kursa kayıtlı değil.</p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((e) => {
                const pct = e.totalLessons > 0 ? Math.round((e.completedLessons / e.totalLessons) * 100) : 0;
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{e.courseTitle}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {e.completedLessons}/{e.totalLessons} ders
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${pct === 100 ? "text-green-600" : "text-primary"}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rozetler */}
        {student.badges?.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Rozetler</h4>
            <div className="flex flex-wrap gap-1.5">
              {student.badges.map((b, i) => (
                <span key={i} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-medium">{b}</span>
              ))}
            </div>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={onClose}>Kapat</Button>
      </div>
    </Modal>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function AdminStudents() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [page, setPage] = useState(1);
  const limit = 24;

  const { data, isLoading } = useQuery<{ users: Student[]; total: number }>({
    queryKey: ["/api/users", "student", search, levelFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ role: "student", limit: String(limit), page: String(page) });
      if (search) params.set("search", search);
      const res = await fetch(`${API}/users?${params}`, { headers: authHeaders() as HeadersInit });
      return res.json();
    },
    staleTime: 30000,
  });

  const students = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const filtered = levelFilter
    ? students.filter(s => s.currentLevel === levelFilter)
    : students;

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Öğrenci Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Tüm öğrencileri görüntüleyin, arayın ve detaylarına ulaşın.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold">
          <Users size={18} />
          <span>{total} öğrenci</span>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Ad, e-posta veya öğrenci no ara..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={levelFilter}
          onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
          className="h-12 rounded-xl border-2 border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Tüm Seviyeler</option>
          {["A1","A2","B1","B2","C1","C2"].map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Öğrenci Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-40" />
          <p className="text-muted-foreground font-medium">Öğrenci bulunamadı</p>
          {search && <p className="text-sm text-muted-foreground mt-1">"{search}" için sonuç yok</p>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((student, i) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="p-5 border-2 border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setSelectedStudent(student)}>
                {/* Üst Bölüm */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                    {student.firstName[0]}{student.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{student.firstName} {student.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                </div>

                {/* Öğrenci No + Seviye */}
                <div className="flex items-center gap-2 mb-3">
                  {student.studentNumber ? (
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary font-mono font-bold text-xs px-2 py-1 rounded-lg">
                      <Hash size={10} />{student.studentNumber}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No atanmamış</span>
                  )}
                  {student.currentLevel && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${LEVEL_COLORS[student.currentLevel] || "bg-muted text-muted-foreground"}`}>
                      {student.currentLevel}
                    </span>
                  )}
                </div>

                {/* İstatistikler */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Puan</p>
                    <p className="font-bold text-sm text-foreground">{student.totalPoints}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Seri</p>
                    <p className="font-bold text-sm text-foreground flex items-center justify-center gap-0.5">
                      {student.streak} <Flame size={10} className="text-orange-500" />
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Rozet</p>
                    <p className="font-bold text-sm text-foreground">{student.badges?.length || 0}</p>
                  </div>
                </div>

                {/* Kayıt Tarihi */}
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(student.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })} tarihinde katıldı
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Önceki
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages} sayfa
          </span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Sonraki →
          </Button>
        </div>
      )}

      {/* Detay Modalı */}
      {selectedStudent && (
        <StudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { BookOpen, FileText, PlayCircle, ChevronDown, ChevronRight, GraduationCap, User, FolderOpen, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import { API } from "@/lib/api-url";

type Lesson = {
  id: number;
  title: string;
  type: string;
  duration: number | null;
  content: string | null;
  videoUrl: string | null;
  isCompleted: boolean;
  order: number;
};

type Module = {
  id: number;
  title: string;
  order: number;
  lessons: Lesson[];
};

type CourseData = {
  courseId: number;
  courseTitle: string;
  level: string | null;
  teacherName: string | null;
  modules: Module[];
};

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700",
  A2: "bg-green-100 text-green-700",
  B1: "bg-blue-100 text-blue-700",
  B2: "bg-indigo-100 text-indigo-700",
  C1: "bg-purple-100 text-purple-700",
  C2: "bg-rose-100 text-rose-700",
};

const TYPE_ICON: Record<string, JSX.Element> = {
  video:    <PlayCircle className="h-4 w-4 text-blue-500" />,
  document: <FileText className="h-4 w-4 text-amber-500" />,
  text:     <FileText className="h-4 w-4 text-gray-500" />,
};

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}` };
}

export default function StudentMaterials() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCourses, setOpenCourses] = useState<Set<number>>(new Set());
  const [openModules, setOpenModules] = useState<Set<number>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    fetch(`${API}/student/materials`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setCourses(arr);
        // İlk kursu varsayılan açık
        if (arr.length > 0) setOpenCourses(new Set([arr[0].courseId]));
      })
      .catch(() => toast({ title: "Hata", description: "Materyaller yüklenemedi", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const toggleCourse = (id: number) => setOpenCourses(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleModule = (id: number) => setOpenModules(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const totalLessons = courses.reduce((sum, c) => sum + c.modules.reduce((s2, m) => s2 + m.lessons.length, 0), 0);
  const completedLessons = courses.reduce((sum, c) => sum + c.modules.reduce((s2, m) => s2 + m.lessons.filter(l => l.isCompleted).length, 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Materyallerim</h1>
        <p className="text-muted-foreground mt-1">Öğretmenlerinizin yüklediği ders içeriklerine erişin.</p>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kurs</p>
              <p className="text-2xl font-bold">{courses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Toplam Ders</p>
              <p className="text-2xl font-bold">{totalLessons}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tamamlanan</p>
              <p className="text-2xl font-bold text-green-600">{completedLessons}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Card key={i} className="h-24 animate-pulse bg-secondary/50" />)}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="h-14 w-14 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Henüz kayıtlı olduğunuz bir kurs yok</p>
            <p className="text-sm mt-1">Kurslara kayıt olduğunuzda materyaller burada görünecek.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: ders ağacı */}
          <div className="lg:col-span-1 space-y-3">
            {courses.map(course => {
              const isCourseOpen = openCourses.has(course.courseId);
              const courseLessonCount = course.modules.reduce((s, m) => s + m.lessons.length, 0);
              const courseCompletedCount = course.modules.reduce((s, m) => s + m.lessons.filter(l => l.isCompleted).length, 0);
              const pct = courseLessonCount > 0 ? Math.round((courseCompletedCount / courseLessonCount) * 100) : 0;

              return (
                <Card key={course.courseId} className="overflow-hidden">
                  {/* Kurs başlığı */}
                  <button
                    onClick={() => toggleCourse(course.courseId)}
                    className="w-full p-4 flex items-start gap-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <FolderOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm">{course.courseTitle}</span>
                        {course.level && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_COLORS[course.level] ?? ""}`}>
                            {course.level}
                          </span>
                        )}
                      </div>
                      {course.teacherName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" /> {course.teacherName}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">%{pct}</span>
                      </div>
                    </div>
                    {isCourseOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {isCourseOpen && (
                    <div className="border-t border-border/50">
                      {course.modules.map(mod => {
                        const isModOpen = openModules.has(mod.id);
                        return (
                          <div key={mod.id}>
                            <button
                              onClick={() => toggleModule(mod.id)}
                              className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-secondary/30 transition-colors text-left bg-secondary/10"
                            >
                              {isModOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{mod.title}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">{mod.lessons.length} ders</span>
                            </button>
                            {isModOpen && mod.lessons.map(lesson => (
                              <button
                                key={lesson.id}
                                onClick={() => setSelectedLesson(lesson)}
                                className={`w-full px-5 py-2.5 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors text-left ${selectedLesson?.id === lesson.id ? "bg-primary/5 border-r-2 border-primary" : ""}`}
                              >
                                {TYPE_ICON[lesson.type] ?? <FileText className="h-4 w-4 text-gray-400" />}
                                <span className="text-sm truncate flex-1">{lesson.title}</span>
                                {lesson.isCompleted && <GraduationCap className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Sağ: ders içeriği */}
          <div className="lg:col-span-2">
            {!selectedLesson ? (
              <Card className="h-full">
                <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <BookOpen className="h-14 w-14 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Bir ders seçin</p>
                    <p className="text-sm mt-1">Soldaki listeden görüntülemek istediğiniz dersi seçin.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="border-b pb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      {TYPE_ICON[selectedLesson.type] ?? <FileText className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{selectedLesson.title}</CardTitle>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="capitalize">{selectedLesson.type === "video" ? "Video" : selectedLesson.type === "document" ? "Belge" : "Metin"}</span>
                        {selectedLesson.duration && <span>· {selectedLesson.duration} dk</span>}
                        {selectedLesson.isCompleted && <span className="text-green-600 font-semibold flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Tamamlandı</span>}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {selectedLesson.videoUrl && (
                    <div className="aspect-video bg-black rounded-xl overflow-hidden">
                      <video src={selectedLesson.videoUrl} controls className="w-full h-full" />
                    </div>
                  )}
                  {selectedLesson.content ? (
                    <div className="prose prose-sm max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedLesson.content}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Bu ders için içerik henüz eklenmemiş.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

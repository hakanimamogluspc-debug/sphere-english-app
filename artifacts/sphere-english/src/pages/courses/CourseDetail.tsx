import { useGetCourse, useEnrollCourse } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, Button, Badge } from "@/components/ui/core";
import { getLevelColor } from "@/lib/utils";
import { PlayCircle, FileText, CheckCircle, Lock, Trophy, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id || "0");
  const { data: course, isLoading } = useGetCourse(courseId);
  const enrollMutation = useEnrollCourse();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [openModule, setOpenModule] = useState<number | null>(null);

  const handleEnroll = async () => {
    if (!course) return;
    await enrollMutation.mutateAsync({ id: courseId, data: {} });
    queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}`] });
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Kurs detayları yükleniyor...</div>;
  if (!course) return <div className="p-8 text-center">Kurs bulunamadı</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <button onClick={() => setLocation('/courses')} className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft size={16} className="mr-2" /> Kurslara Dön
      </button>

      {/* Kurs Başlık Alanı */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="h-64 md:h-80 w-full relative">
          <img 
            src={course.imageUrl || `${import.meta.env.BASE_URL}images/course-placeholder.png`} 
            alt={course.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-8">
            <Badge className={`w-fit mb-4 ${getLevelColor(course.level)} border-0`}>{course.level} Seviyesi</Badge>
            <h1 className="text-3xl md:text-5xl font-bold font-display text-white mb-2">{course.title}</h1>
            <p className="text-white/80 text-lg">Eğitmen: {course.teacherName || "Sphere Öğretmeni"}</p>
          </div>
        </div>
        <div className="p-8 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center bg-card">
          <div className="max-w-3xl">
            <h3 className="text-xl font-bold mb-2">Bu kurs hakkında</h3>
            <p className="text-muted-foreground leading-relaxed">{course.description}</p>
          </div>
          <div className="shrink-0 flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
            {course.isEnrolled ? (
              <div className="text-center md:text-right">
                <div className="text-2xl font-bold text-accent mb-1">%{course.completionPercentage || 0} Tamamlandı</div>
                <div className="w-full md:w-48 bg-secondary rounded-full h-2 overflow-hidden mb-2">
                  <div className="bg-accent h-full rounded-full" style={{ width: `${course.completionPercentage || 0}%` }} />
                </div>
                <Button className="w-full" size="lg">Öğrenmeye Devam Et</Button>
              </div>
            ) : (
              <div className="text-center md:text-right w-full">
                <div className="text-2xl font-bold mb-3">{course.price ? `₺${course.price}` : 'Ücretsiz'}</div>
                <Button size="lg" className="w-full md:w-auto shadow-xl" onClick={handleEnroll} isLoading={enrollMutation.isPending}>
                  Şimdi Kayıt Ol
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Müfredat */}
      <div>
        <h2 className="text-2xl font-bold font-display mb-6">Kurs Müfredatı</h2>
        <div className="space-y-4">
          {course.modules?.map((module, mIndex) => (
            <Card key={module.id} className="overflow-hidden">
              <button 
                className="w-full p-6 text-left flex justify-between items-center hover:bg-secondary/50 transition-colors"
                onClick={() => setOpenModule(openModule === module.id ? null : module.id)}
              >
                <div>
                  <h4 className="font-bold text-lg">Ünite {mIndex + 1}: {module.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{module.lessons.length} ders</p>
                </div>
                <div className={`transform transition-transform ${openModule === module.id ? 'rotate-180' : ''}`}>
                  ▼
                </div>
              </button>
              
              {openModule === module.id && (
                <div className="border-t border-border bg-background/50 divide-y divide-border/50">
                  {module.lessons.map((lesson, lIndex) => (
                    <div key={lesson.id} className="p-4 px-6 flex items-center justify-between group hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                          {lesson.type === 'video' ? <PlayCircle size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{lIndex + 1}. {lesson.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span className="capitalize">{lesson.type === 'video' ? 'Video' : lesson.type === 'document' ? 'Belge' : 'Metin'}</span>
                            {lesson.duration && <span>• {lesson.duration} dk</span>}
                          </p>
                        </div>
                      </div>
                      <div>
                        {course.isEnrolled ? (
                          lesson.isCompleted ? (
                            <CheckCircle className="text-green-500" size={24} />
                          ) : (
                            <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity">Başla</Button>
                          )
                        ) : (
                          <Lock className="text-muted-foreground/50" size={20} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
          {(!course.modules || course.modules.length === 0) && (
            <div className="text-center p-8 bg-card border border-border rounded-xl text-muted-foreground">
              Müfredat hazırlanıyor.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

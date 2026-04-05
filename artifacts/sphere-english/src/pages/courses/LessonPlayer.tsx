import { useParams, useLocation } from "wouter";
import { useGetLesson, useGetCourse } from "@workspace/api-client-react";
import { Button, Badge } from "@/components/ui/core";
import { CheckCircle, ArrowLeft, FileText, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function LessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [, setLocation] = useLocation();
  const lessonIdNum = parseInt(lessonId || "0");
  const courseIdNum = parseInt(courseId || "0");

  const { data: lesson, isLoading, refetch } = useGetLesson(lessonIdNum);
  const { data: course } = useGetCourse(courseIdNum);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (lesson?.isCompleted) setCompleted(true);
  }, [lesson]);

  // Flatten all lessons across modules for prev/next navigation
  const allLessons = course?.modules?.flatMap(m => m.lessons) || [];
  const currentIndex = allLessons.findIndex(l => l.id === lessonIdNum);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const handleComplete = async () => {
    if (completed || completing) return;
    setCompleting(true);
    try {
      const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
      await fetch(`${apiUrl}/api/lessons/${lessonIdNum}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setCompleted(true);
      refetch();
    } finally {
      setCompleting(false);
    }
  };

  const handleVideoEnded = () => {
    handleComplete();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Ders bulunamadı.</p>
        <Button onClick={() => setLocation(`/courses/${courseIdNum}`)} className="mt-4">Kursa Dön</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Üst Navigasyon */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setLocation(`/courses/${courseIdNum}`)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Kurs Müfredatına Dön
        </button>
        {completed && (
          <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1.5">
            <CheckCircle size={14} /> Tamamlandı
          </Badge>
        )}
      </div>

      {/* Ders Başlığı */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display">{lesson.title}</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          {lesson.type === "video" ? <PlayCircle size={16} /> : <FileText size={16} />}
          {lesson.type === "video" ? "Video Ders" : lesson.type === "document" ? "Belge" : "Metin İçerik"}
          {lesson.duration && <span>• {lesson.duration} dakika</span>}
        </p>
      </div>

      {/* İçerik */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {lesson.type === "video" && lesson.content ? (
          <div className="relative bg-black aspect-video select-none">
            <video
              ref={videoRef}
              className="w-full h-full"
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onEnded={handleVideoEnded}
              onContextMenu={(e) => e.preventDefault()}
              src={lesson.content}
              playsInline
            >
              <p className="text-white text-center p-4">Tarayıcınız video oynatmayı desteklemiyor.</p>
            </video>
          </div>
        ) : lesson.type === "document" && lesson.content ? (
          <div className="p-6 md:p-10">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileText className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">{lesson.title}</p>
                <p className="text-sm text-muted-foreground">Belge İçeriği</p>
              </div>
            </div>
            <div
              className="prose prose-sm max-w-none text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: lesson.content }}
            />
          </div>
        ) : (
          <div className="p-6 md:p-10">
            <div
              className="prose prose-sm max-w-none text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: lesson.content || "<p>İçerik hazırlanıyor...</p>" }}
            />
          </div>
        )}
      </div>

      {/* Tamamla Butonu */}
      {!completed ? (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleComplete}
            isLoading={completing}
            className="px-10 shadow-lg"
          >
            <CheckCircle size={18} className="mr-2" />
            Dersi Tamamlandı Olarak İşaretle
          </Button>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-green-600 font-semibold text-lg">
            <CheckCircle size={22} />
            Bu ders tamamlandı!
          </div>
        </div>
      )}

      {/* Prev / Next Navigasyon */}
      <div className="flex justify-between items-center pt-4 border-t border-border">
        <div>
          {prevLesson ? (
            <button
              onClick={() => setLocation(`/courses/${courseIdNum}/lessons/${prevLesson.id}`)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>
                <span className="text-xs block text-muted-foreground/60">Önceki</span>
                {prevLesson.title}
              </span>
            </button>
          ) : <div />}
        </div>
        <div className="text-xs text-muted-foreground text-center">
          {currentIndex + 1} / {allLessons.length}
        </div>
        <div>
          {nextLesson ? (
            <button
              onClick={() => {
                if (completed || nextLesson) setLocation(`/courses/${courseIdNum}/lessons/${nextLesson.id}`);
              }}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group text-right"
            >
              <span>
                <span className="text-xs block text-muted-foreground/60">Sonraki</span>
                {nextLesson.title}
              </span>
              <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}

import { useParams, useLocation } from "wouter";
import { useGetLesson, useGetCourse } from "@workspace/api-client-react";
import { Button, Badge } from "@/components/ui/core";
import { CheckCircle, ArrowLeft, FileText, PlayCircle, ChevronLeft, ChevronRight, Clock, Eye } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
const TOKEN_KEY = "sphere_token";

function authFetch(url: string, options?: RequestInit) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
}

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [, setLocation] = useLocation();
  const lessonIdNum = parseInt(lessonId || "0");
  const courseIdNum = parseInt(courseId || "0");

  const { data: lesson, isLoading, refetch } = useGetLesson(lessonIdNum);
  const { data: course } = useGetCourse(courseIdNum);

  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [watchedPercent, setWatchedPercent] = useState(0);
  const [canComplete, setCanComplete] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const logIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef(generateSessionId());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const activeSecondsRef = useRef(0);
  const isActiveRef = useRef(true);

  // Ders başladığında session kaydı aç
  useEffect(() => {
    if (!lessonIdNum || !courseIdNum) return;

    const deviceInfo = navigator.userAgent.slice(0, 200);
    authFetch(`${API_URL}/api/lessons/${lessonIdNum}/start`, {
      method: "POST",
      body: JSON.stringify({ courseId: courseIdNum, sessionId: sessionIdRef.current, deviceInfo }),
    }).then(r => r.json()).then(data => {
      if (data.logId) logIdRef.current = data.logId;
    }).catch(() => {});

    sessionStartRef.current = Date.now();

    return () => {
      // Sayfa ayrılırken final kayıt gönder
      if (logIdRef.current) {
        const body = JSON.stringify({
          logId: logIdRef.current,
          durationSeconds: activeSecondsRef.current,
          watchedPercent: videoRef.current
            ? Math.round((videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100)
            : 0,
        });
        navigator.sendBeacon(`${API_URL}/api/lessons/${lessonIdNum}/end`, body);
      }
    };
  }, [lessonIdNum, courseIdNum]);

  // Heartbeat — her 30 saniyede bir
  useEffect(() => {
    const sendHeartbeat = () => {
      if (!logIdRef.current || !isActiveRef.current) return;
      activeSecondsRef.current += 30;
      setSessionSeconds(activeSecondsRef.current);

      const video = videoRef.current;
      const pct = video ? Math.round((video.currentTime / (video.duration || 1)) * 100) : 0;

      authFetch(`${API_URL}/api/lessons/${lessonIdNum}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({
          logId: logIdRef.current,
          durationSeconds: activeSecondsRef.current,
          watchedPercent: pct,
        }),
      }).catch(() => {});
    };

    heartbeatRef.current = setInterval(sendHeartbeat, 30000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [lessonIdNum]);

  // Page Visibility API — sekme arka plana alınınca sayacı durdur
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        isActiveRef.current = false;
        if (videoRef.current) videoRef.current.pause();
      } else {
        isActiveRef.current = true;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Video izleme ilerlemesini takip et
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = Math.round((video.currentTime / video.duration) * 100);
    setWatchedPercent(pct);
    // %90 izlendiyse butonu aktifleştir
    if (pct >= 90) setCanComplete(true);
  }, []);

  // Video durdurulunca heartbeat sayacını durdur
  const handleVideoPause = () => { isActiveRef.current = false; };
  const handleVideoPlay = () => { isActiveRef.current = true; };

  useEffect(() => {
    if (lesson?.isCompleted) {
      setCompleted(true);
      setCanComplete(true);
    }
    // Video ders değilse butonu baştan aktifleştir
    if (lesson && lesson.type !== "video") {
      setCanComplete(true);
    }
  }, [lesson]);

  const allLessons = course?.modules?.flatMap(m => m.lessons) || [];
  const currentIndex = allLessons.findIndex(l => l.id === lessonIdNum);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const handleComplete = async () => {
    if (completed || completing) return;
    setCompleting(true);
    try {
      const video = videoRef.current;
      const pct = video ? Math.round((video.currentTime / (video.duration || 1)) * 100) : 0;

      // Final aktivite kaydı
      if (logIdRef.current) {
        await authFetch(`${API_URL}/api/lessons/${lessonIdNum}/end`, {
          method: "POST",
          body: JSON.stringify({
            logId: logIdRef.current,
            durationSeconds: activeSecondsRef.current,
            watchedPercent: pct,
          }),
        });
      }

      const token = localStorage.getItem(TOKEN_KEY);
      await fetch(`${API_URL}/api/lessons/${lessonIdNum}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setCompleted(true);
      refetch();
    } finally {
      setCompleting(false);
    }
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

  const isVideo = lesson.type === "video";
  const showProgressBar = isVideo && !completed;

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
        <div className="flex items-center gap-3">
          {sessionSeconds > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={12} />
              {Math.floor(sessionSeconds / 60)} dk bu derste
            </span>
          )}
          {completed && (
            <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1.5">
              <CheckCircle size={14} /> Tamamlandı
            </Badge>
          )}
        </div>
      </div>

      {/* Ders Başlığı */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display">{lesson.title}</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          {isVideo ? <PlayCircle size={16} /> : <FileText size={16} />}
          {isVideo ? "Video Ders" : lesson.type === "document" ? "Belge" : "Metin İçerik"}
          {lesson.duration && <span>• {lesson.duration} dakika</span>}
        </p>
      </div>

      {/* İçerik */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {isVideo && lesson.content ? (
          <div className="relative bg-black aspect-video select-none">
            <video
              ref={videoRef}
              className="w-full h-full"
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => { setCanComplete(true); handleComplete(); }}
              onPause={handleVideoPause}
              onPlay={handleVideoPlay}
              onContextMenu={(e) => e.preventDefault()}
              src={lesson.content}
              playsInline
            >
              <p className="text-white text-center p-4">Tarayıcınız video oynatmayı desteklemiyor.</p>
            </video>
          </div>
        ) : lesson.content ? (
          <div className="p-6 md:p-10">
            {lesson.type === "document" && (
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <FileText className="text-primary" size={24} />
                </div>
                <div>
                  <p className="font-semibold">{lesson.title}</p>
                  <p className="text-sm text-muted-foreground">Belge İçeriği</p>
                </div>
              </div>
            )}
            <div
              className="prose prose-sm max-w-none text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: lesson.content }}
            />
          </div>
        ) : (
          <div className="p-6 md:p-10 text-center text-muted-foreground">
            İçerik hazırlanıyor...
          </div>
        )}
      </div>

      {/* Video İzleme İlerleme Çubuğu */}
      {showProgressBar && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye size={12} /> İzleme ilerlemesi</span>
            <span>{watchedPercent}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${watchedPercent}%` }}
            />
          </div>
          {!canComplete && (
            <p className="text-xs text-amber-600 text-center">
              Dersi tamamlamak için videonun en az %90'ını izlemeniz gerekiyor ({watchedPercent}%)
            </p>
          )}
        </div>
      )}

      {/* Tamamla Butonu */}
      <div className="flex justify-center">
        {!completed ? (
          <Button
            size="lg"
            onClick={handleComplete}
            isLoading={completing}
            disabled={!canComplete}
            className="px-10 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={18} className="mr-2" />
            Dersi Tamamlandı Olarak İşaretle
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-green-600 font-semibold text-lg">
            <CheckCircle size={22} />
            Bu ders tamamlandı!
          </div>
        )}
      </div>

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
              onClick={() => setLocation(`/courses/${courseIdNum}/lessons/${nextLesson.id}`)}
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

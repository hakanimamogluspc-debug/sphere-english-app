import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * /kitaplarim/:id/oku — uygulama içi kitap okuyucu.
 * PDF tarayıcıya indirilmez/açılmaz; sayfalar uygulamada çizilir ve kitap gibi çevrilir.
 * Geniş ekranda çift sayfa (kapak tek), telefonda tek sayfa. Kaldığı sayfa hesapta saklanır.
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const TOKEN_KEY = "sphere_token";
const BAR_H = 56;

function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` };
}

type Doc = PDFDocumentProxy;

export default function BookReader() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [isFull, setIsFull] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // ── Kitabı yükle ──
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    (async () => {
      try {
        const pos = await fetch(`${API}/me/ebooks/${id}/position`, { headers: authHeaders() }).then((r) => r.json());
        if (pos.error) throw new Error(pos.error);
        if (!cancelled) { setTitle(pos.title); setPage(pos.page || 1); }
        const link = await fetch(`${API}/me/ebooks/${id}/read-link`, { method: "POST", headers: authHeaders() }).then((r) => r.json());
        if (link.error) throw new Error(link.error);
        task = pdfjsLib.getDocument({ url: `${API}${link.path}`, isEvalSupported: false, disableRange: true });
        task.onProgress = (p: { loaded: number; total: number }) => { if (p.total) setProgress(Math.round((p.loaded / p.total) * 100)); };
        const d = await task.promise;
        if (cancelled) { d.destroy(); return; }
        setDoc(d); setNumPages(d.numPages);
        setPage((p) => Math.min(Math.max(1, p), d.numPages));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Kitap açılamadı");
      }
    })();
    return () => { cancelled = true; task?.destroy(); };
  }, [id]);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onFs = () => setIsFull(!!document.fullscreenElement);
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("resize", onResize); document.removeEventListener("fullscreenchange", onFs); };
  }, []);

  // ── Tek / çift sayfa düzeni ──
  const spread = size.w >= 900 && size.w > size.h * 1.15;
  const visible = useMemo(() => {
    if (!numPages) return [];
    if (!spread || page === 1) return [page];
    const left = page % 2 === 0 ? page : page - 1; // kapak tek, sonra 2-3, 4-5…
    return left + 1 <= numPages ? [left, left + 1] : [left];
  }, [page, numPages, spread]);

  const go = useCallback((delta: 1 | -1) => {
    if (!numPages) return;
    setPage((p) => {
      let next: number;
      if (!spread) next = p + delta;
      else {
        const left = p === 1 ? 1 : (p % 2 === 0 ? p : p - 1); // çift sayfa görünümünde soldaki sayfa
        if (delta > 0) next = left === 1 ? 2 : left + 2;
        else next = left <= 2 ? 1 : left - 2;
      }
      next = Math.min(Math.max(1, next), numPages);
      if (next !== p) setDir(delta > 0 ? "next" : "prev");
      return next;
    });
  }, [numPages, spread]);

  // ── Klavye ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // ── Kaldığı sayfayı kaydet (1,5 sn bekleyerek) ──
  useEffect(() => {
    if (!numPages) return;
    const t = setTimeout(() => {
      fetch(`${API}/me/ebooks/${id}/position`, {
        method: "PUT", headers: authHeaders(), keepalive: true, body: JSON.stringify({ page, pageCount: numPages }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [page, numPages, id]);

  // ── Kaydırma (swipe) ──
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { if (e.touches.length === 1) touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s || zoom > 1) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };
  // Sayfanın sol/sağ kenarına dokununca çevir (yakınlaştırılmamışken)
  const onStageClick = (e: React.MouseEvent) => {
    if (zoom > 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.3) go(-1); else if (x > 0.7) go(1);
  };

  const availW = size.w - (size.w < 640 ? 16 : 120);
  const availH = size.h - BAR_H * 2 - 24;
  const pageLabel = visible.length === 2 ? `${visible[0]}–${visible[1]}` : `${page}`;

  if (error) return (
    <div className="min-h-screen bg-[#1f242c] text-white flex flex-col items-center justify-center p-6 text-center">
      <p className="text-slate-200">{error}</p>
      <a href="/kitaplarim" className="mt-4 px-5 py-2.5 rounded-lg bg-white text-[#1e3a6e] text-sm font-bold">Kitaplarım'a dön</a>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#1f242c] text-white flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{`
        @keyframes se-flip-next { from { transform: perspective(1800px) rotateY(-24deg) translateX(8%); opacity: .35 } to { transform: none; opacity: 1 } }
        @keyframes se-flip-prev { from { transform: perspective(1800px) rotateY(24deg) translateX(-8%); opacity: .35 } to { transform: none; opacity: 1 } }
        .se-flip-next { animation: se-flip-next .38s cubic-bezier(.2,.7,.2,1); transform-origin: left center }
        .se-flip-prev { animation: se-flip-prev .38s cubic-bezier(.2,.7,.2,1); transform-origin: right center }
        @media (prefers-reduced-motion: reduce) { .se-flip-next, .se-flip-prev { animation: none } }
      `}</style>

      {/* Üst çubuk */}
      <div className="flex items-center gap-2 px-3 shrink-0" style={{ height: BAR_H }}>
        <a href="/kitaplarim" aria-label="Kitaplarım" className="p-2 rounded-full hover:bg-white/10"><ArrowLeft size={20} /></a>
        <div className="flex-1 min-w-0 text-sm font-semibold truncate">{title}</div>
        <button onClick={() => setZoom((z) => (z > 1 ? 1 : 1.6))} aria-label={zoom > 1 ? "Uzaklaştır" : "Yakınlaştır"} className="p-2 rounded-full hover:bg-white/10">
          {zoom > 1 ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
        </button>
        {document.fullscreenEnabled && (
          <button onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
            aria-label="Tam ekran" className="p-2 rounded-full hover:bg-white/10 hidden sm:inline-flex">
            {isFull ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        )}
      </div>

      {/* Sayfalar */}
      <div ref={stageRef} className={`flex-1 relative ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {!doc ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
            <Loader2 className="w-8 h-8 animate-spin" />
            <div className="text-sm">Kitap hazırlanıyor{progress ? ` · %${progress}` : "…"}</div>
          </div>
        ) : (
          <div className="min-h-full flex items-center justify-center p-3" onClick={onStageClick}>
            <div key={visible.join("-")} className={`flex shadow-2xl ${dir === "next" ? "se-flip-next" : dir === "prev" ? "se-flip-prev" : ""}`}>
              {visible.map((n, k) => (
                <PageCanvas key={n} doc={doc} pageNumber={n}
                  maxW={(visible.length === 2 ? availW / 2 : availW) * zoom} maxH={availH * zoom}
                  side={visible.length === 2 ? (k === 0 ? "left" : "right") : "single"} />
              ))}
            </div>
          </div>
        )}

        {doc && (
          <>
            <button onClick={() => go(-1)} disabled={page <= 1} aria-label="Önceki sayfa"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 items-center justify-center">
              <ChevronLeft size={24} />
            </button>
            <button onClick={() => go(1)} disabled={visible[visible.length - 1] >= numPages} aria-label="Sonraki sayfa"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 items-center justify-center">
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Alt çubuk: sayfa kaydırıcı */}
      <div className="flex items-center gap-3 px-4 shrink-0" style={{ height: BAR_H }}>
        <button onClick={() => go(-1)} disabled={!doc || page <= 1} aria-label="Önceki sayfa" className="sm:hidden p-2 disabled:opacity-30"><ChevronLeft size={22} /></button>
        <input type="range" min={1} max={Math.max(1, numPages)} value={page} disabled={!doc} aria-label="Sayfaya git"
          onChange={(e) => { const v = Number(e.target.value); setDir(v > page ? "next" : "prev"); setPage(v); }}
          className="flex-1 accent-[#13a9e0]" />
        <div className="text-xs text-slate-300 tabular-nums whitespace-nowrap">{numPages ? `${pageLabel} / ${numPages}` : ""}</div>
        <button onClick={() => go(1)} disabled={!doc || visible[visible.length - 1] >= numPages} aria-label="Sonraki sayfa" className="sm:hidden p-2 disabled:opacity-30"><ChevronRight size={22} /></button>
      </div>
    </div>
  );
}

// ─── Tek sayfa çizimi (yüksek çözünürlüklü ekranlar için DPR ölçekli) ───
const renderCache = new Map<string, HTMLCanvasElement>();
const CACHE_MAX = 10;

function PageCanvas({ doc, pageNumber, maxW, maxH, side }: { doc: Doc; pageNumber: number; maxW: number; maxH: number; side: "left" | "right" | "single" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [css, setCss] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      const pg = await doc.getPage(pageNumber);
      const base = pg.getViewport({ scale: 1 });
      const scale = Math.max(0.1, Math.min(maxW / base.width, maxH / base.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const vp = pg.getViewport({ scale: scale * dpr });
      if (cancelled) return;
      setCss({ w: Math.floor(vp.width / dpr), h: Math.floor(vp.height / dpr) });
      const key = `${(doc as any).fingerprints?.[0] ?? ""}:${pageNumber}@${vp.width.toFixed(0)}`;
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cached = renderCache.get(key);
      if (cached) { ctx.drawImage(cached, 0, 0); return; }
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const off = document.createElement("canvas");
      off.width = canvas.width; off.height = canvas.height;
      const offCtx = off.getContext("2d")!;
      task = pg.render({ canvasContext: offCtx, canvas: off, viewport: vp } as any);
      try { await task.promise; } catch { return; }
      if (cancelled) return;
      ctx.drawImage(off, 0, 0);
      renderCache.set(key, off);
      if (renderCache.size > CACHE_MAX) renderCache.delete(renderCache.keys().next().value as string);
    })().catch(() => {});
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, pageNumber, maxW, maxH]);

  const shade = side === "left" ? "linear-gradient(to left, rgba(0,0,0,.10), transparent 6%)"
    : side === "right" ? "linear-gradient(to right, rgba(0,0,0,.10), transparent 6%)" : "none";
  return (
    <div className="relative bg-white" style={css ? { width: css.w, height: css.h } : { width: 300, height: 420 }}>
      <canvas ref={ref} style={css ? { width: css.w, height: css.h, display: "block" } : { display: "none" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: shade }} />
    </div>
  );
}

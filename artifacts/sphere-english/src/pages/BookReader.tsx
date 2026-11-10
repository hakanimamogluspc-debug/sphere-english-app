import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { API } from "@/lib/api-url";

/**
 * /kitaplarim/:id/oku — uygulama içi kitap okuyucu.
 * PDF tarayıcıda açılmaz; sayfalar uygulamada çizilir ve gerçek kitap gibi yaprak çevrilerek okunur.
 * Geniş ekranda çift sayfa (kapak tek), telefonda tek sayfa. Kaldığı sayfa hesapta saklanır.
 *
 * Sayfa çevirme: hedef sayfalar ÖNCE arka planda çizilir, sonra yaprak (3B dönen katman) animasyonu
 * eski ve yeni sayfanın hazır görüntüleriyle oynatılır — böylece animasyon boş beyaz kutuyla oynamaz.
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const TOKEN_KEY = "sphere_token";
const BAR_H = 56;
const FLIP_MS = 650;

function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` };
}

type Doc = PDFDocumentProxy;
interface Rendered { canvas: HTMLCanvasElement; w: number; h: number } // w/h: ekrandaki (CSS) boyut

// ─── Çizim önbelleği ───────────────────────────────────────────────────────
const cache = new Map<string, Rendered>();
const inflight = new Map<string, Promise<Rendered>>();
const CACHE_MAX = 14;
const dpr = () => Math.min(window.devicePixelRatio || 1, 2.5);
const keyOf = (n: number, maxW: number, maxH: number) => `${n}|${Math.round(maxW)}x${Math.round(maxH)}|${dpr()}`;

function ensureRendered(doc: Doc, n: number, maxW: number, maxH: number): Promise<Rendered> {
  const key = keyOf(n, maxW, maxH);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const pg = await doc.getPage(n);
    const base = pg.getViewport({ scale: 1 });
    const scale = Math.max(0.1, Math.min(maxW / base.width, maxH / base.height));
    const vp = pg.getViewport({ scale: scale * dpr() });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: ctx, canvas, viewport: vp } as any).promise;
    const r: Rendered = { canvas, w: Math.floor(vp.width / dpr()), h: Math.floor(vp.height / dpr()) };
    cache.set(key, r);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
    return r;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Hazır çizilmiş sayfayı gösteren tuval */
function Snap({ r, className, style }: { r: Rendered | null; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !r) return;
    c.width = r.canvas.width; c.height = r.canvas.height;
    c.getContext("2d")!.drawImage(r.canvas, 0, 0);
  }, [r]);
  if (!r) return <div className={`bg-white ${className ?? ""}`} style={style} />;
  return <canvas ref={ref} className={className} style={{ width: r.w, height: r.h, display: "block", ...style }} />;
}

// ─── Görünür sayfalar ──────────────────────────────────────────────────────
function visibleFor(p: number, n: number, spread: boolean): number[] {
  if (!n) return [];
  if (!spread || p === 1) return [p];
  const left = p % 2 === 0 ? p : p - 1; // kapak tek, sonra 2-3, 4-5…
  return left + 1 <= n ? [left, left + 1] : [left];
}
function targetFor(p: number, delta: 1 | -1, n: number, spread: boolean): number {
  let next: number;
  if (!spread) next = p + delta;
  else {
    const left = p === 1 ? 1 : (p % 2 === 0 ? p : p - 1);
    next = delta > 0 ? (left === 1 ? 2 : left + 2) : (left <= 2 ? 1 : left - 2);
  }
  return Math.min(Math.max(1, next), n);
}

interface Flip {
  dir: "next" | "prev";
  mode: "single" | "spread";
  under: (Rendered | null)[];      // yaprağın altında duran sayfa(lar)
  front: Rendered | null;          // dönen yaprağın ön yüzü
  back: Rendered | null;           // arka yüzü (çift sayfada yeni sayfa)
}

export default function BookReader() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [isFull, setIsFull] = useState(false);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [shown, setShown] = useState<(Rendered | null)[]>([]);
  const busy = useRef(false);

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
        task = pdfjsLib.getDocument({ url: `${API}${link.path}`, disableRange: true });
        task.onProgress = (p: { loaded: number; total: number }) => { if (p.total) setProgress(Math.round((p.loaded / p.total) * 100)); };
        const d = await task.promise;
        if (cancelled) return; // temizlik aşağıdaki task.destroy() ile
        cache.clear();
        setDoc(d); setNumPages(d.numPages);
        setPage((p) => Math.min(Math.max(1, p), d.numPages));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Kitap açılamadı");
      }
    })();
    return () => { cancelled = true; task?.destroy(); cache.clear(); };
  }, [id]);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onFs = () => setIsFull(!!document.fullscreenElement);
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("resize", onResize); document.removeEventListener("fullscreenchange", onFs); };
  }, []);

  const spread = size.w >= 900 && size.w > size.h * 1.15;
  const visible = useMemo(() => visibleFor(page, numPages, spread), [page, numPages, spread]);
  const availW = size.w - (size.w < 640 ? 16 : 120);
  const availH = size.h - BAR_H * 2 - 24;
  const pageMax = useCallback((count: number) => ({ w: (count === 2 ? availW / 2 : availW) * zoom, h: availH * zoom }), [availW, availH, zoom]);

  // ── Görünen sayfaları çiz + komşuları önceden hazırla ──
  useEffect(() => {
    if (!doc || !visible.length) return;
    let cancelled = false;
    const m = pageMax(visible.length);
    Promise.all(visible.map((n) => ensureRendered(doc, n, m.w, m.h))).then((rs) => {
      if (cancelled) return;
      setShown(rs);
      // Bir sonraki ve önceki görünümü boşta çiz → çevirme anında hazır olsun
      for (const d of [1, -1] as const) {
        const t = targetFor(page, d, numPages, spread);
        const tv = visibleFor(t, numPages, spread);
        const tm = pageMax(tv.length);
        tv.forEach((n) => ensureRendered(doc, n, tm.w, tm.h).catch(() => {}));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [doc, visible, page, numPages, spread, pageMax]);

  // ── Sayfa çevir ──
  const go = useCallback(async (delta: 1 | -1) => {
    if (!doc || !numPages || busy.current) return;
    const target = targetFor(page, delta, numPages, spread);
    if (target === page) return;
    busy.current = true;
    try {
      const oldV = visibleFor(page, numPages, spread);
      const newV = visibleFor(target, numPages, spread);
      const om = pageMax(oldV.length), nm = pageMax(newV.length);
      const [oldR, newR] = await Promise.all([
        Promise.all(oldV.map((n) => ensureRendered(doc, n, om.w, om.h))),
        Promise.all(newV.map((n) => ensureRendered(doc, n, nm.w, nm.h))),
      ]);
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce || zoom > 1) { setPage(target); return; }

      let f: Flip;
      if (oldV.length === 2 && newV.length === 2) {
        // Çift sayfa: yaprak sırttan döner
        f = delta > 0
          ? { dir: "next", mode: "spread", under: [oldR[0], newR[1]], front: oldR[1], back: newR[0] }
          : { dir: "prev", mode: "spread", under: [newR[0], oldR[1]], front: oldR[0], back: newR[1] };
      } else {
        // Tek sayfa (telefon) ya da kapak geçişi
        f = delta > 0
          ? { dir: "next", mode: "single", under: [newR[newR.length - 1] ?? null].slice(0, 1), front: oldR[oldR.length - 1], back: null }
          : { dir: "prev", mode: "single", under: [oldR[0]], front: newR[0], back: null };
        if (newV.length === 2 || oldV.length === 2) f.under = delta > 0 ? newR : oldR;
      }
      setFlip(f);
      setPage(target);
      await new Promise((r) => setTimeout(r, FLIP_MS));
      setFlip(null);
    } finally {
      busy.current = false;
    }
  }, [doc, numPages, page, spread, pageMax, zoom]);

  // ── Klavye ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // ── Kaldığı sayfayı kaydet ──
  useEffect(() => {
    if (!numPages) return;
    const t = setTimeout(() => {
      fetch(`${API}/me/ebooks/${id}/position`, {
        method: "PUT", headers: authHeaders(), keepalive: true, body: JSON.stringify({ page, pageCount: numPages }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [page, numPages, id]);

  // ── Dokunma: kaydırma ve kenara dokunma ──
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { if (e.touches.length === 1) touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s || zoom > 1) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };
  const onStageClick = (e: React.MouseEvent) => {
    if (zoom > 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.3) go(-1); else if (x > 0.7) go(1);
  };

  const pageLabel = visible.length === 2 ? `${visible[0]}–${visible[1]}` : `${page}`;
  const lastVisible = visible[visible.length - 1] ?? 1;

  if (error) return (
    <div className="min-h-screen bg-[#1f242c] text-white flex flex-col items-center justify-center p-6 text-center">
      <p className="text-slate-200">{error}</p>
      <a href="/kitaplarim" className="mt-4 px-5 py-2.5 rounded-lg bg-white text-[#1e3a6e] text-sm font-bold">Kitaplarım'a dön</a>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#1f242c] text-white flex flex-col select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{`
        .se-leaf { position:absolute; top:0; transform-style:preserve-3d; will-change:transform; }
        .se-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; overflow:hidden; background:#fff; }
        .se-face.back { transform: rotateY(180deg); }
        .se-shade { position:absolute; inset:0; pointer-events:none; }
        @keyframes se-turn-next { from { transform: rotateY(0deg) } to { transform: rotateY(-180deg) } }
        @keyframes se-turn-prev { from { transform: rotateY(0deg) } to { transform: rotateY(180deg) } }
        @keyframes se-turn-in   { from { transform: rotateY(-180deg) } to { transform: rotateY(0deg) } }
        @keyframes se-shade     { 0% { opacity:0 } 50% { opacity:.45 } 100% { opacity:0 } }
        @keyframes se-cast      { 0% { opacity:.0 } 45% { opacity:.35 } 100% { opacity:0 } }
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
      <div className={`flex-1 relative ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {!doc || shown.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
            <Loader2 className="w-8 h-8 animate-spin" />
            <div className="text-sm">Kitap hazırlanıyor{progress > 0 && progress < 100 ? ` · %${progress}` : "…"}</div>
          </div>
        ) : (
          <div className="min-h-full flex items-center justify-center p-3" onClick={onStageClick}>
            {flip ? <FlipView flip={flip} /> : (
              <div className="flex shadow-2xl">
                {shown.map((r, k) => (
                  <div key={k} className="relative">
                    <Snap r={r} />
                    {shown.length === 2 && <div className="se-shade" style={{ background: k === 0
                      ? "linear-gradient(to left, rgba(0,0,0,.12), transparent 7%)"
                      : "linear-gradient(to right, rgba(0,0,0,.12), transparent 7%)" }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {doc && (
          <>
            <button onClick={() => go(-1)} disabled={page <= 1} aria-label="Önceki sayfa"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 items-center justify-center">
              <ChevronLeft size={24} />
            </button>
            <button onClick={() => go(1)} disabled={lastVisible >= numPages} aria-label="Sonraki sayfa"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 items-center justify-center">
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Alt çubuk */}
      <div className="flex items-center gap-3 px-4 shrink-0" style={{ height: BAR_H }}>
        <button onClick={() => go(-1)} disabled={!doc || page <= 1} aria-label="Önceki sayfa" className="sm:hidden p-2 disabled:opacity-30"><ChevronLeft size={22} /></button>
        <input type="range" min={1} max={Math.max(1, numPages)} value={page} disabled={!doc} aria-label="Sayfaya git"
          onChange={(e) => setPage(Number(e.target.value))} className="flex-1 accent-[#13a9e0]" />
        <div className="text-xs text-slate-300 tabular-nums whitespace-nowrap">{numPages ? `${pageLabel} / ${numPages}` : ""}</div>
        <button onClick={() => go(1)} disabled={!doc || lastVisible >= numPages} aria-label="Sonraki sayfa" className="sm:hidden p-2 disabled:opacity-30"><ChevronRight size={22} /></button>
      </div>
    </div>
  );
}

// ─── Yaprak çevirme görünümü ───────────────────────────────────────────────
function FlipView({ flip }: { flip: Flip }) {
  const anim = (name: string) => `${name} ${FLIP_MS}ms cubic-bezier(.35,.1,.25,1) forwards`;

  if (flip.mode === "spread") {
    const [L, R] = flip.under;
    const w = (L ?? R)?.w ?? 300, h = (L ?? R)?.h ?? 420;
    const next = flip.dir === "next";
    return (
      <div className="relative flex shadow-2xl" style={{ width: w * 2, height: h, perspective: w * 4 }}>
        <Snap r={L} style={{ width: w, height: h }} />
        <Snap r={R} style={{ width: w, height: h }} />
        {/* Yaprak: ileri → sağ sayfa sırttan sola döner; geri → sol sayfa sırttan sağa döner */}
        <div className="se-leaf" style={{ left: next ? w : 0, width: w, height: h, transformOrigin: next ? "left center" : "right center", animation: anim(next ? "se-turn-next" : "se-turn-prev") }}>
          <div className="se-face"><Snap r={flip.front} style={{ width: w, height: h }} />
            <div className="se-shade" style={{ background: `linear-gradient(to ${next ? "left" : "right"}, rgba(0,0,0,.35), transparent)`, animation: anim("se-shade") }} /></div>
          <div className="se-face back"><Snap r={flip.back} style={{ width: w, height: h }} />
            <div className="se-shade" style={{ background: `linear-gradient(to ${next ? "right" : "left"}, rgba(0,0,0,.35), transparent)`, animation: anim("se-shade") }} /></div>
        </div>
        {/* Yaprağın alttaki sayfaya düşen gölgesi */}
        <div className="se-shade" style={{ left: next ? w : 0, width: w, background: "rgba(0,0,0,1)", animation: anim("se-cast") }} />
      </div>
    );
  }

  // Tek sayfa: ileri → üstteki eski sayfa sol kenardan kalkıp döner; geri → yeni sayfa soldan dönerek üstüne kapanır
  const base = flip.under.filter(Boolean) as Rendered[];
  const w = base.reduce((s, r) => s + r.w, 0) || flip.front?.w || 300;
  const h = base[0]?.h ?? flip.front?.h ?? 420;
  const lw = flip.front?.w ?? w;
  const next = flip.dir === "next";
  return (
    <div className="relative flex shadow-2xl" style={{ width: w, height: h, perspective: lw * 3.5 }}>
      {base.map((r, k) => <Snap key={k} r={r} />)}
      <div className="se-shade" style={{ background: "rgba(0,0,0,1)", animation: anim("se-cast") }} />
      <div className="se-leaf" style={{ left: (w - lw) / 2, width: lw, height: h, transformOrigin: "left center", animation: anim(next ? "se-turn-next" : "se-turn-in") }}>
        <div className="se-face"><Snap r={flip.front} style={{ width: lw, height: h }} />
          <div className="se-shade" style={{ background: "linear-gradient(to left, rgba(0,0,0,.35), transparent)", animation: anim("se-shade") }} /></div>
        <div className="se-face back" style={{ background: "#f3f1ec" }} />
      </div>
    </div>
  );
}

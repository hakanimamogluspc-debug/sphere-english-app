/**
 * ClickableText — Herhangi bir İngilizce metni tıklanabilir kelime span'lerine böler.
 * Kelime tıklanınca DictPopover açılır: TR çeviri + telaffuz + EN tanım.
 *
 * Kullanım:
 *   <ClickableText text="Let's circle back on that next week." />
 *   <ClickableText text={aiMessage} vocab={vocabMap} />   // key_vocab varsa vurgula
 *
 * Backend: GET /api/dictionary/:word (Free Dictionary + GPT TR fallback + cache)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Volume2, X } from "lucide-react";
import { API } from "@/lib/api-url";

type DictResult = {
  word: string;
  tr: string | null;
  phonetic: string | null;
  audio_url: string | null;
  definitions: Array<{ pos: string; meaning: string; example: string | null }>;
} | null;

// Sayfa açıkken cache — aynı kelime tekrar fetch etmez
const dictCache = new Map<string, DictResult>();

export type VocabHint = { meaning_tr: string; context?: string };

async function apiFetch(path: string) {
  const token = localStorage.getItem("sphere_token");
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
  return data;
}

export function ClickableText({
  text,
  vocab,
  className,
  inline,
}: {
  text: string;
  vocab?: Map<string, VocabHint>;
  className?: string;
  inline?: boolean; // true ise <span>, false ise <div>
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openWord, setOpenWord] = useState<string>("");
  const [openRef, setOpenRef] = useState<HTMLElement | null>(null);

  const tokens = useMemo(() => {
    const parts: Array<{ type: "word" | "text"; value: string }> = [];
    const re = /([A-Za-z][A-Za-z'\-]*)/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) parts.push({ type: "text", value: text.slice(lastIdx, m.index) });
      parts.push({ type: "word", value: m[1] });
      lastIdx = m.index + m[1].length;
    }
    if (lastIdx < text.length) parts.push({ type: "text", value: text.slice(lastIdx) });
    return parts;
  }, [text]);

  // Popover dışı tıklama → kapat
  useEffect(() => {
    if (!openKey) return;
    const h = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dict-popover]") && !target.closest("[data-dict-word]")) {
        setOpenKey(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openKey]);

  const Wrapper = inline ? "span" : "div";

  return (
    <Wrapper className={className}>
      {tokens.map((t, i) => {
        if (t.type === "text") return <span key={i}>{t.value}</span>;
        const isVocab = vocab?.has(t.value.toLowerCase());
        const key = `${i}-${t.value}`;
        return (
          <span
            key={i}
            data-dict-word
            onClick={(e) => {
              e.stopPropagation();
              setOpenRef(e.currentTarget);
              setOpenWord(t.value);
              setOpenKey(openKey === key ? null : key);
            }}
            className={`cursor-pointer transition ${
              isVocab
                ? "border-b-2 border-dotted border-violet-400 bg-violet-50/60 rounded px-0.5 hover:bg-violet-100"
                : "hover:bg-yellow-100 rounded px-0.5"
            }`}
          >
            {t.value}
          </span>
        );
      })}
      {openKey && openRef && (
        <DictPopover
          word={openWord}
          anchor={openRef}
          context={text.slice(0, 300)}
          vocab={vocab?.get(openWord.toLowerCase())}
          onClose={() => setOpenKey(null)}
        />
      )}
    </Wrapper>
  );
}

/**
 * DictionaryHost — herhangi bir çocuğun içindeki metne tıklandığında
 * (dangerouslySetInnerHTML kullanan bileşenler dahil) o kelimeye popover açar.
 *
 * Kullanım:
 *   <DictionaryHost><SomeMarkdownRenderer html={...} /></DictionaryHost>
 */
export function DictionaryHost({ children, className }: { children: React.ReactNode; className?: string }) {
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [openRect, setOpenRect] = useState<DOMRect | null>(null);
  const [context, setContext] = useState("");
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openWord) return;
    const h = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dict-popover]")) setOpenWord(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openWord]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const doc: any = document;
    let range: Range | null = null;
    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range) return;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent ?? "";
    const offset = range.startOffset;

    // Kelime sınırını bul
    const re = /[A-Za-z'\-]/;
    let start = offset;
    let end = offset;
    while (start > 0 && re.test(text[start - 1])) start--;
    while (end < text.length && re.test(text[end])) end++;
    const word = text.slice(start, end).trim();
    if (!word || word.length < 2 || !/^[A-Za-z]/.test(word)) return;

    // Kelime bounding rect'i
    try {
      const wordRange = document.createRange();
      wordRange.setStart(node, start);
      wordRange.setEnd(node, end);
      const rect = wordRange.getBoundingClientRect();
      setOpenRect(rect);
    } catch { setOpenRect(null); }

    // Context: kelimenin geçtiği cümle (100 char öncesi + sonrası)
    const ctxStart = Math.max(0, offset - 100);
    const ctxEnd = Math.min(text.length, offset + 100);
    setContext(text.slice(ctxStart, ctxEnd));
    setOpenWord(word);
  }

  return (
    <div ref={hostRef} onClick={handleClick} className={className} style={{ position: "relative" }}>
      {children}
      {openWord && openRect && (
        <DictPopoverAtRect
          word={openWord}
          rect={openRect}
          context={context}
          onClose={() => setOpenWord(null)}
        />
      )}
    </div>
  );
}

function DictPopoverAtRect(props: { word: string; rect: DOMRect; context: string; onClose: () => void }) {
  // Sahte anchor yerine sadece rect kullanan varyant — position hesabı DictPopover ile aynı
  const [data, setData] = useState<DictResult>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const key = props.word.toLowerCase();

  useEffect(() => {
    if (dictCache.has(key)) { setData(dictCache.get(key)!); return; }
    setLoading(true); setNotFound(false);
    const params = new URLSearchParams({ context: props.context.slice(0, 250) });
    apiFetch(`/dictionary/${encodeURIComponent(key)}?${params}`)
      .then(d => { dictCache.set(key, d); setData(d); })
      .catch(() => { dictCache.set(key, null); setNotFound(true); })
      .finally(() => setLoading(false));
  }, [key]);

  const rect = props.rect;
  const popoverW = 320;
  const popoverH = 220;
  let top = rect.bottom + 6;
  let left = rect.left + rect.width / 2 - popoverW / 2;
  if (left + popoverW > window.innerWidth - 8) left = window.innerWidth - popoverW - 8;
  if (left < 8) left = 8;
  if (top + popoverH > window.innerHeight - 8) top = rect.top - popoverH - 6;

  function playAudio() {
    if (!data?.audio_url) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    audioRef.current = new Audio(data.audio_url);
    audioRef.current.play().catch(() => {});
  }

  return (
    <div
      data-dict-popover
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", top, left, zIndex: 60 }}
      className="w-80 rounded-lg bg-white border border-gray-200 shadow-xl overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
        <div className="font-bold text-gray-900">{props.word}</div>
        {data?.phonetic && <span className="text-xs text-gray-500 font-mono">{data.phonetic}</span>}
        {data?.audio_url && (
          <button onClick={playAudio} className="ml-auto rounded p-1 hover:bg-white text-indigo-600" title="Telaffuz">
            <Volume2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={props.onClose} className="rounded p-1 hover:bg-white text-gray-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {loading && <div className="text-center py-2"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>}
        {notFound && <div className="text-xs text-gray-500 italic">Bu kelime bulunamadı.</div>}
        {data?.tr && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">Türkçe</div>
            <div className="text-sm font-semibold text-emerald-900">{data.tr}</div>
          </div>
        )}
        {data?.definitions && data.definitions.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">İngilizce Tanım</div>
            {data.definitions.slice(0, 2).map((d, i) => (
              <div key={i} className="text-xs text-gray-700 mb-1.5">
                <span className="italic text-gray-400 mr-1">{d.pos}.</span>
                {d.meaning}
                {d.example && <div className="text-[11px] italic text-gray-500 mt-0.5">e.g. "{d.example}"</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DictPopover({ word, anchor, context, vocab, onClose }: {
  word: string;
  anchor: HTMLElement;
  context: string;
  vocab?: VocabHint;
  onClose: () => void;
}) {
  const [data, setData] = useState<DictResult>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const key = word.toLowerCase();

  useEffect(() => {
    if (dictCache.has(key)) { setData(dictCache.get(key)!); return; }
    setLoading(true); setNotFound(false);
    const params = new URLSearchParams({ context: context.slice(0, 250) });
    apiFetch(`/dictionary/${encodeURIComponent(key)}?${params}`)
      .then(d => { dictCache.set(key, d); setData(d); })
      .catch(() => { dictCache.set(key, null); setNotFound(true); })
      .finally(() => setLoading(false));
  }, [key, context]);

  // Viewport coords + position:fixed → hangi container'da olursa olsun doğru yer
  const rect = anchor.getBoundingClientRect();
  const popoverW = 320;
  const popoverH = 220; // yaklaşık, ekran taşarsa üste al
  let top = rect.bottom + 6;
  let left = rect.left + rect.width / 2 - popoverW / 2;
  // Sağ taşma
  if (left + popoverW > window.innerWidth - 8) left = window.innerWidth - popoverW - 8;
  // Sol taşma
  if (left < 8) left = 8;
  // Alt taşma → üstte göster
  if (top + popoverH > window.innerHeight - 8) top = rect.top - popoverH - 6;

  function playAudio() {
    if (!data?.audio_url) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    audioRef.current = new Audio(data.audio_url);
    audioRef.current.play().catch(() => {});
  }

  return (
    <div
      data-dict-popover
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", top, left, zIndex: 60 }}
      className="w-80 rounded-lg bg-white border border-gray-200 shadow-xl overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
        <div className="font-bold text-gray-900">{word}</div>
        {data?.phonetic && <span className="text-xs text-gray-500 font-mono">{data.phonetic}</span>}
        {data?.audio_url && (
          <button onClick={playAudio} className="ml-auto rounded p-1 hover:bg-white text-indigo-600" title="Telaffuz">
            <Volume2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={onClose} className="rounded p-1 hover:bg-white text-gray-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {loading && <div className="text-center py-2"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>}
        {notFound && <div className="text-xs text-gray-500 italic">Bu kelime bulunamadı.</div>}
        {data?.tr && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">Türkçe</div>
            <div className="text-sm font-semibold text-emerald-900">{data.tr}</div>
          </div>
        )}
        {vocab && (
          <div className="rounded bg-violet-50 border border-violet-200 p-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-0.5">Bağlam</div>
            <div className="text-xs italic text-violet-900">"{vocab.context ?? ""}"</div>
            <div className="text-xs text-violet-900 mt-1">{vocab.meaning_tr}</div>
          </div>
        )}
        {data?.definitions && data.definitions.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">İngilizce Tanım</div>
            {data.definitions.slice(0, 2).map((d, i) => (
              <div key={i} className="text-xs text-gray-700 mb-1.5">
                <span className="italic text-gray-400 mr-1">{d.pos}.</span>
                {d.meaning}
                {d.example && <div className="text-[11px] italic text-gray-500 mt-0.5">e.g. "{d.example}"</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

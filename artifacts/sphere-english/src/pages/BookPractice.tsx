import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { ArrowLeft, Layers, ListChecks, MessageCircle, Loader2, Volume2, RotateCcw, Check, X, Send, Sparkles, Lightbulb } from "lucide-react";
import { API } from "@/lib/api-url";

/** /kitaplarim/:id — kitaba özel pratik: kartlar (aralıklı tekrar), mini test, AI koçla rol yapma */

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch { /* desteklenmiyor */ }
}

interface Unit { order: number; title: string; total: number; patterns: number; terms: number; seen: number; learned: number; due: number; bestQuiz: number | null }
type Tab = "cards" | "quiz" | "coach";

export default function BookPractice() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<{ title: string } | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unit, setUnit] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("cards");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch(`/me/ebooks/${id}/practice`);
      setBook(d.book); setUnits(d.units);
    } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const total = units.reduce((s, u) => s + u.total, 0);
  const learned = units.reduce((s, u) => s + u.learned, 0);
  const due = units.reduce((s, u) => s + u.due, 0);

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-center">
      <p className="text-slate-600">{error}</p>
      <a href="/kitaplarim" className="inline-block mt-4 text-[#0e7da6] font-semibold">← Kitaplarım</a>
    </div>
  );
  if (!book) return <div className="py-20 text-center"><Loader2 className="w-7 h-7 animate-spin text-[#13a9e0] mx-auto" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <a href="/kitaplarim" className="text-sm text-[#0e7da6] inline-flex items-center gap-1 mb-3"><ArrowLeft size={15} /> Kitaplarım</a>
      <h1 className="text-2xl font-extrabold text-[#1e3a6e]">{book.title}</h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
        <div className="flex-1 max-w-xs h-2 rounded-full bg-[#e8eef8] overflow-hidden"><div className="h-full bg-[#13a9e0]" style={{ width: `${total ? (learned / total) * 100 : 0}%` }} /></div>
        <span><b className="text-[#1e3a6e]">{learned}</b>/{total} öğrenildi{due > 0 && <> · <b className="text-[#0e7da6]">{due}</b> tekrar bekliyor</>}</span>
      </div>

      <div className="mt-5">
        <label className="text-xs font-semibold text-slate-500">Bölüm</label>
        <select value={unit ?? ""} onChange={(e) => setUnit(e.target.value ? Number(e.target.value) : null)}
          className="mt-1 w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white">
          <option value="">Tüm kitap</option>
          {units.map((u) => <option key={u.order} value={u.order}>{u.title} — {u.learned}/{u.total}{u.bestQuiz !== null ? ` · test %${u.bestQuiz}` : ""}</option>)}
        </select>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {([["cards", Layers, "Kartlar"], ["quiz", ListChecks, "Mini test"], ["coach", MessageCircle, "AI koç"]] as const).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 border ${tab === k ? "bg-[#1e3a6e] text-white border-[#1e3a6e]" : "bg-white text-[#1e3a6e] border-slate-200"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "cards" && <Cards key={`c-${unit}`} bookId={id} unit={unit} onChange={load} />}
        {tab === "quiz" && <Quiz key={`q-${unit}`} bookId={id} unit={unit} onDone={load} />}
        {tab === "coach" && <Coach key={`k-${unit}`} bookId={id} unit={unit} />}
      </div>
    </div>
  );
}

// ─── Kartlar ───────────────────────────────────────────────────────────────
interface Card { id: number; kind: "pattern" | "term"; en: string; tr: string; explanation: string | null; exampleEn: string | null; exampleTr: string | null; isNew: boolean }

function Cards({ bookId, unit, onChange }: { bookId: string; unit: number | null; onChange: () => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ know: 0, again: 0 });

  const fetchCards = useCallback(async () => {
    setCards(null); setI(0); setFlipped(false);
    const d = await apiFetch(`/me/ebooks/${bookId}/practice/cards${unit ? `?unit=${unit}` : ""}`);
    setCards(d.cards);
  }, [bookId, unit]);
  useEffect(() => { fetchCards().catch(() => setCards([])); }, [fetchCards]);

  async function answer(result: "know" | "again") {
    const c = cards?.[i];
    if (!c || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/me/ebooks/practice/review`, { method: "POST", body: JSON.stringify({ itemId: c.id, result }) });
      setStats((s) => ({ ...s, [result]: s[result] + 1 }));
      // "Tekrar et" denen kart bu turun sonuna eklenir
      if (result === "again") setCards((cs) => (cs ? [...cs, c] : cs));
      setI((n) => n + 1); setFlipped(false);
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  if (!cards) return <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#13a9e0] mx-auto" /></div>;
  if (i >= cards.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <Sparkles className="w-9 h-9 text-[#13a9e0] mx-auto mb-2" />
        <h3 className="font-bold text-[#1e3a6e]">{cards.length === 0 ? "Şu an tekrar edilecek kart yok" : "Bu turu bitirdin"}</h3>
        {cards.length > 0 && <p className="text-sm text-slate-500 mt-1">Biliyorum: {stats.know} · Tekrar: {stats.again}</p>}
        <p className="text-sm text-slate-500 mt-2">Bildiğin kartlar giderek daha seyrek gelir; unutmaya yakın olanlar yeniden sorulur.</p>
        <button onClick={() => { onChange(); fetchCards(); }} className="mt-4 px-5 py-2.5 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold inline-flex items-center gap-2">
          <RotateCcw size={15} /> Yeni kartlar
        </button>
      </div>
    );
  }
  const c = cards[i];
  return (
    <div>
      <div className="text-xs text-slate-500 mb-2">{i + 1} / {cards.length}{c.isNew && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#e8eef8] text-[#0e7da6] font-semibold">Yeni</span>}</div>
      <button onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[240px] rounded-2xl border border-slate-200 bg-white p-6 text-left flex flex-col justify-center shadow-sm">
        <span className={`self-start text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${c.kind === "pattern" ? "bg-[#e8eef8] text-[#1e3a6e]" : "bg-sky-50 text-[#0e7da6]"}`}>{c.kind === "pattern" ? "Kalıp" : "Terim"}</span>
        <div className="mt-3 flex items-start gap-2">
          <span className="text-2xl font-extrabold text-[#1e3a6e] leading-snug flex-1">{c.en}</span>
          <span role="button" tabIndex={0} aria-label="Dinle" onClick={(e) => { e.stopPropagation(); speak(c.en); }}
            className="p-2 rounded-full hover:bg-[#e8eef8] text-[#0e7da6]"><Volume2 size={20} /></span>
        </div>
        {!flipped && <div className="mt-6 text-sm text-slate-400">Anlamını düşün, sonra kartı çevirmek için dokun</div>}
        {flipped && (
          <div className="mt-4 space-y-2">
            <div className="text-lg text-slate-800 font-semibold">{c.tr}</div>
            {c.explanation && <div className="text-sm text-slate-600">{c.explanation}</div>}
            {c.exampleEn && (
              <div className="text-sm bg-[#f7f9fd] rounded-lg p-3">
                <div className="text-[#0e7da6] italic">“{c.exampleEn}”</div>
                {c.exampleTr && <div className="text-slate-500 mt-1">{c.exampleTr}</div>}
              </div>
            )}
          </div>
        )}
      </button>
      {flipped ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => answer("again")} disabled={busy} className="py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold inline-flex items-center justify-center gap-1.5"><RotateCcw size={16} /> Tekrar et</button>
          <button onClick={() => answer("know")} disabled={busy} className="py-3 rounded-xl bg-[#1e3a6e] text-white font-bold inline-flex items-center justify-center gap-1.5"><Check size={16} /> Biliyorum</button>
        </div>
      ) : (
        <button onClick={() => setFlipped(true)} className="mt-3 w-full py-3 rounded-xl bg-[#13a9e0] text-white font-bold">Kartı çevir</button>
      )}
    </div>
  );
}

// ─── Mini test ─────────────────────────────────────────────────────────────
interface Q { itemId: number; type: "meaning" | "reverse" | "blank"; prompt: string; hint: string | null; options: string[]; answer: number }
const Q_LABEL: Record<Q["type"], string> = { meaning: "Bu ifadenin anlamı hangisi?", reverse: "Bunu İngilizce nasıl söylersin?", blank: "Boşluğa hangisi gelir?" };

function Quiz({ bookId, unit, onDone }: { bookId: string; unit: number | null; onDone: () => void }) {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);

  const start = useCallback(async () => {
    setQs(null); setErr(null); setI(0); setPicked(null); setWrong([]); setSaved(false);
    try { setQs((await apiFetch(`/me/ebooks/${bookId}/practice/quiz${unit ? `?unit=${unit}` : ""}`)).questions); }
    catch (e: any) { setErr(e.message); }
  }, [bookId, unit]);
  useEffect(() => { start(); }, [start]);

  const finished = qs !== null && i >= qs.length;
  useEffect(() => {
    if (!finished || saved || !qs) return;
    setSaved(true);
    apiFetch(`/me/ebooks/${bookId}/practice/quiz-result`, {
      method: "POST", body: JSON.stringify({ unitOrder: unit, correct: qs.length - wrong.length, total: qs.length, wrongItemIds: wrong }),
    }).then(onDone).catch(() => {});
  }, [finished, saved, qs, wrong, bookId, unit, onDone]);

  if (err) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">{err}</div>;
  if (!qs) return <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#13a9e0] mx-auto" /></div>;
  if (finished) {
    const score = qs.length - wrong.length;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="text-4xl font-extrabold text-[#1e3a6e]">{score}/{qs.length}</div>
        <p className="text-sm text-slate-600 mt-2">{wrong.length ? `Yanlış yaptığın ${wrong.length} öğe kart tekrarında öne alındı.` : "Hepsi doğru!"}</p>
        <button onClick={start} className="mt-4 px-5 py-2.5 rounded-lg bg-[#1e3a6e] text-white text-sm font-bold inline-flex items-center gap-2"><RotateCcw size={15} /> Yeni test</button>
      </div>
    );
  }
  const q = qs[i];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex justify-between text-xs text-slate-500"><span>{Q_LABEL[q.type]}</span><span>{i + 1}/{qs.length}</span></div>
      <div className="mt-3 text-lg font-bold text-[#1e3a6e] leading-snug">{q.prompt}</div>
      {q.hint && <div className="text-sm text-slate-500 mt-1">({q.hint})</div>}
      <div className="mt-4 space-y-2">
        {q.options.map((o, k) => {
          const state = picked === null ? "" : k === q.answer ? "border-emerald-400 bg-emerald-50" : k === picked ? "border-red-300 bg-red-50" : "opacity-60";
          return (
            <button key={k} disabled={picked !== null}
              onClick={() => { setPicked(k); if (k !== q.answer) setWrong((w) => [...w, q.itemId]); }}
              className={`w-full text-left px-4 py-3 rounded-xl border border-slate-200 text-sm flex items-center gap-2 ${state}`}>
              <span className="flex-1">{o}</span>
              {picked !== null && k === q.answer && <Check size={16} className="text-emerald-600" />}
              {picked === k && k !== q.answer && <X size={16} className="text-red-500" />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button onClick={() => { setI(i + 1); setPicked(null); }} className="mt-4 w-full py-3 rounded-xl bg-[#1e3a6e] text-white font-bold">
          {i + 1 < qs.length ? "Sonraki soru" : "Sonucu gör"}
        </button>
      )}
    </div>
  );
}

// ─── AI koç ────────────────────────────────────────────────────────────────
interface Msg { role: "user" | "assistant"; content: string; tip?: string | null }

function Coach({ bookId, unit }: { bookId: string; unit: number | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [scene, setScene] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [turn, setTurn] = useState({ n: 0, max: 8 });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async (history: Msg[]) => {
    setBusy(true); setErr(null);
    try {
      const d = await apiFetch(`/me/ebooks/${bookId}/practice/coach`, {
        method: "POST",
        body: JSON.stringify({ unit, messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (d.scene) setScene(d.scene);
      setTargets(d.targets); setUsed(d.used); setDone(d.done); setTurn({ n: d.turn, max: d.maxTurns });
      setMsgs([...history, { role: "assistant", content: d.reply, tip: d.tip }]);
    } catch (e: any) { setErr(e.message); setMsgs(history); } finally { setBusy(false); }
  }, [bookId, unit]);

  const restart = useCallback(() => { setMsgs([]); setScene(null); setUsed([]); setDone(false); send([]); }, [send]);
  useEffect(() => { restart(); }, [restart]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, busy]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy || done) return;
    setInput("");
    const h: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(h);
    send(h);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {scene && <div className="text-sm bg-[#e8eef8] text-[#1e3a6e] rounded-xl p-3 mb-3"><b>Durum:</b> {scene}</div>}
      {targets.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-slate-500 mb-1.5">Konuşmada kullanmaya çalış ({used.length}/{targets.length}):</div>
          <div className="flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <span key={t} className={`text-xs px-2 py-1 rounded-full border ${used.includes(t) ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`}>
                {used.includes(t) && "✓ "}{t}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {msgs.map((m, k) => (
          <div key={k} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block max-w-[85%] text-left px-3.5 py-2.5 rounded-2xl text-sm ${m.role === "user" ? "bg-[#1e3a6e] text-white" : "bg-[#f1f5fb] text-slate-800"}`}>
              {m.content}
              {m.role === "assistant" && (
                <button onClick={() => speak(m.content)} aria-label="Dinle" className="ml-1.5 align-middle text-[#0e7da6]"><Volume2 size={14} /></button>
              )}
            </div>
            {m.tip && <div className="mt-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-flex gap-1.5 max-w-[85%] text-left"><Lightbulb size={14} className="shrink-0 mt-0.5" />{m.tip}</div>}
          </div>
        ))}
        {busy && <div className="text-xs text-slate-400 inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> yazıyor…</div>}
        <div ref={endRef} />
      </div>
      {err && <div className="mt-2 text-xs text-red-700">{err}</div>}
      {done ? (
        <button onClick={restart} className="mt-4 w-full py-3 rounded-xl bg-[#1e3a6e] text-white font-bold inline-flex items-center justify-center gap-2"><RotateCcw size={15} /> Yeni konuşma</button>
      ) : (
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={600} placeholder="İngilizce yanıtını yaz…"
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#13a9e0]" disabled={busy || msgs.length === 0} />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Gönder" className="px-4 rounded-xl bg-[#1e3a6e] text-white disabled:opacity-50"><Send size={16} /></button>
        </form>
      )}
      <div className="mt-2 text-[11px] text-slate-400 text-right">Tur {Math.min(turn.n, turn.max)}/{turn.max}</div>
    </div>
  );
}

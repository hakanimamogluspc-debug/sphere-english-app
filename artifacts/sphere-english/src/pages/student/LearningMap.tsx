import { useEffect, useState } from "react";
import { Link } from "wouter";
import { API } from "@/lib/api-url";
import {
  Compass, Loader2, Clock, Calendar, Trophy, TrendingUp, MapPin, Star, Sparkles,
  Mic, PenLine, Brain, Gamepad2, Briefcase, GraduationCap, Presentation, Wand2,
  BookOpen, Newspaper, Users, BookMarked,
} from "lucide-react";

/**
 * /yolculugum — Öğrenme haritası
 *
 * 15 modülün her biri bir kart. Kullanıcının ne kadar süre harcadığı, kaç gün
 * girdiği, favori modülü. Boş modüller "keşfet" davetiyle grileşir.
 */

const TOKEN_KEY = "sphere_token";

interface ModuleStat {
  key: string;
  total_minutes: number;
  days_visited: number;
  first_visit: string | null;
  last_visit: string | null;
  visited: boolean;
}

interface LearningMapData {
  summary: {
    total_minutes: number;
    total_hours: number;
    modules_visited: number;
    modules_total: number;
    exploration_pct: number;
    current_level: string | null;
    streak: number;
    streak_freezes: number;
    member_since: string | null;
  };
  favorite_module: string | null;
  modules: ModuleStat[];
}

// modül key → görsel bilgi
const MODULE_META: Record<string, { name: string; icon: React.ReactNode; color: string; href: string }> = {
  pronunciation_coach:   { name: "Konuşma Koçu",         icon: <Mic size={18} />,          color: "purple",  href: "/student/pronunciation-coach" },
  writing_coach:         { name: "Yazma Koçu",           icon: <PenLine size={18} />,      color: "blue",    href: "/student/writing-coach" },
  grammar_coach:         { name: "Dilbilgisi Koçu",      icon: <Brain size={18} />,        color: "indigo",  href: "/student/grammar-coach" },
  vocab_game:            { name: "Kelime Oyunu",         icon: <Gamepad2 size={18} />,     color: "pink",    href: "/student/vocab-game" },
  simulation_mode:       { name: "İş Senaryoları",       icon: <Briefcase size={18} />,    color: "amber",   href: "/student/simulation-mode" },
  interview_sim:         { name: "Mülakat Simülatörü",   icon: <GraduationCap size={18} />, color: "emerald", href: "/student/interview-sim" },
  presentation_sim:      { name: "Sunum Simülatörü",     icon: <Presentation size={18} />, color: "orange",  href: "/student/presentation-sim" },
  ai_quiz:               { name: "Akıllı Quiz",          icon: <Wand2 size={18} />,        color: "violet",  href: "/student/ai-quiz" },
  ai_tutor:              { name: "Kişisel AI Öğretmen",  icon: <GraduationCap size={18} />, color: "teal",   href: "/student/ai-tutor" },
  learning_path:         { name: "Öğrenme Yolu",         icon: <Compass size={18} />,      color: "sky",     href: "/student/learning-path" },
  level_exams:           { name: "Seviye Sınavları",     icon: <Trophy size={18} />,       color: "yellow",  href: "/student/level-exams" },
  speaking_scenes:       { name: "Konuşma Sahneleri",    icon: <Mic size={18} />,          color: "rose",    href: "/student/speaking-scenes" },
  student_materials:     { name: "Materyallerim",        icon: <BookOpen size={18} />,     color: "slate",   href: "/student/materials" },
  student_speaking_club: { name: "Speaking Club",        icon: <Users size={18} />,        color: "cyan",    href: "/student/speaking-club" },
  career:                { name: "İzle & Dinle",         icon: <Compass size={18} />,      color: "lime",    href: "/kariyer" },
  discover:              { name: "Keşfet",               icon: <Newspaper size={18} />,    color: "fuchsia", href: "/kesfet" },
  watch_listen:          { name: "İzle & Dinle",         icon: <Newspaper size={18} />,    color: "green",   href: "/kariyer" },
  business_cards:        { name: "İş Kartları",          icon: <BookMarked size={18} />,   color: "amber",   href: "/is-kartlari" },
};

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; icon: string; bar: string }> = {
  purple:  { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-900",  icon: "text-purple-600",  bar: "bg-purple-500" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-900",    icon: "text-blue-600",    bar: "bg-blue-500" },
  indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-900",  icon: "text-indigo-600",  bar: "bg-indigo-500" },
  pink:    { bg: "bg-pink-50",    border: "border-pink-200",    text: "text-pink-900",    icon: "text-pink-600",    bar: "bg-pink-500" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-900",   icon: "text-amber-600",   bar: "bg-amber-500" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", icon: "text-emerald-600", bar: "bg-emerald-500" },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-900",  icon: "text-orange-600",  bar: "bg-orange-500" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-900",  icon: "text-violet-600",  bar: "bg-violet-500" },
  teal:    { bg: "bg-teal-50",    border: "border-teal-200",    text: "text-teal-900",    icon: "text-teal-600",    bar: "bg-teal-500" },
  sky:     { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-900",     icon: "text-sky-600",     bar: "bg-sky-500" },
  yellow:  { bg: "bg-yellow-50",  border: "border-yellow-200",  text: "text-yellow-900",  icon: "text-yellow-600",  bar: "bg-yellow-500" },
  rose:    { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-900",    icon: "text-rose-600",    bar: "bg-rose-500" },
  slate:   { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-900",   icon: "text-slate-600",   bar: "bg-slate-500" },
  cyan:    { bg: "bg-cyan-50",    border: "border-cyan-200",    text: "text-cyan-900",    icon: "text-cyan-600",    bar: "bg-cyan-500" },
  lime:    { bg: "bg-lime-50",    border: "border-lime-200",    text: "text-lime-900",    icon: "text-lime-600",    bar: "bg-lime-500" },
  fuchsia: { bg: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-900", icon: "text-fuchsia-600", bar: "bg-fuchsia-500" },
  green:   { bg: "bg-green-50",   border: "border-green-200",   text: "text-green-900",   icon: "text-green-600",   bar: "bg-green-500" },
};

async function apiFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}s ${rem}dk` : `${h} saat`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "2-digit" });
}

function ModuleCard({ mod, isFavorite, maxMinutes }: { mod: ModuleStat; isFavorite: boolean; maxMinutes: number }) {
  const meta = MODULE_META[mod.key];
  if (!meta) return null;
  const colors = COLOR_CLASSES[meta.color] ?? COLOR_CLASSES.slate;
  const progressPct = maxMinutes > 0 ? Math.min(100, (mod.total_minutes / maxMinutes) * 100) : 0;

  if (!mod.visited) {
    return (
      <Link
        href={meta.href}
        className="border-2 border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl p-4 flex items-center gap-3 transition-colors group"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-500">{meta.name}</div>
          <p className="text-xs text-slate-400 italic">Henüz keşfetmedin — dokun ve başla</p>
        </div>
        <Sparkles className="text-slate-300 group-hover:text-amber-500 transition-colors" size={14} />
      </Link>
    );
  }

  return (
    <Link
      href={meta.href}
      className={`border ${colors.border} ${colors.bg} rounded-xl p-4 hover:shadow-md transition-shadow relative overflow-hidden`}
    >
      {isFavorite && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
          <Star size={10} className="text-amber-600 fill-current" />
          <span className="text-[10px] font-bold text-amber-800 uppercase">Favori</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center ${colors.icon} shrink-0`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-extrabold ${colors.text} truncate`}>{meta.name}</div>
          <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-0.5">
            <span className="flex items-center gap-0.5"><Clock size={10} />{fmtMinutes(mod.total_minutes)}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Calendar size={10} />{mod.days_visited} gün</span>
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-white rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.bar} transition-all`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
        <span>İlk: {fmtDate(mod.first_visit)}</span>
        <span>Son: {fmtDate(mod.last_visit)}</span>
      </div>
    </Link>
  );
}

export default function LearningMap() {
  const [data, setData] = useState<LearningMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/student/learning-map")
      .then(setData)
      .catch((e) => setError(e?.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error ?? "Harita yüklenemedi"}
        </div>
      </div>
    );
  }

  const { summary, favorite_module, modules } = data;
  const maxMinutes = Math.max(...modules.map((m) => m.total_minutes), 1);
  const visitedModules = modules.filter((m) => m.visited).sort((a, b) => b.total_minutes - a.total_minutes);
  const unvisitedModules = modules.filter((m) => !m.visited);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-2">
        <MapPin className="text-emerald-600" size={26} />
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Öğrenme Yolculuğun</h1>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Hangi modüllere ne kadar zaman ayırdın, favorilerin neler — tüm yolculuğun tek yerde.
      </p>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Clock className="text-emerald-500 mb-1" size={16} />
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{summary.total_hours}</div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Toplam Saat</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <TrendingUp className="text-indigo-500 mb-1" size={16} />
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {summary.modules_visited}<span className="text-sm text-slate-400">/{summary.modules_total}</span>
          </div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Modül Keşfi</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <Trophy className="text-amber-500 mb-1" size={16} />
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{summary.current_level ?? "—"}</div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Seviye</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-orange-500 mb-1 text-base">🔥</div>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{summary.streak}</div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Seri</p>
        </div>
      </div>

      {/* Keşif ilerleme */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-emerald-900">Keşif İlerlemesi</div>
          <div className="text-sm font-extrabold text-emerald-800 tabular-nums">%{summary.exploration_pct}</div>
        </div>
        <div className="h-2 bg-white rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
            style={{ width: `${summary.exploration_pct}%` }}
          />
        </div>
        <p className="text-xs text-emerald-800 mt-2">
          {summary.exploration_pct === 100
            ? "🎉 Tebrikler — tüm modülleri keşfettin!"
            : `${summary.modules_total - summary.modules_visited} modül seni bekliyor. Aşağıdan başla.`}
        </p>
      </div>

      {/* Keşfedilenler */}
      {visitedModules.length > 0 && (
        <>
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            Keşfettiklerin ({visitedModules.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {visitedModules.map((mod) => (
              <ModuleCard
                key={mod.key}
                mod={mod}
                isFavorite={mod.key === favorite_module}
                maxMinutes={maxMinutes}
              />
            ))}
          </div>
        </>
      )}

      {/* Keşfedilmeyenler */}
      {unvisitedModules.length > 0 && (
        <>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Henüz Keşfetmediklerin ({unvisitedModules.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unvisitedModules.map((mod) => (
              <ModuleCard key={mod.key} mod={mod} isFavorite={false} maxMinutes={maxMinutes} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

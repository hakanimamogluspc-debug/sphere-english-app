import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Star, Award, TrendingUp, BarChart2, BookOpen, Zap, CheckCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOGO_SRC = `${BASE}/images/sphere-logo.png`;
const AUDIO_SRCS = [0,1,2,3,4,5].map((i) => `${BASE}/audio/vo_${i}.mp3`);

const IMG = {
  login:         `${BASE}/images/app_login.jpg`,
  dashboard:     `${BASE}/images/app_dashboard.jpg`,
  pronunciation: `${BASE}/images/app_pronunciation.jpg`,
  courses:       `${BASE}/images/app_courses.jpg`,
  progress:      `${BASE}/images/app_progress.jpg`,
  quizzes:       `${BASE}/images/app_quizzes.jpg`,
};

const SCENE_DURATIONS = [
  4500,  // 0: Opening
  7500,  // 1: Dashboard
  7000,  // 2: Pronunciation Teachers
  7500,  // 3: Pronunciation Coach feature
  6500,  // 4: Progress & Quizzes
  7000,  // 5: CTA
];

const TOTAL_DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

const ease = [0.16, 1, 0.3, 1];
const spring = { type: "spring", stiffness: 130, damping: 26 };
const springSnappy = { type: "spring", stiffness: 400, damping: 30 };

const VO_SCRIPTS = [
  "Sphere English... İngilizce öğrenmenin yeni yolu.",
  "Tek platformda kişiselleştirilmiş dersler, canlı sınıflar ve interaktif alıştırmalar. Her şey senin için tasarlandı.",
  "Dört farklı yapay zeka İngilizce öğretmeni. Sarah, James, Emma veya Oliver ile istediğin zaman konuş, pratik yap.",
  "Telaffuz Koçu ile her kelimeyi doğru söyle. Yapay zeka telaffuzunu gerçek zamanlı analiz ediyor ve anında geri bildirim veriyor.",
  "Günlük ilerleme takibi, ödev takibi ve detaylı performans raporları. Gelişimini adım adım izle.",
  "Sphere English'e bugün ücretsiz katıl. Binlerce öğrenci zaten öğreniyor. Sen de onlardan biri ol."
];

function BrowserFrame({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`rounded-xl overflow-hidden shadow-2xl border border-white/10 ${className}`} style={{ background: "#1a1a2e" }}>
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#1e2030] border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="flex-1 mx-3 bg-white/5 rounded-md px-3 py-1 text-white/40 text-xs font-mono">
          app.sphereenglish.com
        </div>
      </div>
      <img src={src} alt="App screenshot" className="w-full block" />
    </div>
  );
}

function Voiceover({ scene }: { scene: number }) {
  return (
    <div className="absolute bottom-12 left-0 right-0 flex justify-center z-50 px-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease }}
          className="bg-black/65 backdrop-blur-md text-white px-8 py-4 rounded-2xl text-xl font-medium tracking-wide text-center max-w-4xl border border-white/10 shadow-2xl"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {VO_SCRIPTS[scene]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function SphereEnglishVideo() {
  const [scene, setScene] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    audioRef.current?.pause();
    const audio = new Audio(AUDIO_SRCS[scene]);
    audio.volume = 1;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => { audio.pause(); };
  }, [scene]);

  useEffect(() => {
    let start = Date.now();
    let lastScene = 0;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / TOTAL_DURATION) * 100));
      let acc = 0, cur = 0;
      for (let i = 0; i < SCENE_DURATIONS.length; i++) {
        acc += SCENE_DURATIONS[i];
        if (elapsed < acc) { cur = i; break; }
      }
      if (elapsed >= TOTAL_DURATION) { start = Date.now(); lastScene = 0; setScene(0); setProgress(0); }
      else if (cur !== lastScene) { lastScene = cur; setScene(cur); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="w-full h-screen bg-[#0a1628] overflow-hidden relative flex items-center justify-center font-sans select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f2952] via-[#0a1628] to-[#050d1a]" />
      <div className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #2563eb40 0%, transparent 50%), radial-gradient(circle at 80% 20%, #1d4ed840 0%, transparent 50%)" }}
      />

      {/* Brand Bar */}
      <AnimatePresence>
        {scene !== 0 && scene !== 5 && (
          <motion.div
            key="brand"
            className="absolute top-7 left-10 z-50 flex items-center gap-3"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={spring}
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center p-1 shadow-lg">
              <img src={LOGO_SRC} alt="Sphere English" className="w-full h-full object-contain" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              SPHERE <span className="font-light opacity-70">ENGLISH</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {scene === 0 && <Scene0 key="s0" />}
        {scene === 1 && <Scene1 key="s1" />}
        {scene === 2 && <Scene2 key="s2" />}
        {scene === 3 && <Scene3 key="s3" />}
        {scene === 4 && <Scene4 key="s4" />}
        {scene === 5 && <Scene5 key="s5" />}
      </AnimatePresence>

      <Voiceover scene={scene} />

      <div className="absolute bottom-0 left-0 h-1 bg-white/10 z-50 w-full">
        <motion.div className="h-full bg-[#2563EB]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SCENE 0 – Opening                                                          */
/* ────────────────────────────────────────────────────────────────────────── */
function Scene0() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(12px)" }}
      transition={{ duration: 1.0, ease }}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 20 }}
        className="w-32 h-32 rounded-3xl bg-white flex items-center justify-center mb-8 p-4 shadow-[0_0_80px_rgba(255,255,255,0.25)]"
      >
        <img src={LOGO_SRC} alt="Sphere English" className="w-full h-full object-contain" />
      </motion.div>

      <motion.div className="flex items-center gap-4 mb-4">
        <motion.h1 initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5, ...springSnappy }}
          className="text-7xl font-extrabold text-white tracking-tighter" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          SPHERE
        </motion.h1>
        <motion.h1 initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6, ...springSnappy }}
          className="text-7xl font-light text-white/75 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          ENGLISH
        </motion.h1>
      </motion.div>

      <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9, ...spring }}
        className="text-2xl text-white/60 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
        İngilizceyi Konuşmayı Öğren
      </motion.p>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SCENE 1 – Dashboard                                                        */
/* ────────────────────────────────────────────────────────────────────────── */
function Scene1() {
  const features = [
    { icon: BookOpen, label: "Kişiselleştirilmiş Dersler" },
    { icon: Zap,      label: "Canlı Sınıflar" },
    { icon: Award,    label: "İnteraktif Alıştırmalar" },
  ];
  return (
    <motion.div
      className="absolute inset-0 flex items-center z-10 px-16 gap-12"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -80, filter: "blur(8px)" }}
      transition={{ duration: 0.8, ease }}
    >
      <div className="flex-1 flex flex-col justify-center max-w-sm">
        <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ...spring }}
          className="text-[#3b82f6] font-bold text-sm uppercase tracking-widest mb-4 block">
          Kontrol Paneli
        </motion.span>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, ...spring }}
          className="text-5xl font-extrabold text-white leading-tight mb-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Her Şey<br /><span className="text-[#3b82f6]">Tek Ekranda</span>
        </motion.h2>
        <motion.div className="flex flex-col gap-4"
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15, delayChildren: 0.7 } } }}>
          {features.map(({ icon: Icon, label }) => (
            <motion.div key={label}
              variants={{ hidden: { opacity: 0, x: -18 }, visible: { opacity: 1, x: 0, transition: springSnappy } }}
              className="flex items-center gap-3 text-white/80 text-lg">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#60a5fa]" />
              </div>
              {label}
            </motion.div>
          ))}
        </motion.div>
      </div>

      <motion.div className="flex-[1.6]"
        initial={{ x: 80, opacity: 0, rotateY: 10 }} animate={{ x: 0, opacity: 1, rotateY: -3 }}
        transition={{ delay: 0.25, duration: 0.9, ease }}
        style={{ perspective: "1000px" }}>
        <BrowserFrame src={IMG.dashboard} className="shadow-[0_40px_100px_rgba(0,0,0,0.6)]" />
        {/* Animated highlight on stats bar */}
        <motion.div
          className="absolute top-[64px] left-[310px] right-[14px] h-[90px] rounded-lg border-2 border-[#3b82f6]/70 bg-[#3b82f6]/5 backdrop-blur-sm pointer-events-none"
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.95, 1, 1, 0.98] }}
          transition={{ delay: 1.4, duration: 3.5, times: [0, 0.15, 0.75, 1] }}
        >
          <span className="absolute -top-5 left-2 text-[#60a5fa] text-xs font-bold uppercase tracking-wide bg-[#0a1628] px-1">
            İlerleme Özeti
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SCENE 2 – AI Teachers (Pronunciation Selection)                            */
/* ────────────────────────────────────────────────────────────────────────── */
function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center z-10 px-16 gap-12"
      initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -80, filter: "blur(8px)" }}
      transition={{ duration: 0.8, ease }}
    >
      <motion.div className="flex-[1.6] relative"
        initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.9, ease }}>
        <BrowserFrame src={IMG.pronunciation} className="shadow-[0_40px_100px_rgba(0,0,0,0.6)]" />
        {/* Pulse effect on each teacher card */}
        {[
          { top: "66px",  left: "14px",  w: "47%", h: "220px", label: "Sarah 🇺🇸" },
          { top: "66px",  left: "51%",   w: "47%", h: "220px", label: "James 🇺🇸" },
        ].map(({ top, left, w, h, label }, i) => (
          <motion.div key={label}
            className="absolute rounded-lg border-2 border-[#3b82f6]/60 bg-[#3b82f6]/5 pointer-events-none flex items-end pb-1 pl-2"
            style={{ top, left, width: w, height: h }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ delay: 1.0 + i * 0.3, duration: 2.8, times: [0, 0.1, 0.8, 1] }}>
            <span className="text-[#60a5fa] text-xs font-bold bg-[#0a1628]/80 px-1 rounded">{label}</span>
          </motion.div>
        ))}
      </motion.div>

      <div className="flex-1 flex flex-col justify-center max-w-sm">
        <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ...spring }}
          className="text-[#3b82f6] font-bold text-sm uppercase tracking-widest mb-4 block">
          AI Konuşma Koçu
        </motion.span>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, ...spring }}
          className="text-5xl font-extrabold text-white leading-tight mb-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          4 Farklı<br /><span className="text-[#3b82f6]">AI Öğretmen</span>
        </motion.h2>
        <motion.div className="flex flex-col gap-3"
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12, delayChildren: 0.8 } } }}>
          {[
            { flag: "🇺🇸", name: "Sarah", desc: "Amerikalı · Sıcak ve teşvik edici" },
            { flag: "🇺🇸", name: "James", desc: "Amerikalı · Güçlü ve özgüvenli" },
            { flag: "🇬🇧", name: "Emma",  desc: "İngiliz · Zarif ve sabırlı" },
            { flag: "🇬🇧", name: "Oliver",desc: "İngiliz · Açık ve metodolojik" },
          ].map(({ flag, name, desc }) => (
            <motion.div key={name}
              variants={{ hidden: { opacity: 0, x: 16 }, visible: { opacity: 1, x: 0, transition: springSnappy } }}
              className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
              <span className="text-xl">{flag}</span>
              <div>
                <div className="text-white font-semibold text-base">{name}</div>
                <div className="text-white/50 text-xs">{desc}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SCENE 3 – Pronunciation Coach Feature                                      */
/* ────────────────────────────────────────────────────────────────────────── */
function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center z-10 px-16 gap-12"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -80, filter: "blur(8px)" }}
      transition={{ duration: 0.8, ease }}
    >
      <div className="flex-1 flex flex-col justify-center max-w-xs">
        <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ...spring }}
          className="text-[#3b82f6] font-bold text-sm uppercase tracking-widest mb-4 block">
          Telaffuz Koçu
        </motion.span>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, ...spring }}
          className="text-5xl font-extrabold text-white leading-tight mb-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Gerçek<br /><span className="text-[#3b82f6]">Zamanlı</span><br />Analiz
        </motion.h2>
        <motion.div className="flex flex-col gap-4"
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.18, delayChildren: 0.7 } } }}>
          {[
            { icon: Mic,        label: "Sesini kaydet" },
            { icon: CheckCircle,label: "AI analiz eder" },
            { icon: TrendingUp, label: "Anında geri bildirim" },
          ].map(({ icon: Icon, label }) => (
            <motion.div key={label}
              variants={{ hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0, transition: springSnappy } }}
              className="flex items-center gap-3 text-white/80 text-lg">
              <div className="w-10 h-10 rounded-xl bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#60a5fa]" />
              </div>
              {label}
            </motion.div>
          ))}
        </motion.div>
      </div>

      <motion.div className="flex-[1.6] relative"
        initial={{ x: 70, opacity: 0, rotateY: -10 }} animate={{ x: 0, opacity: 1, rotateY: 2 }}
        transition={{ delay: 0.2, duration: 0.9, ease }}
        style={{ perspective: "1000px" }}>
        <BrowserFrame src={IMG.pronunciation} className="shadow-[0_40px_100px_rgba(0,0,0,0.6)]" />
        {/* Glowing mic indicator */}
        <motion.div
          className="absolute bottom-[14px] left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[#2563EB]/30 border-2 border-[#3b82f6] flex items-center justify-center pointer-events-none"
          animate={{ boxShadow: ["0 0 0 0 rgba(37,99,235,0.6)", "0 0 0 20px rgba(37,99,235,0)", "0 0 0 0 rgba(37,99,235,0)"] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 1.2 }}>
          <Mic className="w-7 h-7 text-[#60a5fa]" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SCENE 4 – Progress & Quizzes                                               */
/* ────────────────────────────────────────────────────────────────────────── */
function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center z-10 px-16 gap-10"
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -80, filter: "blur(8px)" }}
      transition={{ duration: 0.8, ease }}
    >
      <motion.div className="flex-[1.6] relative"
        initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.9, ease }}>
        <BrowserFrame src={IMG.progress} className="shadow-[0_40px_100px_rgba(0,0,0,0.6)]" />
        {/* Highlight on progress bar */}
        <motion.div
          className="absolute top-[160px] left-[14px] right-[14px] h-[80px] rounded-lg border-2 border-[#22c55e]/70 bg-[#22c55e]/5 pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ delay: 1.2, duration: 3.0, times: [0, 0.1, 0.8, 1] }}>
          <span className="absolute -top-5 left-2 text-[#4ade80] text-xs font-bold bg-[#0a1628] px-1 rounded">
            Seviye İlerlemesi
          </span>
        </motion.div>
      </motion.div>

      <div className="flex-1 flex flex-col justify-center max-w-sm">
        <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ...spring }}
          className="text-[#22c55e] font-bold text-sm uppercase tracking-widest mb-4 block">
          İlerleme Takibi
        </motion.span>
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, ...spring }}
          className="text-5xl font-extrabold text-white leading-tight mb-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Her Adımı<br /><span className="text-[#22c55e]">Takip Et</span>
        </motion.h2>
        <motion.div className="flex flex-col gap-4"
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15, delayChildren: 0.8 } } }}>
          {[
            { icon: BarChart2, label: "Haftalık aktivite grafikleri",  color: "text-[#22c55e]", bg: "bg-[#22c55e]/20", border: "border-[#22c55e]/30" },
            { icon: Star,      label: "Puan ve rozet sistemi",         color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/20", border: "border-[#f59e0b]/30" },
            { icon: TrendingUp,label: "Seviye atlama testi",           color: "text-[#60a5fa]", bg: "bg-[#60a5fa]/20", border: "border-[#60a5fa]/30" },
          ].map(({ icon: Icon, label, color, bg, border }) => (
            <motion.div key={label}
              variants={{ hidden: { opacity: 0, x: 16 }, visible: { opacity: 1, x: 0, transition: springSnappy } }}
              className="flex items-center gap-3 text-white/80 text-base">
              <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              {label}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SCENE 5 – CTA                                                              */
/* ────────────────────────────────────────────────────────────────────────── */
function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 1.0, ease }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 18 }}
        className="w-40 h-40 rounded-[2.5rem] bg-white flex items-center justify-center mb-10 p-5 shadow-[0_0_100px_rgba(255,255,255,0.3)]"
      >
        <img src={LOGO_SRC} alt="Sphere English" className="w-full h-full object-contain" />
      </motion.div>

      <motion.h1
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, ...spring }}
        className="text-7xl font-bold text-white tracking-tight mb-3"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        SPHERE <span className="font-light text-white/70">ENGLISH</span>
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7, ...spring }}
        className="text-2xl text-white/60 mb-10" style={{ fontFamily: "'Inter', sans-serif" }}>
        İngilizceyi Konuşmayı Öğren
      </motion.p>

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.0, type: "spring", stiffness: 280, damping: 22 }}
        className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-2xl font-bold px-12 py-5 rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.5)] cursor-pointer"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        app.sphereenglish.com
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
        className="text-white/35 text-base mt-6">
        Ücretsiz Kaydol · Kredi Kartı Gerekmez
      </motion.p>
    </motion.div>
  );
}

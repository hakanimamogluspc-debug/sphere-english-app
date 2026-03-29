import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Star, Award, TrendingUp, Calendar, MessageSquare, Play, PlayCircle, Plus } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOGO_SRC = `${BASE}/images/sphere-logo.png`;
const AUDIO_SRCS = [0,1,2,3,4,5].map((i) => `${BASE}/audio/vo_${i}.mp3`);

const teacherSarah = `${BASE}/images/teacher_sarah.png`;
const teacherJames = `${BASE}/images/teacher_james.png`;
const teacherEmma = `${BASE}/images/teacher_emma.png`;
const teacherOliver = `${BASE}/images/teacher_oliver.png`;
const bg1 = `${BASE}/images/video_bg_1.png`;
const bg2 = `${BASE}/images/video_bg_2.png`;
const bg3 = `${BASE}/images/video_bg_3.png`;

const SCENE_DURATIONS = [
  5000, // 0: Opening
  7000, // 1: Platform Overview
  9000, // 2: AI Coach
  8000, // 3: 4 AI Teachers
  7000, // 4: Gamification
  5000  // 5: Closing CTA
];

const TOTAL_DURATION = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

const springSmooth = { type: "spring", stiffness: 120, damping: 25 };
const springSnappy = { type: "spring", stiffness: 400, damping: 30 };
const springBouncy = { type: "spring", stiffness: 300, damping: 15 };

const Voiceover = ({ currentScene }: { currentScene: number }) => {
  const scripts = [
    "Sphere English ile İngilizce öğrenmek artık çok daha kolay.",
    "Kişiselleştirilmiş dersler, canlı sınıflar ve interaktif quizlerle ilerlemeyi takip et.",
    "AI Telaffuz Koçu ile gerçek bir öğretmenle konuşur gibi İngilizce pratik yap.",
    "Amerikan ve İngiliz aksanlı 4 farklı AI öğretmen arasından seçim yap.",
    "Puan kazan, rozet topla ve liderlik tablosunda yüksel.",
    "Sphere English — İngilizceyi Konuşmayı Öğren. app.sphereenglish.com"
  ];

  return (
    <div className="absolute bottom-12 left-0 right-0 flex justify-center z-50 px-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScene}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="bg-black/60 backdrop-blur-md text-white px-8 py-4 rounded-2xl text-2xl font-medium tracking-wide text-center max-w-4xl border border-white/10 shadow-2xl"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {scripts[currentScene]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default function SphereEnglishVideo() {
  const [currentScene, setCurrentScene] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(AUDIO_SRCS[currentScene]);
    audio.volume = 1;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => { audio.pause(); };
  }, [currentScene]);

  useEffect(() => {
    let start = Date.now();
    let animationFrame: number;
    let sceneIndex = 0;
    
    const tick = () => {
      const now = Date.now();
      const elapsed = now - start;
      
      // Calculate total progress
      setProgress(Math.min(100, (elapsed / TOTAL_DURATION) * 100));
      
      // Calculate current scene
      let timeAccumulator = 0;
      let newSceneIndex = 0;
      
      for (let i = 0; i < SCENE_DURATIONS.length; i++) {
        timeAccumulator += SCENE_DURATIONS[i];
        if (elapsed < timeAccumulator) {
          newSceneIndex = i;
          break;
        }
      }
      
      if (elapsed >= TOTAL_DURATION) {
        // Loop
        start = Date.now();
        sceneIndex = 0;
        setCurrentScene(0);
        setProgress(0);
      } else if (newSceneIndex !== sceneIndex) {
        sceneIndex = newSceneIndex;
        setCurrentScene(newSceneIndex);
      }
      
      animationFrame = requestAnimationFrame(tick);
    };
    
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className="w-full h-screen bg-[#0F2952] overflow-hidden relative flex items-center justify-center font-sans">
      
      {/* GLOBAL PERSISTENT BACKGROUNDS */}
      <motion.div 
        className="absolute inset-0 z-0 opacity-40 mix-blend-overlay"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 2, -2, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB]/40 to-[#0F2952]/80 blur-3xl" />
      </motion.div>

      {/* CONTINUOUS ORBITING ELEMENTS */}
      <motion.div 
        className="absolute w-[40vw] h-[40vw] rounded-full border border-white/5 z-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute w-[60vw] h-[60vw] rounded-full border border-white/5 z-0"
        animate={{ rotate: -360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />

      {/* PERSISTENT BRAND ELEMENT */}
      <motion.div 
        className="absolute top-8 left-12 z-50 flex items-center gap-3"
        animate={{
          opacity: currentScene === 0 || currentScene === 5 ? 0 : 1,
          y: currentScene === 0 || currentScene === 5 ? -20 : 0
        }}
        transition={springSmooth}
      >
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md p-1">
          <img src={LOGO_SRC} alt="Sphere English" className="w-full h-full object-contain" />
        </div>
        <div className="text-white font-bold text-2xl tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          SPHERE <span className="font-normal opacity-80">ENGLISH</span>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {currentScene === 0 && <Scene0 key="scene0" />}
        {currentScene === 1 && <Scene1 key="scene1" />}
        {currentScene === 2 && <Scene2 key="scene2" />}
        {currentScene === 3 && <Scene3 key="scene3" />}
        {currentScene === 4 && <Scene4 key="scene4" />}
        {currentScene === 5 && <Scene5 key="scene5" />}
      </AnimatePresence>

      <Voiceover currentScene={currentScene} />

      {/* PROGRESS BAR */}
      <div className="absolute bottom-0 left-0 h-1.5 bg-white/20 z-50 w-full">
        <motion.div 
          className="h-full bg-[#2563EB]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SCENE 0: Opening
// -----------------------------------------------------------------------------
function Scene0() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, ...springSmooth }}
        className="w-36 h-36 mb-8 rounded-3xl bg-white flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.3)] p-4"
      >
        <img src={LOGO_SRC} alt="Sphere English" className="w-full h-full object-contain" />
      </motion.div>
      
      <motion.div className="flex items-center gap-4 mb-6">
        <motion.h1 
          className="text-7xl font-extrabold text-white tracking-tighter"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.6, ...springSnappy }}
        >
          SPHERE
        </motion.h1>
        <motion.h1 
          className="text-7xl font-light text-white/80 tracking-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.7, ...springSnappy }}
        >
          ENGLISH
        </motion.h1>
      </motion.div>
      
      <motion.p 
        className="text-3xl text-white/70 font-medium"
        style={{ fontFamily: "'Inter', sans-serif" }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.0, ...springSmooth }}
      >
        İngilizceyi Konuşmayı Öğren
      </motion.p>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// SCENE 1: Platform Overview
// -----------------------------------------------------------------------------
function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10 px-20"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100, filter: "blur(10px)" }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-7xl flex gap-12">
        <div className="flex-1 flex flex-col justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...springSmooth }}
            className="inline-flex items-center gap-2 bg-[#2563EB]/20 text-[#2563EB] px-4 py-2 rounded-full font-bold mb-6 w-fit"
          >
            <TrendingUp className="w-5 h-5 text-[#3b82f6]" />
            <span className="text-[#60a5fa]">LMS Dashboard</span>
          </motion.div>
          
          <motion.h2 
            className="text-6xl font-bold text-white leading-tight mb-6"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, ...springSmooth }}
          >
            Her Şey <br/><span className="text-[#3b82f6]">Tek Platformda</span>
          </motion.h2>
          
          <motion.div 
            className="flex flex-col gap-6 mt-8"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.2, delayChildren: 0.8 }
              }
            }}
          >
            {[
              { icon: Star, text: "Kişiselleştirilmiş Dersler" },
              { icon: PlayCircle, text: "Canlı Sınıflar" },
              { icon: Award, text: "İnteraktif Quizler" }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0, transition: springSnappy }
                }}
                className="flex items-center gap-4 text-2xl text-white/80"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                  <item.icon className="w-6 h-6 text-[#3b82f6]" />
                </div>
                <span>{item.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
        
        <div className="flex-1 relative perspective-1000">
          <motion.div 
            className="w-full aspect-[4/3] bg-[#1e293b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col relative"
            initial={{ rotateY: 20, rotateX: 10, scale: 0.8, opacity: 0, z: -100 }}
            animate={{ rotateY: -5, rotateX: 5, scale: 1, opacity: 1, z: 0 }}
            transition={{ delay: 0.6, duration: 1.5, ease: "easeOut" }}
          >
            {/* Fake Dashboard UI */}
            <div className="h-12 bg-white/5 border-b border-white/5 flex items-center px-4 gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="h-4 w-32 bg-white/10 rounded-full ml-4" />
            </div>
            <div className="p-6 flex-1 flex gap-6">
              <div className="w-1/3 flex flex-col gap-4">
                <div className="h-24 bg-white/5 rounded-xl border border-white/5" />
                <div className="h-48 bg-white/5 rounded-xl border border-white/5" />
              </div>
              <div className="w-2/3 flex flex-col gap-4">
                <div className="h-12 bg-white/5 rounded-xl border border-white/5" />
                <div className="flex-1 bg-[#2563EB]/20 rounded-xl border border-[#2563EB]/30 relative overflow-hidden">
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-full"
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// SCENE 2: AI Pronunciation Coach
// -----------------------------------------------------------------------------
function Scene2() {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1500); // User speaks
    const t2 = setTimeout(() => setStep(2), 3500); // Processing
    const t3 = setTimeout(() => setStep(3), 4500); // AI responds
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#2563EB]/20 via-[#0F2952]/0 to-transparent opacity-60" />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-center mb-16"
      >
        <h2 className="text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          AI Telaffuz Koçu
        </h2>
        <p className="text-2xl text-[#60a5fa]">Gerçek zamanlı konuşma ve düzeltme</p>
      </motion.div>
      
      <div className="flex gap-16 items-center">
        {/* User Side */}
        <motion.div 
          className="flex flex-col items-center gap-6"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, ...springSmooth }}
        >
          <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center relative border-2 border-white/20">
            <Mic className="w-12 h-12 text-white" />
            <AnimatePresence>
              {step >= 1 && step < 2 && (
                <motion.div 
                  className="absolute inset-0 rounded-full border-2 border-[#3b82f6]"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </AnimatePresence>
          </div>
          
          <AnimatePresence>
            {step >= 1 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl rounded-tr-none border border-white/10 max-w-xs"
              >
                <p className="text-xl text-white">"I goed to the store yesterday."</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* AI Side */}
        <motion.div 
          className="flex flex-col items-center gap-6"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8, ...springSmooth }}
        >
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] flex items-center justify-center relative shadow-[0_0_40px_rgba(37,99,235,0.5)] overflow-hidden">
            <span className="text-4xl font-bold text-white">AI</span>
            <AnimatePresence>
              {step >= 3 && (
                <motion.div 
                  className="absolute inset-0 rounded-full bg-white/20"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </AnimatePresence>
          </div>
          
          <AnimatePresence>
            {step >= 3 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#2563EB]/20 backdrop-blur-md px-6 py-4 rounded-2xl rounded-tl-none border border-[#2563EB]/30 max-w-sm"
              >
                <p className="text-xl text-white">
                  Almost! Say "<span className="text-green-400 font-bold">went</span>" instead of "<span className="text-red-400 line-through">goed</span>". <br/>
                  <span className="text-white/70 text-sm mt-2 block">"I went to the store yesterday."</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// SCENE 3: 4 AI Teachers
// -----------------------------------------------------------------------------
function Scene3() {
  const teachers = [
    { name: "Sarah", accent: "🇺🇸 American", color: "from-blue-500 to-cyan-500", delay: 0.2 },
    { name: "James", accent: "🇬🇧 British", color: "from-indigo-500 to-blue-600", delay: 0.4 },
    { name: "Emma", accent: "🇬🇧 British", color: "from-violet-500 to-purple-600", delay: 0.6 },
    { name: "Oliver", accent: "🇺🇸 American", color: "from-blue-600 to-indigo-800", delay: 0.8 }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        className="text-5xl font-bold text-white mb-16 text-center"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Kendi <span className="text-[#3b82f6]">Öğretmenini</span> Seç
      </motion.h2>

      <div className="flex gap-8">
        {teachers.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: t.delay, ...springBouncy }}
            className="flex flex-col items-center"
          >
            <motion.div 
              className={`w-40 h-40 rounded-full bg-gradient-to-br ${t.color} p-1 mb-6 shadow-2xl relative group`}
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-full h-full rounded-full bg-[#1e293b] border-4 border-[#0F2952] overflow-hidden flex items-center justify-center text-5xl">
                {/* Fallback to initials if images fail, but we assume images exist */}
                <div className="absolute inset-0 opacity-50 mix-blend-overlay bg-white/20" />
                <span className="font-bold text-white/50">{t.name[0]}</span>
              </div>
              
              {/* Audio Wave Indicator */}
              <motion.div 
                className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg text-2xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: t.delay + 0.5, ...springSnappy }}
              >
                {t.accent.split(' ')[0]}
              </motion.div>
            </motion.div>
            
            <h3 className="text-2xl font-bold text-white mb-2">{t.name}</h3>
            <span className="text-white/60 bg-white/10 px-4 py-1 rounded-full text-sm font-medium border border-white/5">
              {t.accent.split(' ')[1]}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// SCENE 4: Gamification & Progress
// -----------------------------------------------------------------------------
function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 px-20"
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -100, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="absolute inset-0 bg-[#2563EB]/10 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />

      <div className="z-10 flex flex-col items-center w-full max-w-5xl">
        <motion.div 
          className="flex items-center gap-3 bg-[#3b82f6]/20 text-[#60a5fa] px-6 py-2 rounded-full font-bold mb-10"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Star className="w-6 h-6 fill-current" />
          <span className="text-xl">Oyunlaştırılmış Öğrenme</span>
        </motion.div>

        <div className="grid grid-cols-3 gap-8 w-full">
          {/* Card 1: Streaks */}
          <motion.div 
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...springSmooth }}
          >
            <div className="w-20 h-20 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-6">
              <TrendingUp className="w-10 h-10" />
            </div>
            <h3 className="text-4xl font-bold text-white mb-2">14 Gün</h3>
            <p className="text-white/60 text-lg">Öğrenme Serisi</p>
          </motion.div>

          {/* Card 2: Points */}
          <motion.div 
            className="bg-gradient-to-b from-[#2563EB]/40 to-[#1d4ed8]/20 backdrop-blur-md border border-[#3b82f6]/30 rounded-3xl p-8 flex flex-col items-center text-center transform -translate-y-4"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: -16 }}
            transition={{ delay: 0.6, ...springSmooth }}
          >
            <div className="w-24 h-24 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(250,204,21,0.3)]">
              <Star className="w-12 h-12 fill-current" />
            </div>
            <motion.h3 
              className="text-5xl font-black text-white mb-2"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.2, ...springBouncy }}
            >
              2,450
            </motion.h3>
            <p className="text-blue-200 text-xl font-medium">Toplam Puan</p>
          </motion.div>

          {/* Card 3: Badges */}
          <motion.div 
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, ...springSmooth }}
          >
            <div className="w-20 h-20 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6">
              <Award className="w-10 h-10" />
            </div>
            <h3 className="text-4xl font-bold text-white mb-2">Uzman</h3>
            <p className="text-white/60 text-lg">Seviye Rozeti</p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// SCENE 5: Closing CTA
// -----------------------------------------------------------------------------
function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#0F2952]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.0 }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, ...springBouncy }}
        className="w-44 h-44 mb-10 rounded-[2.5rem] bg-white flex items-center justify-center shadow-[0_0_80px_rgba(255,255,255,0.35)] p-5"
      >
        <img src={LOGO_SRC} alt="Sphere English" className="w-full h-full object-contain" />
      </motion.div>
      
      <motion.h1 
        className="text-7xl font-bold text-white tracking-tight mb-8"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, ...springSmooth }}
      >
        SPHERE <span className="font-light opacity-80">ENGLISH</span>
      </motion.h1>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, ...springSmooth }}
        className="bg-white/10 px-8 py-4 rounded-full border border-white/20 backdrop-blur-md"
      >
        <span className="text-3xl font-medium text-white tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>
          app.sphereenglish.com
        </span>
      </motion.div>
    </motion.div>
  );
}

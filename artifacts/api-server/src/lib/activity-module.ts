/**
 * Page URL'inden modül adı belirleme — analytics için kategori adı.
 *
 * /student/pronunciation-coach → "pronunciation"
 * /student/writing-coach       → "writing"
 * vs.
 *
 * Bilinmeyen path'ler "general" döner.
 */

const MODULE_PREFIXES: ReadonlyArray<{ prefix: string; module: string }> = [
  // AI Studio modülleri
  { prefix: "/student/pronunciation-coach", module: "pronunciation" },
  { prefix: "/student/writing-coach", module: "writing" },
  { prefix: "/student/grammar-coach", module: "grammar" },
  { prefix: "/student/vocab-game", module: "vocab" },
  { prefix: "/student/simulation-mode", module: "simulation" },
  { prefix: "/student/interview-sim", module: "interview" },
  { prefix: "/student/presentation-sim", module: "presentation" },
  { prefix: "/student/ai-quiz", module: "ai-quiz" },
  { prefix: "/student/ai-tutor", module: "ai-tutor" },
  { prefix: "/student/learning-path", module: "learning-path" },

  // Standart öğrenci alanları
  { prefix: "/student/level-exams", module: "level-exam" },
  { prefix: "/student/materials", module: "materials" },
  { prefix: "/student/courses", module: "courses" },
  { prefix: "/student/speaking-club", module: "speaking-club" },
  { prefix: "/student/live-classes", module: "live-class" },
  { prefix: "/student/quizzes", module: "quizzes" },
  { prefix: "/student/forum", module: "forum" },
  { prefix: "/student/messages", module: "messages" },
  { prefix: "/student/subscription", module: "subscription" },

  // Ortak sayfalar
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/forum", module: "forum" },
  { prefix: "/messages", module: "messages" },
  { prefix: "/leaderboard", module: "leaderboard" },
  { prefix: "/progress", module: "progress" },
  { prefix: "/courses", module: "courses" },
  { prefix: "/certificates", module: "certificates" },

  // Öğretmen
  { prefix: "/teacher", module: "teacher-area" },

  // Admin
  { prefix: "/admin", module: "admin-area" },

  // Kurumsal
  { prefix: "/corporate", module: "corporate-area" },

  // Placement
  { prefix: "/placement-test", module: "placement-test" },
];

export function resolveModule(page: string | undefined | null): string {
  if (!page) return "general";
  // Query string'i at
  const path = page.split("?")[0].split("#")[0];
  // En uzun eşleşmeli prefix'i bul
  let best: string | null = null;
  let bestLen = 0;
  for (const entry of MODULE_PREFIXES) {
    if (path.startsWith(entry.prefix) && entry.prefix.length > bestLen) {
      best = entry.module;
      bestLen = entry.prefix.length;
    }
  }
  return best ?? "general";
}

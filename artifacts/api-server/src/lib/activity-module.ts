/**
 * Page URL'inden modül adı belirleme — analytics + öğrenme haritası için.
 *
 * ÖNEMLİ: Buradaki modül adları, learning-map.ts'deki MODULE_KEYS ile birebir
 * eşleşmeli. Aksi halde kullanıcı modülde vakit geçirir ama "keşfedilmedi" görünür.
 *
 * Hem desktop (/student/*) hem mobil (/m/pratik/*) rotaları desteklenir.
 * Aynı modülün her iki path'i de aynı key'e çözülür — veri birleşir.
 *
 * Bilinmeyen path'ler "general" döner.
 */

const MODULE_PREFIXES: ReadonlyArray<{ prefix: string; module: string }> = [
  // ─── AI Studio modülleri (desktop + mobil) ────────────────────
  { prefix: "/student/pronunciation-coach", module: "pronunciation_coach" },
  { prefix: "/m/pratik/konusma-kocu",       module: "pronunciation_coach" },

  { prefix: "/student/writing-coach",       module: "writing_coach" },
  { prefix: "/m/pratik/yazma-kocu",         module: "writing_coach" },

  { prefix: "/student/grammar-coach",       module: "grammar_coach" },
  { prefix: "/m/pratik/dilbilgisi-kocu",    module: "grammar_coach" },

  { prefix: "/student/vocab-game",          module: "vocab_game" },
  { prefix: "/m/pratik/kelime-oyunu",       module: "vocab_game" },

  { prefix: "/student/simulation-mode",     module: "simulation_mode" },
  { prefix: "/m/pratik/is-senaryolari",     module: "simulation_mode" },

  { prefix: "/student/interview-sim",       module: "interview_sim" },
  { prefix: "/m/pratik/mulakat-sim",        module: "interview_sim" },

  { prefix: "/student/presentation-sim",    module: "presentation_sim" },
  { prefix: "/m/pratik/sunum-sim",          module: "presentation_sim" },

  { prefix: "/student/ai-quiz",             module: "ai_quiz" },
  { prefix: "/m/pratik/akilli-quiz",        module: "ai_quiz" },

  { prefix: "/student/ai-tutor",            module: "ai_tutor" },
  { prefix: "/m/pratik/ai-ogretmen",        module: "ai_tutor" },

  { prefix: "/student/learning-path",       module: "learning_path" },
  { prefix: "/m/pratik/ogrenme-yolu",       module: "learning_path" },

  { prefix: "/student/level-exams",         module: "level_exams" },
  { prefix: "/m/pratik/seviye-sinavlari",   module: "level_exams" },

  { prefix: "/student/speaking-scenes",     module: "speaking_scenes" },
  { prefix: "/m/pratik/konusma-sahneleri",  module: "speaking_scenes" },

  // ─── Standart öğrenci alanları ─────────────────────────────
  { prefix: "/student/materials",           module: "student_materials" },
  { prefix: "/m/pratik/materyaller",        module: "student_materials" },

  { prefix: "/student/speaking-club",       module: "student_speaking_club" },
  { prefix: "/m/pratik/speaking-club",      module: "student_speaking_club" },

  // ─── R2/R3 — content modülleri ────────────────────────────
  { prefix: "/kesfet",                      module: "discover" },
  { prefix: "/m/pratik/kesfet",             module: "discover" },
  { prefix: "/student/discover",            module: "discover" },

  { prefix: "/is-kartlari",                 module: "business_cards" },
  { prefix: "/student/business-cards",      module: "business_cards" },

  { prefix: "/career",                      module: "career" },
  { prefix: "/student/career",              module: "career" },

  { prefix: "/watch-listen",                module: "watch_listen" },
  { prefix: "/student/watch-listen",        module: "watch_listen" },

  // ─── Mobil sekmeler (bunlar hub, modül olarak sayılmasın istersen
  //     buradan kaldır — şimdilik general kalıyorlar):
  //   /m/anasayfa, /m/pratik, /m/kutuphane, /m/kazanim, /m/profil

  // ─── Diğer (learning-map'e girmez ama tracking amaçlı) ────
  { prefix: "/student/courses",             module: "courses" },
  { prefix: "/student/live-classes",        module: "live_class" },
  { prefix: "/student/quizzes",             module: "quizzes" },
  { prefix: "/student/forum",               module: "forum" },
  { prefix: "/student/messages",            module: "messages" },
  { prefix: "/student/subscription",        module: "subscription" },

  // Ortak sayfalar
  { prefix: "/dashboard",                   module: "dashboard" },
  { prefix: "/m/anasayfa",                  module: "dashboard" },
  { prefix: "/forum",                       module: "forum" },
  { prefix: "/messages",                    module: "messages" },
  { prefix: "/leaderboard",                 module: "leaderboard" },
  { prefix: "/progress",                    module: "progress" },
  { prefix: "/courses",                     module: "courses" },
  { prefix: "/certificates",                module: "certificates" },

  // Öğretmen
  { prefix: "/teacher",                     module: "teacher_area" },
  // Admin
  { prefix: "/admin",                       module: "admin_area" },
  // Kurumsal
  { prefix: "/corporate",                   module: "corporate_area" },
  // Placement
  { prefix: "/placement-test",              module: "placement_test" },
];

export function resolveModule(page: string | undefined | null): string {
  if (!page) return "general";
  const path = page.split("?")[0].split("#")[0];
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

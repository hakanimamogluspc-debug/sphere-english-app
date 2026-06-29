import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Path bazlı browser tab title güncellemesi.
 * index.html'de sabit "Sphere English | Giriş Yap" yazıyordu — bu hook
 * route değiştikçe document.title'ı güncel sayfa adıyla değiştirir.
 *
 * Layout component'inin (App.tsx) en üstünde tek seferlik mount edilir.
 */

interface RouteTitleEntry {
  prefix: string;
  title: string;
  /** True ise prefix'in TAM eşleşmesi olmalı (örn. /login). */
  exact?: boolean;
}

// Eşleme listesi — en spesifik path en başta olacak (eşleşme sırayla denenir)
const ROUTE_TITLES: RouteTitleEntry[] = [
  // Auth & public
  { prefix: '/login', title: 'Giriş Yap', exact: true },
  { prefix: '/sifre-belirle', title: 'Şifremi Belirle' },
  { prefix: '/sifremi-unuttum', title: 'Şifremi Unuttum' },
  { prefix: '/register', title: 'Ücretsiz Hesap Oluştur', exact: true },
  { prefix: '/placement-test', title: 'Seviye Belirleme Testi' },

  // Student — AI Studio
  { prefix: '/student/pronunciation-coach', title: 'Telaffuz Koçu — AI Studio' },
  { prefix: '/student/writing-coach', title: 'Yazma Koçu — AI Studio' },
  { prefix: '/student/grammar-coach', title: 'Dilbilgisi Koçu — AI Studio' },
  { prefix: '/student/vocab-game', title: 'Kelime Oyunu — AI Studio' },
  { prefix: '/student/simulation-mode', title: 'İş Senaryoları — AI Studio' },
  { prefix: '/student/interview-sim', title: 'Mülakat Simülatörü — AI Studio' },
  { prefix: '/student/presentation-sim', title: 'Sunum Simülatörü — AI Studio' },
  { prefix: '/student/ai-quiz', title: 'Akıllı Quiz Üretici — AI Studio' },
  { prefix: '/student/ai-tutor', title: 'Kişisel AI Öğretmen — AI Studio' },
  { prefix: '/student/learning-path', title: 'Adaptif Öğrenme Yolu — AI Studio' },
  { prefix: '/student/level-exams', title: 'Seviye Geçme Sınavı' },
  { prefix: '/student/subscription', title: 'Aboneliğim' },
  { prefix: '/student/settings', title: 'Ayarlar' },
  { prefix: '/student/profile', title: 'Profilim' },
  { prefix: '/student/materials', title: 'Materyallerim' },
  { prefix: '/student/courses', title: 'Kurslarım' },
  { prefix: '/student/speaking-club', title: 'Speaking Club' },
  { prefix: '/student/live-classes', title: 'Canlı Dersler' },
  { prefix: '/student/quizzes', title: 'Alıştırmalar' },
  { prefix: '/student/forum', title: 'Forum' },
  { prefix: '/student/messages', title: 'Mesajlar' },

  // Common (login-gated, çoğu role için)
  { prefix: '/dashboard', title: 'Kontrol Paneli' },
  { prefix: '/forum', title: 'Forum' },
  { prefix: '/messages', title: 'Mesajlar' },
  { prefix: '/leaderboard', title: 'Sıralama' },
  { prefix: '/progress', title: 'İlerleme Durumum' },
  { prefix: '/courses', title: 'Kurslar' },
  { prefix: '/certificates', title: 'Sertifikalar' },

  // Teacher
  { prefix: '/teacher/dashboard', title: 'Öğretmen Paneli' },
  { prefix: '/teacher/students', title: 'Öğrencilerim — Öğretmen' },
  { prefix: '/teacher/courses', title: 'Kurslarım — Öğretmen' },
  { prefix: '/teacher/quizzes', title: 'Quiz Yönetimi — Öğretmen' },
  { prefix: '/teacher/materials', title: 'Materyaller — Öğretmen' },
  { prefix: '/teacher/live-classes', title: 'Canlı Oturumlar — Öğretmen' },
  { prefix: '/teacher/progress', title: 'Öğrenci İlerlemesi — Öğretmen' },
  { prefix: '/teacher/messages', title: 'Mesajlar — Öğretmen' },
  { prefix: '/teacher/speaking-club', title: 'Speaking Club — Öğretmen' },

  // Admin
  { prefix: '/admin/marketing', title: 'Pazarlama — Admin' },
  { prefix: '/admin/users', title: 'Kullanıcılar — Admin' },
  { prefix: '/admin/teachers', title: 'Öğretmenler — Admin' },
  { prefix: '/admin/students', title: 'Öğrenciler — Admin' },
  { prefix: '/admin/companies', title: 'Kurumsal Müşteriler — Admin' },
  { prefix: '/admin/groups', title: 'Gruplar — Admin' },
  { prefix: '/admin/courses', title: 'Tüm Kurslar — Admin' },
  { prefix: '/admin/modules', title: 'Modül Yönetimi — Admin' },
  { prefix: '/admin/materials', title: 'Materyaller — Admin' },
  { prefix: '/admin/live-classes', title: 'Canlı Oturumlar — Admin' },
  { prefix: '/admin/speaking-club', title: 'Speaking Club — Admin' },
  { prefix: '/admin/announcements', title: 'Duyurular — Admin' },
  { prefix: '/admin/subscriptions', title: 'Abonelikler — Admin' },
  { prefix: '/admin/chatbot', title: 'Chatbot (Sphere Asistan) — Admin' },
  { prefix: '/admin/web-analytics', title: 'Web Analiz — Admin' },
  { prefix: '/admin/instagram-bot', title: 'Instagram Bot — Admin' },
  { prefix: '/admin/whatsapp-bot', title: 'WhatsApp Bot — Admin' },
  { prefix: '/admin/affiliates', title: 'Affiliate Program — Admin' },
  { prefix: '/admin/coupons', title: 'Kupon Kodları — Admin' },
  { prefix: '/admin/backups', title: 'DB Yedekleri — Admin' },
  { prefix: '/admin/smoke-tests', title: 'Smoke Testleri — Admin' },
  { prefix: '/partner/apply', title: 'Partner Başvurusu' },
  { prefix: '/partner', title: 'Partner Paneli' },
  { prefix: '/admin/reports', title: 'Sistem Raporları — Admin' },
  { prefix: '/admin/analytics', title: 'Aktivite Analizi — Admin' },
  { prefix: '/admin/content-engine', title: 'İçerik Motoru — Admin' },
  { prefix: '/admin/teacher-applications', title: 'Eğitmen Başvuruları — Admin' },
  { prefix: '/admin/ebook-purchases', title: 'E-Kitap Satışları — Admin' },
  { prefix: '/admin/ebooks/yeni', title: 'Yeni E-Kitap — Admin' },
  { prefix: '/admin/ebooks/', title: 'E-Kitap Düzenle — Admin' },
  { prefix: '/admin/ebooks', title: 'E-Kitap Yönetimi — Admin' },
  { prefix: '/admin/meb-report', title: 'MEB Aktivite Raporu — Admin' },
  { prefix: '/admin', title: 'Yönetici Paneli' },

  // Corporate
  { prefix: '/corporate/dashboard', title: 'Kurumsal Panel' },
  { prefix: '/corporate/students', title: 'Çalışanlar — Kurumsal' },
  { prefix: '/corporate/reports', title: 'Raporlar — Kurumsal' },
  { prefix: '/corporate/ai-report', title: 'AI Raporu — Kurumsal' },
];

const BRAND = 'Sphere English';
const DEFAULT_TITLE = 'Sphere English — Kurumsal İş İngilizcesi';

function findTitle(pathname: string): string {
  // En uzun eşleşme öncelikli; bunun için entries'i length'e göre azalan sırayla denersek doğru olur
  const sorted = [...ROUTE_TITLES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const entry of sorted) {
    if (entry.exact ? pathname === entry.prefix : pathname.startsWith(entry.prefix)) {
      return `${entry.title} | ${BRAND}`;
    }
  }
  return DEFAULT_TITLE;
}

export function useRouteTitle() {
  const [pathname] = useLocation();
  useEffect(() => {
    const title = findTitle(pathname);
    if (document.title !== title) {
      document.title = title;
    }
  }, [pathname]);
}

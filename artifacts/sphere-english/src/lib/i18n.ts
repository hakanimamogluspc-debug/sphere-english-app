/**
 * i18n (dil yerelleştirme) konfigürasyonu.
 *
 * Sphere English öğrenci paneli — Türk profesyonelleri hedeflediği için varsayılan
 * dil Türkçe. İngilizce toggle sonradan kullanıcılara sunulur (setup: R0.2).
 *
 * Kullanım:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation('dashboard');
 *   t('welcome', { name: 'Ahmet' });
 *
 * Namespace şeması:
 *   common      — buton, form, hata mesajları, ortak metinler
 *   dashboard   — ana ekran + menü
 *   modules     — AI Studio modül tanıtımları + intro metinleri
 *   onboarding  — kayıt sonrası wizard
 *   settings    — ayarlar sayfası
 *   auth        — login, register, forgot password
 *
 * Yeni namespace eklenirse: locales/tr/<ns>.json + locales/en/<ns>.json dosyaları
 * oluştur ve aşağıdaki `ns` dizisine eklemene gerek yok — resources üzerinden auto pickup.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import trCommon from "@/locales/tr/common.json";
import trDashboard from "@/locales/tr/dashboard.json";
import trModules from "@/locales/tr/modules.json";
import trOnboarding from "@/locales/tr/onboarding.json";
import trSettings from "@/locales/tr/settings.json";
import trAuth from "@/locales/tr/auth.json";

import enCommon from "@/locales/en/common.json";
import enDashboard from "@/locales/en/dashboard.json";
import enModules from "@/locales/en/modules.json";
import enOnboarding from "@/locales/en/onboarding.json";
import enSettings from "@/locales/en/settings.json";
import enAuth from "@/locales/en/auth.json";

const resources = {
  tr: {
    common: trCommon,
    dashboard: trDashboard,
    modules: trModules,
    onboarding: trOnboarding,
    settings: trSettings,
    auth: trAuth,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    modules: enModules,
    onboarding: enOnboarding,
    settings: enSettings,
    auth: enAuth,
  },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "tr", // Türk profesyoneller birincil hedef kitle
    supportedLngs: ["tr", "en"],
    defaultNS: "common",
    ns: ["common", "dashboard", "modules", "onboarding", "settings", "auth"],

    detection: {
      order: ["localStorage", "cookie", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "sphere_lang",
      lookupCookie: "sphere_lang",
    },

    interpolation: {
      escapeValue: false, // React zaten XSS'i handle ediyor
    },

    // Development'ta eksik key uyarılarını görmek için
    saveMissing: import.meta.env.DEV,
    debug: false,

    returnEmptyString: false,
  });

export default i18n;

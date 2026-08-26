import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useRoute } from "wouter";
import {
  GraduationCap, ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Save,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

type WeekModule = { n: number; title: string; desc: string };

interface CourseFormData {
  slug: string;
  level_slug: string;
  title: string;
  title_en: string;
  subtitle: string;
  description: string;
  level: string;
  level_badge: string;
  level_cefr: string;
  level_audience: string;
  duration_weeks: number;
  duration_label: string;
  price_kurus: number;
  price_display: string;
  weeks: WeekModule[];
  audience: string[];
  related_ebook_slugs: string[];
  cohort_status: string;
  cohort_start_date: string;
  cohort_start_display: string;
  cohort_capacity: number;
  cohort_registrations: number;
  seo_title: string;
  seo_description: string;
  is_active: boolean;
  sort_order: number;
}

const EMPTY_FORM: CourseFormData = {
  slug: "",
  level_slug: "",
  title: "",
  title_en: "",
  subtitle: "",
  description: "",
  level: "",
  level_badge: "",
  level_cefr: "",
  level_audience: "",
  duration_weeks: 4,
  duration_label: "4 Hafta · 60 dk · Haftada 1 canlı ders",
  price_kurus: 499900,
  price_display: "4.999 TL",
  weeks: [
    { n: 1, title: "", desc: "" },
    { n: 2, title: "", desc: "" },
    { n: 3, title: "", desc: "" },
    { n: 4, title: "", desc: "" },
  ],
  audience: [""],
  related_ebook_slugs: [],
  cohort_status: "waitlist",
  cohort_start_date: "",
  cohort_start_display: "",
  cohort_capacity: 6,
  cohort_registrations: 0,
  seo_title: "",
  seo_description: "",
  is_active: true,
  sort_order: 0,
};

const COHORT_STATUS_OPTIONS = [
  { value: "open", label: "Açık — Kayıtlar devam ediyor" },
  { value: "waitlist", label: "Ön Kayıt — Grup dolu, sonraki kohort için sıra" },
  { value: "full", label: "Dolu — Kayıt kabul edilmiyor" },
  { value: "closed", label: "Kapalı — Program şu an satılmıyor" },
];

const EBOOK_SLUG_OPTIONS = [
  "kurumsal-iletisim-toplantilar",
  "pazarlama-satis-musteri-iliskileri",
  "liderlik-insan-kaynaklari-kuresel-operasyonlar",
  "kurumsal-strateji-finansal-analiz-risk-yonetimi",
  "kuresel-girisimcilik-edtech-teknoloji-yonetimi",
];

export default function AdminCourseForm() {
  const [, setLocation] = useLocation();
  const [matchEdit, editParams] = useRoute("/admin/kurslar/:id");
  const isEdit = matchEdit && editParams?.id && editParams.id !== "yeni";
  const editId = isEdit ? parseInt(String(editParams?.id), 10) : null;

  const [form, setForm] = useState<CourseFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !editId) return;
    (async () => {
      try {
        const data = await apiFetch(`/admin/courses/${editId}`);
        const c = data.course;
        setForm({
          slug: c.slug ?? "",
          level_slug: c.level_slug ?? "",
          title: c.title ?? "",
          title_en: c.title_en ?? "",
          subtitle: c.subtitle ?? "",
          description: c.description ?? "",
          level: c.level ?? "",
          level_badge: c.level_badge ?? "",
          level_cefr: c.level_cefr ?? "",
          level_audience: c.level_audience ?? "",
          duration_weeks: c.duration_weeks ?? 4,
          duration_label: c.duration_label ?? "",
          price_kurus: c.price_kurus ?? 0,
          price_display: c.price_display ?? "",
          weeks: Array.isArray(c.weeks) && c.weeks.length > 0 ? c.weeks : EMPTY_FORM.weeks,
          audience: Array.isArray(c.audience) && c.audience.length > 0 ? c.audience : [""],
          related_ebook_slugs: Array.isArray(c.related_ebook_slugs) ? c.related_ebook_slugs : [],
          cohort_status: c.cohort_status ?? "waitlist",
          cohort_start_date: c.cohort_start_date ? String(c.cohort_start_date).slice(0, 10) : "",
          cohort_start_display: c.cohort_start_display ?? "",
          cohort_capacity: c.cohort_capacity ?? 6,
          cohort_registrations: c.cohort_registrations ?? 0,
          seo_title: c.seo_title ?? "",
          seo_description: c.seo_description ?? "",
          is_active: c.is_active ?? true,
          sort_order: c.sort_order ?? 0,
        });
      } catch (e: any) {
        alert("Yüklenemedi: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, editId]);

  function set<K extends keyof CourseFormData>(field: K, value: CourseFormData[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setWeek(idx: number, field: keyof WeekModule, value: any) {
    setForm((f) => {
      const weeks = [...f.weeks];
      weeks[idx] = { ...weeks[idx], [field]: value };
      return { ...f, weeks };
    });
  }

  function addWeek() {
    setForm((f) => ({
      ...f,
      weeks: [...f.weeks, { n: f.weeks.length + 1, title: "", desc: "" }],
    }));
  }

  function removeWeek(idx: number) {
    setForm((f) => {
      const weeks = f.weeks.filter((_, i) => i !== idx).map((w, i) => ({ ...w, n: i + 1 }));
      return { ...f, weeks };
    });
  }

  function setAudience(idx: number, value: string) {
    setForm((f) => {
      const a = [...f.audience];
      a[idx] = value;
      return { ...f, audience: a };
    });
  }

  function addAudience() {
    setForm((f) => ({ ...f, audience: [...f.audience, ""] }));
  }

  function removeAudience(idx: number) {
    setForm((f) => ({ ...f, audience: f.audience.filter((_, i) => i !== idx) }));
  }

  function toggleEbook(slug: string) {
    setForm((f) => ({
      ...f,
      related_ebook_slugs: f.related_ebook_slugs.includes(slug)
        ? f.related_ebook_slugs.filter((s) => s !== slug)
        : [...f.related_ebook_slugs, slug],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Basit validation
      if (!form.slug.trim()) throw new Error("Slug zorunlu");
      if (!form.title.trim()) throw new Error("Başlık zorunlu");
      if (!form.price_kurus || form.price_kurus < 100) throw new Error("Fiyat (kuruş) 100'den büyük olmalı");

      // Boş audience'ları temizle
      const cleanedAudience = form.audience.map((a) => a.trim()).filter(Boolean);
      // Boş week title/desc olanları temizle
      const cleanedWeeks = form.weeks.filter((w) => w.title.trim() || w.desc.trim());

      const payload = {
        ...form,
        audience: cleanedAudience,
        weeks: cleanedWeeks,
      };

      if (isEdit && editId) {
        await apiFetch(`/admin/courses/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/admin/courses`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setLocation("/admin/kurslar");
    } catch (e: any) {
      setError(e.message ?? "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#0ea5e9]" />
      </div>
    );
  }

  const labelCls = "block text-[12px] font-semibold text-[#1B365D] mb-1.5";
  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 outline-none";
  const textareaCls = `${inputCls} font-normal`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => setLocation("/admin/kurslar")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1B365D] mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Kurs Listesine Dön
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#0ea5e9]/10 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-[#0ea5e9]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1B365D]">
            {isEdit ? "Kurs Düzenle" : "Yeni Kurs"}
          </h1>
          <p className="text-sm text-gray-500">Tüm alanları doldurup kaydet</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Temel Bilgiler */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-[#1B365D] mb-4">Temel Bilgiler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ödeme Slug (internal) *</label>
              <input required value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls} placeholder="foundation" />
              <p className="text-[11px] text-gray-500 mt-1">Iyzico ödemesinde referans — <b>{form.slug || "foundation"}</b></p>
            </div>
            <div>
              <label className={labelCls}>URL Slug (level_slug) *</label>
              <input required value={form.level_slug} onChange={(e) => set("level_slug", e.target.value)} className={inputCls} placeholder="a1-a2" />
              <p className="text-[11px] text-gray-500 mt-1">Sitedeki URL: /is-ingilizcesi-kursu/<b>{form.level_slug || "a1-a2"}</b></p>
            </div>
            <div>
              <label className={labelCls}>Sıralama</label>
              <input type="number" value={form.sort_order} onChange={(e) => set("sort_order", parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Başlık (TR) *</label>
              <input required value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="İş İngilizcesine Sıfırdan Başla" />
            </div>
            <div>
              <label className={labelCls}>Başlık (EN)</label>
              <input value={form.title_en} onChange={(e) => set("title_en", e.target.value)} className={inputCls} placeholder="Business English Foundation" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Alt Başlık / Tagline</label>
              <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} placeholder="İş hayatında İngilizce iletişim kurmaya yeni başlayan..." />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Uzun Açıklama</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} className={textareaCls} placeholder="Detay sayfası hero'sunda görünecek..." />
            </div>
          </div>
        </section>

        {/* Seviye */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-[#1B365D] mb-4">Seviye</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Seviye Kısa (level)</label>
              <input value={form.level} onChange={(e) => set("level", e.target.value)} className={inputCls} placeholder="A1-A2" />
            </div>
            <div>
              <label className={labelCls}>Rozet</label>
              <input value={form.level_badge} onChange={(e) => set("level_badge", e.target.value)} className={inputCls} placeholder="Seviye 1" />
            </div>
            <div>
              <label className={labelCls}>CEFR</label>
              <input value={form.level_cefr} onChange={(e) => set("level_cefr", e.target.value)} className={inputCls} placeholder="A1 – A2" />
            </div>
            <div>
              <label className={labelCls}>Kime Uygun (kısa)</label>
              <input value={form.level_audience} onChange={(e) => set("level_audience", e.target.value)} className={inputCls} placeholder="Yeni başlayanlar için" />
            </div>
          </div>
        </section>

        {/* Süre + Fiyat */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-[#1B365D] mb-4">Süre & Fiyat</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Hafta Sayısı</label>
              <input type="number" min={1} value={form.duration_weeks} onChange={(e) => set("duration_weeks", parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Süre Etiketi</label>
              <input value={form.duration_label} onChange={(e) => set("duration_label", e.target.value)} className={inputCls} placeholder="4 Hafta · 60 dk · Haftada 1 canlı ders" />
            </div>
            <div>
              <label className={labelCls}>Fiyat (kuruş) *</label>
              <input required type="number" min={100} value={form.price_kurus} onChange={(e) => set("price_kurus", parseInt(e.target.value) || 0)} className={inputCls} />
              <p className="text-[11px] text-gray-500 mt-1">₺{(form.price_kurus / 100).toFixed(2)}</p>
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Fiyat Görünen (display)</label>
              <input value={form.price_display} onChange={(e) => set("price_display", e.target.value)} className={inputCls} placeholder="4.999 TL" />
            </div>
          </div>
        </section>

        {/* Cohort */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-[#1B365D] mb-4">Kohort / Grup Bilgisi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Durum</label>
              <select value={form.cohort_status} onChange={(e) => set("cohort_status", e.target.value)} className={inputCls}>
                {COHORT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Başlangıç Tarihi (kesin)</label>
              <input type="date" value={form.cohort_start_date} onChange={(e) => set("cohort_start_date", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Başlangıç Metni (görünen)</label>
              <input value={form.cohort_start_display} onChange={(e) => set("cohort_start_display", e.target.value)} className={inputCls} placeholder="Eylül 2026'nın ilk haftası" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Kapasite</label>
                <input type="number" min={1} value={form.cohort_capacity} onChange={(e) => set("cohort_capacity", parseInt(e.target.value) || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mevcut Kayıt</label>
                <input type="number" min={0} value={form.cohort_registrations} onChange={(e) => set("cohort_registrations", parseInt(e.target.value) || 0)} className={inputCls} />
              </div>
            </div>
          </div>
        </section>

        {/* Haftalar */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1B365D]">Program (Haftalar)</h2>
            <button type="button" onClick={addWeek} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0ea5e9]/10 text-[#0ea5e9] text-sm font-semibold hover:bg-[#0ea5e9]/20">
              <Plus className="w-4 h-4" />
              Hafta Ekle
            </button>
          </div>
          <div className="space-y-3">
            {form.weeks.map((w, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-1">
                  <input type="number" min={1} value={w.n} onChange={(e) => setWeek(idx, "n", parseInt(e.target.value) || 0)} className={inputCls + " text-center"} />
                </div>
                <div className="col-span-4">
                  <input value={w.title} onChange={(e) => setWeek(idx, "title", e.target.value)} className={inputCls} placeholder="Başlık" />
                </div>
                <div className="col-span-6">
                  <textarea value={w.desc} onChange={(e) => setWeek(idx, "desc", e.target.value)} rows={2} className={textareaCls} placeholder="Açıklama" />
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeWeek(idx)} className="w-full p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Kime Uygun */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1B365D]">Kime Uygun</h2>
            <button type="button" onClick={addAudience} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0ea5e9]/10 text-[#0ea5e9] text-sm font-semibold hover:bg-[#0ea5e9]/20">
              <Plus className="w-4 h-4" />
              Madde Ekle
            </button>
          </div>
          <div className="space-y-2">
            {form.audience.map((a, idx) => (
              <div key={idx} className="flex gap-2">
                <input value={a} onChange={(e) => setAudience(idx, e.target.value)} className={inputCls} placeholder="İş hayatında İngilizceyi ilk kez düzenli kullanacaklar" />
                <button type="button" onClick={() => removeAudience(idx)} className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* İlgili E-Kitaplar */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-[#1B365D] mb-4">İlgili E-Kitaplar (Cross-Sell)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {EBOOK_SLUG_OPTIONS.map((slug) => (
              <label key={slug} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:border-[#0ea5e9]/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.related_ebook_slugs.includes(slug)}
                  onChange={() => toggleEbook(slug)}
                  className="accent-[#0ea5e9]"
                />
                <span className="text-sm text-gray-700">{slug}</span>
              </label>
            ))}
          </div>
        </section>

        {/* SEO */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-[#1B365D] mb-4">SEO</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>SEO Başlık (title)</label>
              <input value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} className={inputCls} maxLength={200} placeholder="A1-A2 İş İngilizcesi Kursu | Business English Foundation" />
              <p className="text-[11px] text-gray-500 mt-1">{form.seo_title.length}/200 karakter</p>
            </div>
            <div>
              <label className={labelCls}>SEO Açıklama (meta description)</label>
              <textarea value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} rows={2} className={textareaCls} maxLength={200} placeholder="~140-160 karakter arası, arama sonuçlarında görünecek" />
              <p className="text-[11px] text-gray-500 mt-1">{form.seo_description.length}/200 karakter</p>
            </div>
          </div>
        </section>

        {/* Aktif */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="w-5 h-5 accent-[#0ea5e9]" />
            <div>
              <div className="font-bold text-[#1B365D]">Aktif — sitede görünür</div>
              <div className="text-xs text-gray-500">Pasif yaparsan /is-ingilizcesi-kursu listesinden kaybolur, satın alma engellenir.</div>
            </div>
          </label>
        </section>

        {/* Kaydet */}
        <div className="sticky bottom-4 bg-white rounded-xl border border-gray-200 shadow-lg p-4 flex items-center justify-between">
          <button type="button" onClick={() => setLocation("/admin/kurslar")} className="text-sm text-gray-500 hover:text-[#1B365D]">
            İptal
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Değişiklikleri Kaydet" : "Kursu Oluştur"}
          </button>
        </div>
      </form>
    </div>
  );
}

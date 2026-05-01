'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  sector: string;
  teamSize: string;
  message: string;
}

const SECTORS = [
  'Finans',
  'Teknoloji',
  'Sağlık',
  'Üretim',
  'Perakende',
  'Lojistik',
  'İnşaat',
  'Eğitim',
  'Turizm',
  'Danışmanlık',
  'Hukuk',
  'Medya',
  'Enerji',
  'Diğer',
];

export default function StickyCTA() {
  const [form, setForm] = useState<ContactForm>({ name: '', email: '', phone: '', company: '', sector: '', teamSize: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<ContactForm>>({});
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const e: Partial<ContactForm> = {};
    if (!form.name) e.name = 'Ad Soyad gerekli';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Geçerli e-posta gerekli';
    if (!form.phone) e.phone = 'Telefon numarası gerekli';
    if (!form.company) e.company = 'Şirket adı gerekli';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Bir hata oluştu, lütfen tekrar deneyin.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setApiError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="iletisim" className="py-12 lg:py-20 relative overflow-hidden" style={{ background: '#1B365D' }}>
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#0ea5e9]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#0ea5e9]/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* Left — Copy */}
          <div>
            <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-6">
              İLETİŞİME GEÇİN
            </span>
            <h2 className="text-[26px] sm:text-[34px] lg:text-[50px] font-extrabold tracking-[-0.025em] text-white leading-[1.1] mb-5 lg:mb-6">
              Şirketiniz için<br />
              özel teklif alın.
            </h2>
            <p className="text-[14px] sm:text-[15px] text-white/60 leading-relaxed mb-8 lg:mb-10 max-w-sm">
              Çalışan sayısı, sektör ve hedeflerinizi paylaşın. Size 24 saat içinde kişiselleştirilmiş bir program önerisi sunalım.
            </p>

            <div className="space-y-4 lg:space-y-5">
              {[
                { icon: 'ClockIcon', text: '24 saat içinde geri dönüş garantisi' },
                { icon: 'DocumentTextIcon', text: 'Ücretsiz ihtiyaç analizi ve seviye tespiti' },
                { icon: 'ShieldCheckIcon', text: 'Kurumsal gizlilik ve veri güvenliği' },
                { icon: 'PhoneIcon', text: 'Demo ders talep edebilirsiniz' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
                    <Icon name={item.icon as any} size={15} className="text-white" />
                  </div>
                  <p className="text-[13px] sm:text-[14px] text-white/70">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Form */}
          <div
            className="p-6 sm:p-8 lg:p-[48px] rounded-[20px]"
            style={{
              background: 'linear-gradient(135deg, rgba(27,54,93,0.97), rgba(27,54,93,0.88))',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {!submitted ? (
              <>
                <h3 className="font-display text-[20px] sm:text-[22px] font-bold text-white mb-2 leading-snug" style={{ fontWeight: 700 }}>
                  Teklif Formu
                </h3>
                <p className="text-[13px] text-white/50 mb-6 sm:mb-8">Tüm alanları doldurun, size özel program hazırlayalım.</p>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold tracking-[0.18em] text-white/60 mb-2">Ad Soyad *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                        placeholder="Adınız Soyadınız"
                        className={`form-input w-full px-3 sm:px-4 py-3 text-[14px] text-charcoal rounded-sm ${errors.name ? 'border-red-400' : ''}`}
                      />
                      {errors.name && <p className="text-red-400 text-[11px] mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold tracking-[0.18em] text-white/60 mb-2">Şirket *</label>
                      <input
                        type="text"
                        value={form.company}
                        onChange={(e) => { setForm({ ...form, company: e.target.value }); setErrors({ ...errors, company: '' }); }}
                        placeholder="Şirket Adı"
                        className={`form-input w-full px-3 sm:px-4 py-3 text-[14px] text-charcoal rounded-sm ${errors.company ? 'border-red-400' : ''}`}
                      />
                      {errors.company && <p className="text-red-400 text-[11px] mt-1">{errors.company}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold tracking-[0.18em] text-white/60 mb-2">Kurumsal E-posta *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }); }}
                      placeholder="siz@sirket.com"
                      className={`form-input w-full px-3 sm:px-4 py-3 text-[14px] text-charcoal rounded-sm ${errors.email ? 'border-red-400' : ''}`}
                    />
                    {errors.email && <p className="text-red-400 text-[11px] mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold tracking-[0.18em] text-white/60 mb-2">Telefon Numarası *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => { setForm({ ...form, phone: e.target.value }); setErrors({ ...errors, phone: '' }); }}
                      placeholder="+90 5XX XXX XX XX"
                      className={`form-input w-full px-3 sm:px-4 py-3 text-[14px] text-charcoal rounded-sm ${errors.phone ? 'border-red-400' : ''}`}
                    />
                    {errors.phone && <p className="text-red-400 text-[11px] mt-1">{errors.phone}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold tracking-[0.18em] text-white/60 mb-2">Sektör</label>
                      <select
                        value={form.sector}
                        onChange={(e) => setForm({ ...form, sector: e.target.value })}
                        className="form-input w-full px-3 sm:px-4 py-3 text-[14px] text-charcoal rounded-sm appearance-none cursor-pointer"
                      >
                        <option value="">Seçiniz</option>
                        {SECTORS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold tracking-[0.18em] text-white/60 mb-2">Çalışan Sayısı</label>
                      <select
                        value={form.teamSize}
                        onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                        className="form-input w-full px-3 sm:px-4 py-3 text-[14px] text-charcoal rounded-sm appearance-none cursor-pointer"
                      >
                        <option value="">Seçiniz</option>
                        <option value="1-10">1–10 çalışan</option>
                        <option value="11-50">11–50 çalışan</option>
                        <option value="51-200">51–200 çalışan</option>
                        <option value="200+">200+ çalışan</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold tracking-[0.18em] text-white/60 mb-2">
                      Mesajınız <span className="font-normal normal-case tracking-normal text-white/30">(isteğe bağlı)</span>
                    </label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Eğitim ihtiyacınızı kısaca açıklayın..."
                      rows={3}
                      className="form-input w-full px-3 sm:px-4 py-3 text-[14px] text-charcoal rounded-sm resize-none"
                    />
                  </div>

                  {apiError && (
                    <div className="flex items-start gap-2 p-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <Icon name="ExclamationCircleIcon" size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-[12px]">{apiError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 font-display text-[13px] font-semibold tracking-widest rounded-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all duration-200"
                    style={{ background: 'white', color: '#082567' }}
                  >
                    {loading ? (
                      <>
                        <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                        Gönderiliyor…
                      </>
                    ) : (
                      <>
                        <Icon name="PaperAirplaneIcon" size={16} />
                        TEKLİF TALEP ET
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-white/30 text-center">
                    Bilgileriniz üçüncü taraflarla paylaşılmaz. KVKK kapsamında korunur.
                  </p>
                </form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <Icon name="CheckIcon" size={24} className="text-white" />
                </div>
                <h3 className="font-display text-[22px] font-700 text-white mb-3" style={{ fontWeight: 700 }}>
                  Talebiniz Alındı!
                </h3>
                <p className="text-[14px] text-white/60 leading-relaxed max-w-xs mx-auto">
                  <strong className="text-white">{form.email}</strong> adresine 24 saat içinde dönüş yapacağız. Teşekkürler!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
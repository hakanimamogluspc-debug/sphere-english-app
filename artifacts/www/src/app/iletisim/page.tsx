'use client';
import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface FormData {
  name: string;
  email: string;
  company: string;
  sector: string;
  teamSize: string;
  message: string;
}

export default function IletisimPage() {
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    sector: '',
    teamSize: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bir hata oluştu.');
      setSuccess(true);
      setForm({ name: '', email: '', company: '', sector: '', teamSize: '', message: '' });
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header forceWhite />
      <main className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0f4f8 0%, #ffffff 50%, #e8f0fe 100%)' }}>
        {/* Hero */}
        <section className="pt-32 pb-12 sm:pb-16 px-4 sm:px-6 text-center relative overflow-hidden">
          <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #1B365D 0%, transparent 70%)' }} />
          <div className="relative max-w-2xl mx-auto">
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-4" style={{ color: '#0ea5e9' }}>İLETİŞİM</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 leading-tight" style={{ color: '#1B365D' }}>
              Sizinle Tanışmak<br />İstiyoruz
            </h1>
            <p className="text-base md:text-lg leading-relaxed" style={{ color: '#4a5568' }}>
              Ekibiniz için özel bir İngilizce eğitim programı tasarlamak üzere bize ulaşın.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="pb-16 sm:pb-24 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">

            {/* Left: Contact Info + Map */}
            <div className="flex flex-col gap-6">
              {/* Contact Details Card */}
              <div className="bg-white rounded-3xl shadow-sm border border-[#e8f0fe] p-8">
                <h2 className="text-xl font-bold mb-6" style={{ color: '#1B365D' }}>İletişim Bilgileri</h2>
                <div className="flex flex-col gap-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fe' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#0ea5e9" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: '#0ea5e9' }}>E-POSTA</p>
                      <a href="mailto:info@sphereenglish.com" className="text-sm font-medium hover:text-[#0ea5e9] transition-colors" style={{ color: '#1B365D' }}>
                        info@sphereenglish.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fe' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#0ea5e9" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: '#0ea5e9' }}>TELEFON</p>
                      <a href="tel:+903128701058" className="text-sm font-medium hover:text-[#0ea5e9] transition-colors" style={{ color: '#1B365D' }}>
                        +90 (312) 870 10 58
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fe' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#0ea5e9" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: '#0ea5e9' }}>WHATSAPP</p>
                      <a href="https://wa.me/903128701058" target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-[#0ea5e9] transition-colors" style={{ color: '#1B365D' }}>
                        WhatsApp
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fe' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#0ea5e9" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: '#0ea5e9' }}>ADRES</p>
                      <p className="text-sm font-medium leading-relaxed" style={{ color: '#1B365D' }}>
                        Kızılırmak mah. Dumlupınar Blv. YDA Center 9A No:158<br />
                        Çankaya/ANKARA
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f0fe' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#0ea5e9" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: '#0ea5e9' }}>ÇALIŞMA SAATLERİ</p>
                      <p className="text-sm font-medium" style={{ color: '#1B365D' }}>Pazartesi – Cuma: 09:00 – 18:00</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Konum Kartı */}
              <a
                href=""
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-3xl shadow-sm border border-[#e8f0fe] overflow-hidden hover:shadow-md transition-shadow duration-200 group"
                aria-label="Google Maps'te aç"
              >
                {/* Statik harita görseli */}
                <div
                  className="relative w-full flex flex-col items-center justify-center gap-4"
                  style={{ minHeight: '240px', background: 'linear-gradient(135deg, #e8f0fe 0%, #f0f7ff 50%, #dbeafe 100%)' }}
                >
                  {/* Pin ikonu */}
                  <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#1B365D' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#fff"/>
                    </svg>
                  </div>
                  <div className="text-center px-6">
                    <p className="text-[13px] font-bold text-[#1B365D] mb-1">YDA Center</p>
                    <p className="text-[12px] text-gray-500">Dumlupınar Bulvarı No:158</p>
                    <p className="text-[12px] text-gray-500">Çankaya / Ankara</p>
                  </div>
                  {/* Tıkla butonu */}
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-bold text-white transition-all duration-200 group-hover:opacity-90" style={{ background: '#0ea5e9' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    Google Maps'te Aç
                  </div>
                </div>
              </a>
            </div>

            {/* Right: Contact Form */}
            <div className="bg-white rounded-3xl shadow-sm border border-[#e8f0fe] p-8">
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1B365D' }}>Teklif Alın</h2>
              <p className="text-sm mb-7" style={{ color: '#4a5568' }}>Formu doldurun, en kısa sürede size dönelim.</p>

              {success ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ background: '#e8f0fe' }}>
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#0ea5e9" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: '#1B365D' }}>Mesajınız İletildi!</h3>
                  <p className="text-sm" style={{ color: '#4a5568' }}>En kısa sürede sizinle iletişime geçeceğiz.</p>
                  <button
                    onClick={() => setSuccess(false)}
                    className="mt-4 px-6 py-2.5 rounded-full text-white text-[11px] font-bold tracking-[0.16em] transition-all duration-200 hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #1B365D 0%, #082567 100%)' }}
                  >
                    YENİ FORM
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#1B365D' }}>
                        Ad Soyad <span style={{ color: '#0ea5e9' }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="Adınız Soyadınız"
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/10"
                        style={{ borderColor: '#e8f0fe', color: '#1B365D', background: '#f8fafc' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#1B365D' }}>
                        E-posta <span style={{ color: '#0ea5e9' }}>*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="ornek@sirket.com"
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/10"
                        style={{ borderColor: '#e8f0fe', color: '#1B365D', background: '#f8fafc' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#1B365D' }}>
                      Şirket Adı <span style={{ color: '#0ea5e9' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={form.company}
                      onChange={handleChange}
                      required
                      placeholder="Şirketinizin adı"
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/10"
                      style={{ borderColor: '#e8f0fe', color: '#1B365D', background: '#f8fafc' }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#1B365D' }}>Sektör</label>
                      <select
                        name="sector"
                        value={form.sector}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/10"
                        style={{ borderColor: '#e8f0fe', color: form.sector ? '#1B365D' : '#9ca3af', background: '#f8fafc' }}
                      >
                        <option value="">Seçiniz</option>
                        <option value="Finans">Finans</option>
                        <option value="Teknoloji">Teknoloji</option>
                        <option value="Sağlık">Sağlık</option>
                        <option value="Hukuk">Hukuk</option>
                        <option value="Üretim">Üretim</option>
                        <option value="Perakende">Perakende</option>
                        <option value="Diğer">Diğer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#1B365D' }}>Çalışan Sayısı</label>
                      <select
                        name="teamSize"
                        value={form.teamSize}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/10"
                        style={{ borderColor: '#e8f0fe', color: form.teamSize ? '#1B365D' : '#9ca3af', background: '#f8fafc' }}
                      >
                        <option value="">Seçiniz</option>
                        <option value="1-10">1 – 10</option>
                        <option value="11-50">11 – 50</option>
                        <option value="51-200">51 – 200</option>
                        <option value="201-500">201 – 500</option>
                        <option value="500+">500+</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#1B365D' }}>Mesajınız</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Eğitim ihtiyacınızı kısaca anlatın..."
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/10 resize-none"
                      style={{ borderColor: '#e8f0fe', color: '#1B365D', background: '#f8fafc' }}
                    />
                  </div>

                  {error && (
                    <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 w-full py-3.5 rounded-full text-white text-[12px] font-bold tracking-[0.18em] transition-all duration-200 hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #1B365D 0%, #082567 100%)' }}
                  >
                    {loading ? 'GÖNDERİLİYOR...' : 'TEKLİF TALEP ET'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

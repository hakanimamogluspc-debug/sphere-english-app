'use client';
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';

const timelineEvents = [
  {
    year: '2019',
    title: 'Kuruluş',
    description:
      'Didem ve Merve, Türk iş dünyasında İngilizce eğitiminin yetersizliğini fark ederek Sphere English\'i kurdu. İlk 5 şirketle pilot program başlatıldı.',
    side: 'left',
  },
  {
    year: '2021',
    title: 'Oxford Ortaklığı',
    description:
      'Oxford University Press ile resmi eğitim ortaklığı kuruldu. Müfredat uluslararası standartlara taşındı, online platform hayata geçirildi.',
    side: 'right',
  },
  {
    year: '2024',
    title: 'Sektör Lideri',
    description:
      '50+ kurumsal müşteri, 500+ eğitim alan çalışan ve %94 memnuniyet oranıyla Türkiye\'nin önde gelen kurumsal İngilizce eğitim markası haline gelindi.',
    side: 'left',
  },
];

const stats = [
  { value: '500+', label: 'Eğitim Alan Çalışan', icon: '👥' },
  { value: '50+', label: 'Kurumsal Şirket', icon: '🏢' },
  { value: '%94', label: 'Memnuniyet Oranı', icon: '⭐' },
];

export default function HakkimizdaPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Header forceWhite />
      <main>

        {/* ── HERO ── */}
        <section className="pt-32 pb-16 sm:pb-20 bg-gradient-to-br from-[#f0f4f8] via-white to-[#e8f0fe] relative overflow-hidden">
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#082567]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#0ea5e9]/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
            <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
              {/* Text */}
              <div>
                <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
                  Hakkımızda
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1B365D] mb-6 leading-tight">
                  Merhaba, biz{' '}
                  <span className="text-[#0ea5e9]">Sphere English</span>
                  &#39;in kurucularıyız
                </h1>
                <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
                  Türk iş dünyasının global arenada güçlü bir ses bulması için yola çıktık. İki eğitimci, bir vizyon: İş İngilizcesinde gerçek fark yaratmak.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    <div className="w-12 h-12 rounded-full border-2 border-white bg-[#1B365D] flex items-center justify-center text-white font-bold text-sm shadow-md">D</div>
                    <div className="w-12 h-12 rounded-full border-2 border-white bg-[#0ea5e9] flex items-center justify-center text-white font-bold text-sm shadow-md">M</div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1B365D]">Didem İmamoğlu & Merve Eş</p>
                    <p className="text-xs text-gray-400">Sphere English Kurucuları</p>
                  </div>
                </div>
              </div>

              {/* Founder photos */}
              <div className="relative flex justify-center items-end gap-3 sm:gap-4">
                {/* Didem card */}
                <div className="relative group">
                  <div className="w-36 h-48 sm:w-52 sm:h-64 md:w-60 md:h-72 rounded-2xl overflow-hidden shadow-xl border-4 border-white">
                    <Image
                      src="/assets/images/WhatsApp_Image_2026-03-19_at_13.55.36-1773919883509.jpeg"
                      alt="Didem İmamoğlu - Sphere English Kurucu Ortağı"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#1B365D] text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 rounded-full shadow-md whitespace-nowrap">
                    Didem İmamoğlu
                  </div>
                </div>
                {/* Merve card — slightly elevated */}
                <div className="relative group -mb-6">
                  <div className="w-36 h-48 sm:w-52 sm:h-64 md:w-60 md:h-72 rounded-2xl overflow-hidden shadow-xl border-4 border-white">
                    <Image
                      src="/assets/images/WhatsApp_Image_2026-03-19_at_13.55.56-1773929304418.jpeg"
                      alt="Merve Eş - Sphere English Kurucu Ortağı"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#0ea5e9] text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 rounded-full shadow-md whitespace-nowrap">
                    Merve Eş
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── MİSYON & VİZYON ── */}
        <section className="py-16 sm:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-10">

              {/* Misyon */}
              <div className="bg-[#f8fafc] border border-gray-100 rounded-3xl p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
                <span className="text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase block mb-3">
                  Misyon
                </span>
                <h3 className="text-xl font-extrabold text-[#1B365D] mb-5 leading-snug">
                  &ldquo;Türk profesyonellerine iş dünyasında fark yaratan iletişim gücü kazandırıyoruz.&rdquo;
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  Biz, Sphere English olarak sadece dil öğretmiyoruz. Çalışanlarınıza global arenada güvenle konuşabilme, etkili sunum yapabilme ve uluslararası müzakerelerde söz sahibi olabilme yetkinliği kazandırıyoruz.
                </p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Oxford University Press müfredatını iş dünyasının gerçekleriyle birleştirerek, teoriden ziyade pratik, ölçülebilir ve sürdürülebilir sonuçlar elde ediyoruz. Her çalışanın öğrenme hikayesi farklıdır ve bizim işimiz, o hikayeyi keşfetmek ve güçlendirmektir.
                </p>
              </div>

              {/* Vizyon */}
              <div className="bg-[#1B365D] rounded-3xl p-10 shadow-sm hover:shadow-md transition-shadow duration-300">
                <span className="text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase block mb-3">
                  Vizyon
                </span>
                <h3 className="text-xl font-extrabold text-white mb-5 leading-snug">
                  &ldquo;2030 yılına kadar 10.000 Türk profesyonelini global iş dünyasına hazırlamak.&rdquo;
                </h3>
                <p className="text-sm text-white/70 leading-relaxed mb-4">
                  Sphere English olarak hedefimiz, Türkiye&apos;nin en güvenilir kurumsal İş İngilizcesi eğitim markası olmak. Sadece dil eğitimi değil, kariyer dönüşümü sunuyoruz.
                </p>
                <p className="text-sm text-white/70 leading-relaxed mb-4">
                  Teknolojiyi ve yapay zekayı eğitim süreçlerine entegre ederken, insan dokunuşunu asla kaybetmiyoruz. Didem ve Merve&apos;nin liderliğinde, her bir çalışanın potansiyelini maksimize eden, kişiselleştirilmiş ve sonuç odaklı bir öğrenme deneyimi yaratıyoruz.
                </p>
                <p className="text-sm text-white/70 leading-relaxed">
                  İş İngilizcesinde standart belirlemek ve Türk şirketlerinin uluslararası başarısına katkıda bulunmak için buradayız.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ── KURUCULAR ── */}
        <section className="py-16 sm:py-24 bg-gradient-to-br from-[#f0f4f8] to-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-3">
                Ekibimiz
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1B365D]">Kurucularımız</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-10">
              {/* Didem */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 group hover:shadow-xl transition-shadow duration-300">
                <div className="relative h-[28rem] sm:h-96 overflow-hidden">
                  <Image
                    src="/assets/images/WhatsApp_Image_2026-03-19_at_13.55.36-1773919883509.jpeg"
                    alt="Didem İmamoğlu - Sphere English Kurucu Ortağı, İngilizce Eğitim Uzmanı"
                    fill
                    className="object-cover object-[center_15%] group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1B365D]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-5">
                    <h3 className="text-xl font-extrabold text-white">Didem İmamoğlu</h3>
                    <p className="text-[#0ea5e9] text-sm font-semibold">Kurucu Ortak & Eğitim Direktörü</p>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    Ankara Üniversitesi İngiliz Dili ve Edebiyatı mezunu olan Didem, mezuniyetinin ardından kariyerini İngilizce eğitimi ve öğretmenlik üzerine kurdu. Eğitim alanındaki deneyimiyle, profesyonellerin iş dünyasında İngilizceyi sadece öğrenmelerini değil, güvenle kullanmalarını hedefler.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Kurumsal Koçluk', 'Müfredat Tasarımı', 'Oxford Sertifikalı']?.map((tag) => (
                      <span key={tag} className="text-[11px] font-semibold bg-[#1B365D]/8 text-[#1B365D] px-3 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Merve */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 group hover:shadow-xl transition-shadow duration-300">
                <div className="relative h-[28rem] sm:h-96 overflow-hidden">
                  <Image
                    src="/assets/images/WhatsApp_Image_2026-03-19_at_13.55.56-1773929304418.jpeg"
                    alt="Merve Eş - Sphere English Kurucu Ortağı, İş İngilizcesi Uzmanı"
                    fill
                    className="object-cover object-[center_15%] group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1B365D]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-5">
                    <h3 className="text-xl font-extrabold text-white">Merve Eş</h3>
                    <p className="text-[#0ea5e9] text-sm font-semibold">Kurucu Ortak & İş Geliştirme Direktörü</p>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    Ankara Üniversitesi İngiliz Dili ve Edebiyatı mezunu olan Merve, kariyerine Avrupa merkezli şirketlerde başlayarak kurumsal iş dünyasında deneyim kazandı. Bu deneyimi sayesinde, profesyonellerin uluslararası ortamlarda ihtiyaç duyduğu iletişim becerilerine odaklanır.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Sunum Teknikleri', 'İçerik Geliştirme', 'Mentorluk']?.map((tag) => (
                      <span key={tag} className="text-[11px] font-semibold bg-[#0ea5e9]/10 text-[#0ea5e9] px-3 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-base text-gray-600 mt-8 font-bold flex justify-center">Sphere English, eğitim uzmanlığı ile gerçek iş dünyası deneyimini bir araya getirir.</p>
          </div>
        </section>

        {/* ── RAKAMLAR ── */}
        <section className="py-16 sm:py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-3">
                Başarılarımız
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1B365D]">Rakamlarla Sphere English</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {stats?.map((stat) => (
                <div
                  key={stat?.label}
                  className="text-center bg-gradient-to-br from-[#f0f4f8] to-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                  <div className="text-3xl mb-3">{stat?.icon}</div>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1B365D] mb-2">{stat?.value}</div>
                  <div className="text-sm font-semibold text-gray-400 tracking-wide">{stat?.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-16 sm:py-20 bg-gradient-to-br from-[#1B365D] to-[#082567]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4">Birlikte çalışalım</h2>
            <p className="text-white/70 mb-8 leading-relaxed">
              Ekibinizin global potansiyelini açığa çıkarmak için ücretsiz demo randevusu alın.
            </p>
            <Link
              href="#iletisim"
              className="inline-block px-8 py-3.5 rounded-full bg-[#0ea5e9] text-white text-[13px] font-bold tracking-[0.16em] hover:bg-[#0284c7] transition-colors duration-200 shadow-lg"
            >
              ÜCRETSİZ DEMO AL
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

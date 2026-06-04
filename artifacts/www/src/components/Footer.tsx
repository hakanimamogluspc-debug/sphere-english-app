import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';


export default function Footer() {
  return (
    <footer style={{ background: '#0d1f4e' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        {/* Top row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 mb-12 pb-12 border-b border-white/10">

          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-6">
              <Link href="/">
                <Image
                  src="/assets/images/Ad_6_-1774054899206.png"
                  alt="Sphere English Logo"
                  width={180}
                  height={60}
                  style={{ objectFit: 'contain' }}
                />
              </Link>
            </div>
            <p className="text-[14px] text-white/65 leading-relaxed max-w-xs mb-7">
              Kurumsal İş İngilizcesi eğitiminde ölçülebilir sonuçlar. Şirketinizi global arenada rekabetçi kılıyoruz.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://www.sphereenglish.com"
                aria-label="Web sitesi"
                className="w-9 h-9 rounded border border-white/25 flex items-center justify-center text-white/55 hover:text-white hover:border-white/60 transition-colors"
              >
                <Icon name="GlobeAltIcon" size={15} />
              </a>
              <a
                href="mailto:info@sphereenglish.com"
                aria-label="E-posta"
                className="w-9 h-9 rounded border border-white/25 flex items-center justify-center text-white/55 hover:text-white hover:border-white/60 transition-colors"
              >
                <Icon name="EnvelopeIcon" size={15} />
              </a>
              <a
                href="tel:+903128701058"
                aria-label="Telefon"
                className="w-9 h-9 rounded border border-white/25 flex items-center justify-center text-white/55 hover:text-white hover:border-white/60 transition-colors"
              >
                <Icon name="PhoneIcon" size={15} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-white/45 mb-6 uppercase">Program</p>
            <div className="flex flex-col gap-3.5">
              <Link href="/home" className="text-[14px] text-white/70 hover:text-white transition-colors">Anasayfa</Link>
              <Link href="/hakkimizda" className="text-[14px] text-white/70 hover:text-white transition-colors">Hakkımızda</Link>
              <Link href="/nasil-calisir" className="text-[14px] text-white/70 hover:text-white transition-colors">Nasıl Çalışır</Link>
              <Link href="/cozumler" className="text-[14px] text-white/70 hover:text-white transition-colors">Çözümler</Link>
              <Link href="/blog" className="text-[14px] text-white/70 hover:text-white transition-colors">Blog</Link>
              <Link href="/iletisim" className="text-[14px] text-white/70 hover:text-white transition-colors">İletişim</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-white/45 mb-6 uppercase">İletişim</p>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5 text-[14px] text-white/70">
                <Icon name="EnvelopeIcon" size={14} className="flex-shrink-0 text-white/50" />
                <span>info@sphereenglish.com</span>
              </div>
              <div className="flex items-center gap-2.5 text-[14px] text-white/70">
                <Icon name="PhoneIcon" size={14} className="flex-shrink-0 text-white/50" />
                <span>+90 (312) 870 10 58</span>
              </div>
              <div className="flex items-center gap-2.5 text-[14px]">
                <a
                  href="https://wa.me/905066085810"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-white/70 hover:text-green-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-white/50">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>WhatsApp</span>
                </a>
              </div>
              <div className="flex items-start gap-2.5 text-[14px] text-white/70">
                <Icon name="MapPinIcon" size={14} className="flex-shrink-0 mt-0.5 text-white/50" />
                <span>Kızılırmak mah. Dumlupınar Blv. YDA Center 9A No:158 Çankaya/ANKARA</span>
              </div>
              <Link
                href="/iletisim"
                className="mt-2 inline-flex items-center gap-2 text-[12px] font-bold tracking-[0.18em] px-5 py-3 rounded transition-all duration-200 hover:bg-white/20"
                style={{ background: 'rgba(255,255,255,0.13)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <Icon name="EnvelopeIcon" size={13} />
                TEKLİF AL
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-white/40 text-center md:text-left">
            © 2026 Sphere English. Tüm hakları saklıdır.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] text-white/40">
            <Link href="/gizlilik-politikasi" className="hover:text-white/70 transition-colors">Gizlilik Politikası</Link>
            <Link href="/kullanim-kosullari" className="hover:text-white/70 transition-colors">Kullanım Koşulları</Link>
            <Link href="/kvkk" className="hover:text-white/70 transition-colors">KVKK</Link>
            <a href="https://www.linkedin.com/company/sphere-english/" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors" aria-label="LinkedIn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a href="https://www.instagram.com/sphereenglish" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors" aria-label="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
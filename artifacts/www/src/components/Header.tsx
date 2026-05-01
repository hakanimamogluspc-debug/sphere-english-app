'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';

const cozumlerMenu = [
  {
    category: 'Beceriye Göre',
    items: [
      { label: 'Toplantı İngilizcesi', slug: 'toplanti-ingilizcesi' },
      { label: 'Sunum Teknikleri', slug: 'sunum-teknikleri' },
      { label: 'E-posta Yazımı', slug: 'eposta-yazimi' },
      { label: 'Müzakere ve İkna', slug: 'muzakere-ve-ikna' },
      { label: 'Telaffuz ve Akıcılık', slug: 'telaffuz-ve-akicilik' },
    ],
  },
  {
    category: 'Rolüne Göre',
    items: [
      { label: 'Yöneticiler için', slug: 'yoneticiler-icin' },
      { label: 'İK Profesyonelleri', slug: 'ik-profesyonelleri' },
      { label: 'Satış Ekipleri', slug: 'satis-ekipleri' },
      { label: 'Teknik Ekipler', slug: 'teknik-ekipler' },
    ],
  },
  {
    category: 'Sektöre Göre',
    items: [
      { label: 'Finans İngilizcesi', slug: 'finans-ingilizcesi' },
      { label: 'Teknoloji İngilizcesi', slug: 'teknoloji-ingilizcesi' },
      { label: 'Sağlık İngilizcesi', slug: 'saglik-ingilizcesi' },
      { label: 'Hukuk İngilizcesi', slug: 'hukuk-ingilizcesi' },
    ],
  },
];

export default function Header({ forceWhite = false }: { forceWhite?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cozumlerOpen, setCozumlerOpen] = useState(false);
  const [mobileCozumlerOpen, setMobileCozumlerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCozumlerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || forceWhite
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#e8f0fe]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between" style={{ height: '100px' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Link href="/">
            <Image
              src="/assets/images/Ad_5_-1774053772671.png"
              alt="Sphere English Logo"
              width={420}
              height={105}
              className="hidden md:block object-contain"
              style={{ maxHeight: '132px', width: 'auto' }}
            />
            <Image
              src="/assets/images/Ad_5_-1774053772671.png"
              alt="Sphere English"
              width={120}
              height={120}
              className="md:hidden object-contain"
              style={{ maxHeight: '96px', width: 'auto' }}
            />
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-7 text-[11px] font-bold tracking-[0.18em]" style={{ color: '#1B365D' }}>
          <Link href="/home" className="hover:text-[#0ea5e9] transition-colors duration-200">ANASAYFA</Link>
          <Link href="/hakkimizda" className="hover:text-[#0ea5e9] transition-colors duration-200">HAKKIMIZDA</Link>
          <Link href="/ai-studio" className="px-4 py-2 rounded-full text-[11px] font-bold tracking-[0.18em] transition-all hover:opacity-90" style={{ color: '#0ea5e9', background: '#0ea5e912' }}>AI STUDIO</Link>

          {/* Çözümler Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-1 hover:text-[#0ea5e9] transition-colors duration-200 focus:outline-none"
              style={{ color: 'inherit' }}
              onClick={() => setCozumlerOpen(!cozumlerOpen)}
              onMouseEnter={() => setCozumlerOpen(true)}
            >
              ÇÖZÜMLER
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${cozumlerOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {cozumlerOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[640px] bg-white rounded-2xl shadow-xl border border-[#e8f0fe] p-6 z-50"
                onMouseLeave={() => setCozumlerOpen(false)}
              >
                {/* Arrow */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-[#e8f0fe] rotate-45" />
                <div className="grid grid-cols-3 gap-6">
                  {cozumlerMenu.map((group) => (
                    <div key={group.category}>
                      <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-3 pb-2 border-b border-[#e8f0fe]" style={{ color: '#0ea5e9' }}>
                        {group.category}
                      </p>
                      <ul className="flex flex-col gap-2">
                        {group.items.map((item) => (
                          <li key={item.slug}>
                            <Link
                              href={`/cozumler/${item.slug}`}
                              className="text-[12px] font-medium hover:translate-x-1 transition-all duration-150 flex items-center gap-1.5 group"
                              style={{ color: '#1B365D' }}
                              onClick={() => setCozumlerOpen(false)}
                            >
                              <span className="w-1 h-1 rounded-full bg-[#0ea5e9]/30 group-hover:bg-[#0ea5e9] transition-colors flex-shrink-0" />
                              <span className="group-hover:text-[#0ea5e9] transition-colors">{item.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/blog" className="hover:text-[#0ea5e9] transition-colors duration-200">BLOG</Link>
          <Link href="/iletisim" className="hover:text-[#0ea5e9] transition-colors duration-200">İLETİŞİM</Link>
          <a
            href="https://app.sphereenglish.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 px-5 py-2 rounded-full text-[11px] font-bold tracking-[0.18em] transition-all duration-200 hover:opacity-90 hover:shadow-md border"
            style={{ color: '#0ea5e9', borderColor: '#0ea5e9', background: 'transparent' }}
          >
            GİRİŞ YAP
          </a>
          <Link
            href="/iletisim"
            className="ml-1 px-5 py-2 rounded-full text-white text-[11px] font-bold tracking-[0.18em] transition-all duration-200 hover:opacity-90 hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}
          >
            TEKLİF AL
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center transition-colors"
          style={{ color: '#1B365D' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menü"
        >
          <Icon name={mobileOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#e8f0fe] px-6 py-6 flex flex-col gap-5">
          <Link href="/home" className="text-[12px] font-bold tracking-[0.18em] hover:text-[#0ea5e9] transition-colors duration-200" style={{ color: '#1B365D' }} onClick={() => setMobileOpen(false)}>ANASAYFA</Link>
          <Link href="/hakkimizda" className="text-[12px] font-bold tracking-[0.18em] hover:text-[#0ea5e9] transition-colors duration-200" style={{ color: '#1B365D' }} onClick={() => setMobileOpen(false)}>HAKKIMIZDA</Link>
          <Link href="/ai-studio" className="inline-block text-[12px] font-bold tracking-[0.18em] px-4 py-2.5 rounded-full transition-all" style={{ color: '#0ea5e9', background: '#0ea5e912' }} onClick={() => setMobileOpen(false)}>AI STUDIO</Link>

          {/* Mobile Çözümler */}
          <div>
            <button
              className="w-full flex items-center justify-between text-[12px] font-bold tracking-[0.18em] hover:text-[#0ea5e9] transition-colors duration-200"
              style={{ color: '#1B365D' }}
              onClick={() => setMobileCozumlerOpen(!mobileCozumlerOpen)}
            >
              ÇÖZÜMLER
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${mobileCozumlerOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {mobileCozumlerOpen && (
              <div className="mt-3 pl-3 border-l-2 border-[#0ea5e9]/20 flex flex-col gap-4">
                {cozumlerMenu.map((group) => (
                  <div key={group.category}>
                    <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: '#0ea5e9' }}>{group.category}</p>
                    <ul className="flex flex-col gap-2">
                      {group.items.map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={`/cozumler/${item.slug}`}
                            className="text-[12px] font-medium hover:text-[#0ea5e9] transition-colors"
                            style={{ color: '#1B365D' }}
                            onClick={() => { setMobileOpen(false); setMobileCozumlerOpen(false); }}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/blog" className="text-[12px] font-bold tracking-[0.18em] hover:text-[#0ea5e9] transition-colors duration-200" style={{ color: '#1B365D' }} onClick={() => setMobileOpen(false)}>BLOG</Link>
          <Link href="/iletisim" className="text-[12px] font-bold tracking-[0.18em] hover:text-[#0ea5e9] transition-colors duration-200" style={{ color: '#1B365D' }} onClick={() => setMobileOpen(false)}>İLETİŞİM</Link>
          <a
            href="https://app.sphereenglish.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 px-5 py-2.5 rounded-full text-[11px] font-bold tracking-[0.18em] text-center transition-all duration-200 hover:opacity-90 border"
            style={{ color: '#0ea5e9', borderColor: '#0ea5e9', background: 'transparent' }}
            onClick={() => setMobileOpen(false)}
          >
            GİRİŞ YAP
          </a>
          <Link
            href="/iletisim"
            className="mt-1 px-5 py-2.5 rounded-full text-white text-[11px] font-bold tracking-[0.18em] text-center transition-all duration-200 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}
            onClick={() => setMobileOpen(false)}
          >
            TEKLİF AL
          </Link>
        </div>
      )}
    </header>
  );
}
'use client';
import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';

const logos = [
  { src: '/assets/images/olivamore-1773918418269.png', alt: 'Olivamore logo' },
  { src: '/assets/images/Ekran_goruntusu_2026-03-19_141202-1773918752604.png', alt: 'ENME logo' },
  { src: '/assets/images/logo-1773918858989.png', alt: 'Andepol logo' },
  { src: '/assets/images/images-1773919202468.jpg', alt: 'Yekta Enerji logo' },
  { src: '/assets/images/logo-1774019980261.png', alt: 'Aksu Group logo' },
  { src: '/assets/images/Ozrize-1774041652022.png', alt: 'Ozrize logo' },
  { src: '/assets/images/olivamore-1773918418269.png', alt: 'Olivamore logo' },
  { src: '/assets/images/Ekran_goruntusu_2026-03-19_141202-1773918752604.png', alt: 'ENME logo' },
  { src: '/assets/images/logo-1773918858989.png', alt: 'Andepol logo' },
  { src: '/assets/images/images-1773919202468.jpg', alt: 'Yekta Enerji logo' },
  { src: '/assets/images/logo-1774019980261.png', alt: 'Aksu Group logo' },
  { src: '/assets/images/Ozrize-1774041652022.png', alt: 'Ozrize logo' },
  { src: '/assets/images/olivamore-1773918418269.png', alt: 'Olivamore logo' },
  { src: '/assets/images/Ekran_goruntusu_2026-03-19_141202-1773918752604.png', alt: 'ENME logo' },
  { src: '/assets/images/logo-1773918858989.png', alt: 'Andepol logo' },
  { src: '/assets/images/images-1773919202468.jpg', alt: 'Yekta Enerji logo' },
  { src: '/assets/images/logo-1774019980261.png', alt: 'Aksu Group logo' },
  { src: '/assets/images/Ozrize-1774041652022.png', alt: 'Ozrize logo' },
];

export default function ReferencesSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<number | null>(null);
  const positionRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const step = () => {
      if (!isPaused) {
        positionRef.current -= 0.5;
        const halfWidth = track.scrollWidth / 2;
        if (Math.abs(positionRef.current) >= halfWidth) {
          positionRef.current = 0;
        }
        track.style.transform = `translateX(${positionRef.current}px)`;
      }
      animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPaused]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true); setIsDragging(true);
    setStartX(e.touches[0].clientX); setScrollLeft(positionRef.current);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    positionRef.current = scrollLeft + (e.touches[0].clientX - startX);
    if (trackRef.current) trackRef.current.style.transform = `translateX(${positionRef.current}px)`;
  };
  const handleTouchEnd = () => { setIsDragging(false); setIsPaused(false); };
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPaused(true); setIsDragging(true);
    setStartX(e.clientX); setScrollLeft(positionRef.current);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    positionRef.current = scrollLeft + (e.clientX - startX);
    if (trackRef.current) trackRef.current.style.transform = `translateX(${positionRef.current}px)`;
  };
  const handleMouseUp = () => { setIsDragging(false); setIsPaused(false); };

  return (
    <section id="referanslar" className="py-20 bg-white overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 mb-12 text-center">
        <span className="inline-block text-[11px] font-bold tracking-[0.22em] text-[#0ea5e9] uppercase mb-4">
          Referanslarımız
        </span>
        <h2 className="text-3xl font-extrabold text-[#1B365D]">Bize güvenen markalar</h2>
      </div>
      <div
        className="relative w-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={trackRef} className="flex whitespace-nowrap will-change-transform">
          {[...logos, ...logos]?.map((logo, index) => (
            <div
              key={index}
              className="inline-flex items-center justify-center mx-10 flex-shrink-0 group pointer-events-auto"
            >
              <Image
                src={logo?.src}
                alt={logo?.alt}
                width={160}
                height={80}
                className="object-contain grayscale group-hover:grayscale-0 transition-all duration-300 opacity-60 group-hover:opacity-100 pointer-events-none"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

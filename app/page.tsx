'use client';

import { useEffect, useState, useRef, useId } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSiteContent } from './lib/use-content';
import ProjectMap from './components/project-map';

const projectSlug = (project: any) => project.slug || String(project.title || 'projekt').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const trackEvent = (event: string, projectId = '') => {
  if (typeof window === 'undefined') return;
  fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, projectId, path: location.pathname }), keepalive: true }).catch(() => {});
};

/**
 * Scroll-reveal hook (IntersectionObserver).
 * - element se odpozoruje po prvním zobrazení (žádné zbytečné callbacky)
 * - bez IntersectionObserver (starší prohlížeč / SSR fallback) zobrazíme hned
 */
const useAnimation = (threshold = 0.12) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentElement = elementRef.current;
    if (!currentElement) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(currentElement);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return { ref: elementRef, isVisible };
};

/** Mapování presetů z administrace (DEFAULT_ANIMATIONS) na CSS třídy. */
const PRESET_CLASS: Record<string, string> = {
  fadeIn: 'reveal-fade',
  slideUp: 'reveal-up',
  slideDown: 'reveal-down',
  slideInLeft: 'reveal-left',
  slideInRight: 'reveal-right',
  scaleIn: 'reveal-scale',
};

/**
 * Sekce s animačním odhalením při scrollu.
 *
 * Animace jsou řešené CSS třídami (.reveal v globals.css) – pouze transform a
 * opacity, tedy na GPU. Skrytý stav se aplikuje jen když běží JS (třída `js`
 * na <html>), takže bez JavaScriptu obsah nezmizí, a prefers-reduced-motion
 * všechno vypne. Nastavení (preset / duration / stagger / enabled) se bere
 * z obsahu webu (DEFAULT_ANIMATIONS → D1).
 */
const AnimatedSection = ({
  children,
  className = '',
  delay = 0,
  preset = 'slideUp',
  duration = 700,
  enabled = true,
  staggerIndex,
  stagger = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  preset?: string;
  duration?: number;
  enabled?: boolean;
  staggerIndex?: number;
  stagger?: number;
}) => {
  const { ref, isVisible } = useAnimation();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  if (!enabled || reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const totalDelay = delay + (typeof staggerIndex === 'number' ? staggerIndex * stagger * 1000 : 0);
  const presetClass = PRESET_CLASS[preset] || 'reveal-up';

  return (
    <div
      ref={ref}
      className={`${className} reveal ${presetClass}${isVisible ? ' is-visible' : ''}`.trim()}
      style={{ transitionDelay: `${totalDelay}ms`, transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

/** Nastavení animací pro konkrétní sekci (z obsahu webu / DEFAULT_ANIMATIONS). */
const sectionAnim = (animations: any, section: string) => {
  const config = animations?.[section] || {};
  return {
    preset: config.preset || 'slideUp',
    duration: Math.round((config.duration ?? 0.7) * 1000),
    stagger: config.stagger ?? 0,
    enabled: config.enabled !== false,
  };
};

/**
 * Oddělovač sekcí – nahrazuje dřívější plný tmavý pruh (`w-full bg-navy`).
 * Jemná dvojité zakřivená vlna s mosaznou linkou, která se při načtení vykreslí.
 * `from` / `to` jsou CSS pozadí (barva nebo gradient) sousedních sekcí.
 */
const SectionDivider = ({
  from,
  to,
  compact = false,
  showLine = true,
}: {
  from: string;
  to: string;
  compact?: boolean;
  showLine?: boolean;
}) => {
  const rawId = useId();
  const id = `divider-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const curve =
    'M0,84 C180,44 320,118 540,104 C760,90 900,26 1120,36 C1290,44 1380,86 1440,70 L1440,140 L0,140 Z';
  const line = 'M0,84 C180,44 320,118 540,104 C760,90 900,26 1120,36 C1290,44 1380,86 1440,70';

  return (
    <div
      aria-hidden="true"
      className={`relative w-full overflow-hidden ${compact ? 'h-[46px] sm:h-[64px]' : 'h-[70px] sm:h-[110px]'}`}
      style={{ background: from }}
    >
      <svg
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        className="block h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={to} stopOpacity="0.55" />
            <stop offset="55%" stopColor={to} stopOpacity="0.95" />
            <stop offset="100%" stopColor={to} stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0" />
            <stop offset="30%" stopColor="#dfc06a" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#c9a84c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a8872e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* měkký podkladový oblouk pro hloubku */}
        <path d={curve} fill={to} opacity="0.35" transform="translate(0, 8)" />
        <path d={curve} fill={`url(#${id}-fill)`} />
        {showLine && (
          <>
            <path d={line} fill="none" stroke="#c9a84c" strokeOpacity="0.16" strokeWidth="6" />
            <path
              d={line}
              fill="none"
              stroke={`url(#${id}-line)`}
              strokeWidth="1.5"
              className="divider-line"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
    </div>
  );
};


// SVG icons
const PhoneIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
  </svg>
);

const MailIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
    <rect x="2" y="4" width="20" height="16" rx="2" />
  </svg>
);

const MapPinIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const HouseIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const HistoryIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

// Mobile menu component
const MobileMenu = ({ isOpen, onClose, phone }: { isOpen: boolean; onClose: () => void; phone: string }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-navy/95 backdrop-blur-lg lg:hidden">
      <div className="flex flex-col items-center justify-center h-full">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white p-2"
          aria-label="Zavřít menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="M6 6 18 18" />
          </svg>
        </button>
        <nav className="flex flex-col items-center gap-8">
          <a href="#hero" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">Domů</a>
          <a href="#o-nas" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">O nás</a>
          <a href="#filozofie" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">Filozofie</a>
          <a href="#galerie" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">Projekty</a>
          <a href="#kontakt" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">Kontakt</a>
          <a
            href={`tel:${phone}`}
            onClick={onClose}
            className="flex items-center gap-2 bg-brass text-navy px-6 py-3 rounded-full text-lg font-medium hover:bg-brass-light transition-colors"
          >
            <PhoneIcon size={18} />
            {phone}
          </a>
        </nav>
      </div>
    </div>
  );
};

// Page loader component
const PageLoader = ({ ready }: { ready: boolean }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setIsVisible(false), 400);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-navy flex items-center justify-center transition-opacity duration-300"
      style={{ opacity: ready ? 0 : 1, pointerEvents: ready ? 'none' : 'auto' }}
    >
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-brass/20 rounded-full animate-pulse" />
          <div className="relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brass" aria-hidden="true">
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <h2 className="font-heading text-2xl text-white mb-2">D&D HOMEINVEST</h2>
          <div className="flex items-center gap-2 justify-center">
            <span className="text-brass/70 text-sm font-body tracking-widest uppercase">Načítání</span>
            <div className="w-2 h-2 bg-brass rounded-full animate-pulse" />
          </div>
        </div>
        <div className="w-48 h-1 bg-brass/30 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-brass to-transparent animate-pulse-slow" />
        </div>
      </div>
    </div>
  );
};

// Team member component
const TeamMember = ({
  member,
  delay = 0,
  anim = { preset: 'slideUp', duration: 700, stagger: 0, enabled: true },
  staggerIndex,
}: {
  member: any;
  delay?: number;
  anim?: { preset?: string; duration?: number; stagger?: number; enabled?: boolean };
  staggerIndex?: number;
}) => (
  <AnimatedSection delay={delay} {...anim} staggerIndex={staggerIndex}>
    <div className="group bg-white rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-2xl border border-gray-light/50 relative overflow-hidden h-full flex flex-col card-lift">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brass via-brass-light to-copper origin-left transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
      <div className="w-40 h-52 mx-auto mb-6 rounded-xl overflow-hidden border-4 border-brass/20 shadow-lg relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.image}
          alt={member.name}
          width={160}
          height={208}
          className="object-cover object-top w-full h-full image-zoom"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="mb-4 text-center px-2">
        <h3 className="font-heading text-2xl font-bold text-navy mb-2">{member.name}</h3>
        <p className="font-body text-brass-dark text-sm font-semibold tracking-wide uppercase mb-2">{member.role}</p>
      </div>
      {member.subtitle && (
        <p className="font-heading text-navy/80 text-lg italic mb-4 text-center px-2">{member.subtitle}</p>
      )}
      <p className="font-body text-gray text-sm leading-relaxed break-words mb-4 px-2 flex-grow">
        {member.description}
      </p>
      <div className="flex flex-col gap-3 pt-4 border-t border-gray-light/60 mt-auto">
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className="flex items-center gap-2 text-navy/70 hover:text-brass transition-colors text-sm"
          >
            <MailIcon />
            <span className="truncate">{member.email}</span>
          </a>
        )}
        {member.phone && (
          <a
            href={`tel:${member.phone}`}
            className="flex items-center gap-2 text-navy/70 hover:text-brass transition-colors text-sm"
          >
            <PhoneIcon />
            <span className="truncate">{member.phone}</span>
          </a>
        )}
      </div>
    </div>
  </AnimatedSection>
);

// Project status badge colors
const statusStyle = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('prodán') || s.includes('prodano') || s.includes('prodáno')) {
    return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30';
  }
  if (s.includes('rezervace') || s.includes('rezervováno')) {
    return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
  }
  return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
};

// Project card component
const ProjectCard = ({
  project,
  delay = 0,
  onDetail,
  anim = { preset: 'slideUp', duration: 700, stagger: 0, enabled: true },
  staggerIndex,
}: {
  project: any;
  delay?: number;
  onDetail: (p: any) => void;
  anim?: { preset?: string; duration?: number; stagger?: number; enabled?: boolean };
  staggerIndex?: number;
}) => (
  <AnimatedSection delay={delay} {...anim} staggerIndex={staggerIndex} className="h-full">
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl border border-gray-light/50 relative h-full flex flex-col card-lift">
      <div className="relative h-72 bg-navy/10 overflow-hidden cursor-pointer focus:outline-none focus:ring-4 focus:ring-brass/60" role="link" tabIndex={0} aria-label={`Zobrazit detail projektu ${project.title}`} onClick={() => onDetail(project)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onDetail(project); } }}>
        {project.images?.[0] ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={project.images[0]}
            alt={project.title}
            className="object-cover w-full h-full image-zoom"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-navy/30">
            <HouseIcon size={64} />
          </div>
        )}
        {project.status && (
          <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-body font-semibold border ${statusStyle(project.status)}`}>
            {project.status}
          </div>
        )}
        {project.price && (
          <div className="absolute top-4 right-4 bg-brass/90 backdrop-blur-sm text-navy px-3 py-1 rounded-full text-xs font-body font-bold">
            {project.price}
          </div>
        )}
        {project.penb && (
          <div className="absolute bottom-4 left-4 bg-navy/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-body font-bold border border-brass/30">
            PENB: {project.penb}
          </div>
        )}
        <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white/95 backdrop-blur-sm text-navy px-6 py-3 rounded-full font-body text-sm font-semibold flex items-center gap-2 shadow-xl border border-brass/20">
            Detail
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </span>
        </div>
      </div>
      <div className="p-5 lg:p-6 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-base lg:text-lg font-bold text-navy group-hover:text-brass transition-colors leading-snug">
              {project.title}
            </h3>
            {project.location && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <MapPinIcon size={13} className="text-brass flex-shrink-0" />
                <span className="font-body text-gray text-sm">{project.location}</span>
              </div>
            )}
          </div>
          {project.area && (
            <span className="font-body text-navy/80 text-xs lg:text-sm font-semibold bg-navy/5 px-3 py-1 rounded-lg whitespace-nowrap flex-shrink-0">
              {project.area}
            </span>
          )}
        </div>
        {project.description && (
          <p className="font-body text-gray text-sm leading-relaxed mb-4">{project.description}</p>
        )}
        {Array.isArray(project.tags) && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag: string) => (
              <span key={tag} className="font-body text-xs px-3 py-1 rounded-full bg-brass/10 text-brass-dark border border-brass/20">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  </AnimatedSection>
);

// Project detail modal
const ProjectModal = ({ project, onClose }: { project: any; onClose: () => void }) => {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!project) return null;
  const images: string[] = Array.isArray(project.images) ? project.images : [];

  return (
    <div className="fixed inset-0 z-[90] bg-navy/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {images.length > 0 && (
            <div className="relative h-72 sm:h-96 bg-navy/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[imageIndex]} alt={project.title} className="object-cover w-full h-full" />
              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImageIndex(i)}
                      className={`w-3 h-3 rounded-full border border-white/60 ${i === imageIndex ? 'bg-brass' : 'bg-white/40'}`}
                      aria-label={`Obrázek ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-navy hover:bg-white shadow-lg"
            aria-label="Zavřít"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6 18 18" />
            </svg>
          </button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {project.status && (
              <span className={`px-3 py-1 rounded-full text-xs font-body font-semibold border ${statusStyle(project.status)}`}>
                {project.status}
              </span>
            )}
            {project.penb && (
              <span className="bg-navy text-white px-3 py-1 rounded-full text-xs font-body font-bold">PENB: {project.penb}</span>
            )}
            {project.area && (
              <span className="bg-navy/5 text-navy px-3 py-1 rounded-full text-xs font-body font-semibold">{project.area}</span>
            )}
          </div>
          <h3 className="font-heading text-2xl sm:text-3xl font-bold text-navy mb-2">{project.title}</h3>
          {project.location && (
            <div className="flex items-center gap-1.5 mb-4">
              <MapPinIcon size={14} className="text-brass" />
              <span className="font-body text-gray text-sm">{project.location}</span>
            </div>
          )}
          {project.price && (
            <p className="font-heading text-xl text-brass-dark font-bold mb-4">{project.price}</p>
          )}
          {project.description && (
            <p className="font-body text-gray text-sm sm:text-base leading-relaxed mb-6">{project.description}</p>
          )}
          <a
            href="#kontakt"
            onClick={onClose}
            className="inline-flex items-center gap-2 bg-brass text-navy px-6 py-3 rounded-full font-body font-semibold text-sm hover:bg-brass-light transition-colors"
          >
            Mám zájem – kontaktujte mě
          </a>
        </div>
      </div>
    </div>
  );
};

// Contact form – submits to /api/contact (Cloudflare Pages Function + D1)
const ContactForm = () => {
  const [status, setStatus] = useState<{ type: 'idle' | 'sending' | 'ok' | 'error'; message?: string }>({ type: 'idle' });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    setStatus({ type: 'sending', message: 'Odesílám zprávu…' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Zprávu se nepodařilo odeslat.');
      }
      form.reset();
      setStatus({ type: 'ok', message: data.message || 'Děkujeme, zpráva byla odeslána.' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Zprávu se nepodařilo odeslat. Zkuste to prosím znovu nebo nám zavolejte.',
      });
    }
  };

  return (
    <form
      className={`bg-off-white rounded-2xl p-8 border border-gray-light/60 shadow-sm ${
        status.type === 'error' ? 'shake-animation' : ''
      }`}
      onSubmit={handleSubmit}
      noValidate={false}
    >
      <h3 className="font-heading text-2xl font-bold text-navy mb-6">Napište nám</h3>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="font-body text-navy text-sm font-medium mb-2 block">Jméno</label>
            <input
              type="text"
              required
              placeholder="Vaše jméno"
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-light/80 font-body text-sm text-navy placeholder:text-gray/50 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass/20 transition-all"
              name="name"
            />
          </div>
          <div>
            <label className="font-body text-navy text-sm font-medium mb-2 block">E-mail</label>
            <input
              type="email"
              required
              placeholder="vas@email.cz"
              className="w-full px-4 py-3 rounded-xl bg-white border border-gray-light/80 font-body text-sm text-navy placeholder:text-gray/50 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass/20 transition-all"
              name="email"
            />
          </div>
        </div>
        <div>
          <label className="font-body text-navy text-sm font-medium mb-2 block">Telefon (nepovinné)</label>
          <input
            type="tel"
            placeholder="+420 ..."
            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-light/80 font-body text-sm text-navy placeholder:text-gray/50 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass/20 transition-all"
            name="phone"
          />
        </div>
        <div>
          <label className="font-body text-navy text-sm font-medium mb-2 block">Zpráva</label>
          <textarea
            rows={5}
            name="message"
            required
            placeholder="Jak vám můžeme pomoci?"
            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-light/80 font-body text-sm text-navy placeholder:text-gray/50 focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass/20 transition-all resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={status.type === 'sending'}
          className="w-full flex items-center justify-center gap-2 bg-navy text-white py-4 rounded-xl font-body font-semibold text-sm tracking-wide hover:bg-navy-light transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status.type === 'sending' ? 'Odesílám…' : 'Odeslat zprávu'}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
            <path d="m21.854 2.147-10.94 10.939" />
          </svg>
        </button>
        {status.message && status.type !== 'sending' && (
          <p
            role="status"
            className={`font-body text-sm ${
              status.type === 'ok' ? 'text-emerald-700' : status.type === 'error' ? 'text-red-600' : 'text-gray'
            }`}
          >
            {status.message}
          </p>
        )}
        {status.type === 'sending' && (
          <p role="status" className="font-body text-sm text-brass-dark">{status.message}</p>
        )}
      </div>
    </form>
  );
};

const WatchForm = () => {
  const [state, setState] = useState<{ busy?: boolean; message?: string; error?: boolean }>({});
  return <form className="max-w-xl mx-auto flex flex-col sm:flex-row gap-3" onSubmit={async (e) => {
    e.preventDefault(); setState({ busy: true });
    const email = String(new FormData(e.currentTarget).get('email') || '');
    try {
      const response = await fetch('/api/watch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Přihlášení se nepodařilo.');
      e.currentTarget.reset(); setState({ message: data.message }); trackEvent('watch_signup');
    } catch (error) { setState({ error: true, message: error instanceof Error ? error.message : 'Přihlášení se nepodařilo.' }); }
  }}>
    <label className="sr-only" htmlFor="watch-email">E-mail pro upozornění</label>
    <input id="watch-email" name="email" type="email" required placeholder="vas@email.cz" className="flex-1 px-5 py-4 rounded-xl bg-white border border-gray-light text-navy focus:outline-none focus:ring-2 focus:ring-brass"/>
    <button disabled={state.busy} className="bg-brass text-navy font-semibold px-7 py-4 rounded-xl hover:bg-brass-light disabled:opacity-60">{state.busy ? 'Odesílám…' : 'Chci upozornění'}</button>
    {state.message && <p role="status" className={`sm:absolute sm:mt-20 text-sm ${state.error ? 'text-red-300' : 'text-emerald-300'}`}>{state.message}</p>}
  </form>;
};

// Main page component
export default function Home() {
  const { content, loaded } = useSiteContent();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<'current' | 'sold'>('current');
  const [detailProject, setDetailProject] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    trackEvent('page_view');
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a');
      if (anchor?.href.startsWith('tel:')) trackEvent('phone_click');
      if (anchor?.href.startsWith('mailto:')) trackEvent('email_click');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const site = content.siteConfig;
  const hero = content.heroContent;
  const about = content.aboutContent;
  const philosophy = content.philosophyContent;
  const cta = content.ctaContent;
  const gallery = content.galleryContent;
  const contact = content.contactContent;
  const footer = content.footerContent;
  const legal = content.legalInfo;

  const currentProjects: any[] = Array.isArray(content.currentProjects) ? content.currentProjects : [];
  const soldProjects: any[] = Array.isArray(content.soldProjects) ? content.soldProjects : [];
  const visibleProjects = galleryTab === 'current' ? currentProjects : soldProjects;

  // Nastavení animací jednotlivých sekcí (lze vypnout přes content.animations)
  const heroAnim = sectionAnim(content.animations, 'hero');
  const aboutAnim = sectionAnim(content.animations, 'about');
  const philosophyAnim = sectionAnim(content.animations, 'philosophy');
  const galleryAnim = sectionAnim(content.animations, 'gallery');
  const ctaAnim = sectionAnim(content.animations, 'cta');
  const contactAnim = sectionAnim(content.animations, 'contact');

  return (
    <>
      {/* Obsah se vykreslí okamžitě; data z API se doplní bez blokujícího loaderu. */}

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'bg-navy/90 backdrop-blur-md py-3 shadow-lg shadow-black/20' : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
          <a href="#hero" className="flex items-center gap-3 group" tabIndex={0}>
            <div className="relative w-12 h-12 flex items-center justify-center">
              <Image
                src="/logo.svg"
                alt="D&D HOMEINVEST Logo"
                width={48}
                height={48}
                className="opacity-90 group-hover:opacity-100 transition-opacity duration-300"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-heading text-lg font-bold tracking-wide leading-tight">
                {site.companyName}
              </span>
              <span className="text-brass/70 text-[10px] font-body tracking-[0.2em] uppercase">s.r.o.</span>
            </div>
          </a>

          <div className="hidden lg:flex items-center gap-8">
            {[
              { href: '#hero', label: 'Domů' },
              { href: '#o-nas', label: 'O nás' },
              { href: '#filozofie', label: 'Filozofie' },
              { href: '#galerie', label: 'Projekty' },
              { href: '#kontakt', label: 'Kontakt' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                tabIndex={0}
                className="text-white/80 hover:text-brass font-body text-sm font-medium tracking-wide transition-colors duration-300 relative group focus:outline-none focus:ring-2 focus:ring-brass/50 focus:ring-offset-2 focus:ring-offset-navy rounded"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 h-0.5 bg-brass transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </a>
            ))}
            <a
              href={`tel:${site.phone}`}
              className="flex items-center gap-2 bg-brass/10 border border-brass/30 text-brass px-4 py-2 rounded-full text-sm font-medium hover:bg-brass hover:text-navy transition-all duration-300"
              tabIndex={0}
            >
              <PhoneIcon size={14} />
              {site.phone}
            </a>
          </div>

          {/* Mobile hamburger – visible only below lg */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-white p-2 focus:outline-none focus:ring-2 focus:ring-brass/50 rounded"
            aria-label="Otevřít menu"
            aria-expanded={mobileMenuOpen}
            tabIndex={0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16" />
              <path d="M4 12h16" />
              <path d="M4 19h16" />
            </svg>
          </button>
        </div>
      </nav>

      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} phone={site.phone} />

      {/* Main content */}
      <main>
        {/* Hero Section */}
        <section id="hero" className="relative min-h-screen flex items-center justify-center pt-32 pb-24">
          <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/95 to-[#1a1a2e]" />
          <div className="absolute inset-0 overflow-hidden">
            {/* dekorativní tvary – plynulý morph (jen border-radius/transform = GPU) */}
            <div className="absolute top-1/4 right-1/4 w-64 h-64 border border-brass/10 morph-shape" />
            <div className="absolute bottom-1/3 left-1/5 w-96 h-96 border border-brass/5 morph-shape-alt" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brass/5 rounded-full blur-3xl animate-glow-slow" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
            <AnimatedSection {...heroAnim} preset="fadeIn" duration={900}>
              <div className="mb-8 flex justify-center float-slow">
                <Image src="/logo.svg" alt="D&D HOMEINVEST Logo" width={180} height={180} priority />
              </div>
            </AnimatedSection>

            <AnimatedSection delay={100} {...heroAnim}>
              <div className="inline-flex items-center gap-2 bg-brass/10 border border-brass/20 rounded-full px-5 py-2 mb-8">
                <div className="w-2 h-2 bg-brass rounded-full animate-pulse" />
                <span className="text-brass/90 text-sm font-body font-medium tracking-wider uppercase">
                  Rodinná firma z jižních Čech
                </span>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={200} {...heroAnim}>
              <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-8 leading-[1.2] bg-gradient-to-r from-white via-brass to-white bg-clip-text text-transparent shimmer-text">
                {hero.title}
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={300} {...heroAnim}>
              <div
                className="w-24 h-0.5 bg-gradient-to-r from-transparent via-brass to-transparent mx-auto mb-6 animate-grow-x"
                style={{ transformOrigin: 'center' }}
              />
            </AnimatedSection>

            <AnimatedSection delay={400} {...heroAnim}>
              <p className="font-heading text-xl sm:text-2xl md:text-3xl text-white/75 italic mb-4">{hero.subtitle}</p>
            </AnimatedSection>

            <AnimatedSection delay={500} {...heroAnim}>
              <p className="font-body text-base sm:text-lg text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
                {hero.description}
              </p>
            </AnimatedSection>

            <AnimatedSection delay={600} {...heroAnim}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={hero.ctaLink || '#galerie'}
                  className="group flex items-center gap-2 bg-brass text-navy px-8 py-4 rounded-full font-body font-semibold text-sm tracking-wide hover:bg-brass-light transition-all duration-300 relative overflow-hidden"
                  tabIndex={0}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                  <span className="relative z-10">{hero.ctaText}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform relative z-10" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
                <a
                  href={hero.secondaryCtaLink || '#kontakt'}
                  className="group flex items-center gap-2 border border-white/20 text-white/80 px-8 py-4 rounded-full font-body font-medium text-sm tracking-wide hover:border-brass hover:text-brass transition-all duration-300 relative overflow-hidden"
                  tabIndex={0}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brass/10 to-transparent -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                  <span className="relative z-10">{hero.secondaryCtaText}</span>
                </a>
              </div>
            </AnimatedSection>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            <span className="text-white/30 text-xs font-body tracking-widest uppercase">Dolů</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brass/50 animate-bounce" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </div>
        </section>

        {/* Plynulý přechod hero (tmavá) → O nás (světlá) */}
        <SectionDivider from="linear-gradient(90deg,#0a1628 0%,#0f1d31 50%,#1a1a2e 100%)" to="#f8f6f1" />

        {/* About Section */}
        <div className="bg-off-white">
          <section id="o-nas" className="relative py-24 md:py-32 bg-off-white overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
              <AnimatedSection {...aboutAnim}>
                <div className="text-center mb-12 md:mb-16">
                  <span className="font-body text-brass-dark text-sm font-semibold tracking-[0.25em] uppercase">
                    {about.sectionTitle}
                  </span>
                  <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-navy mt-4 mb-6 leading-tight">
                    {about.sectionSubtitle}
                  </h2>
                  <div className="w-16 h-0.5 bg-brass mx-auto mb-8" />
                  <p
                    className="font-body text-gray max-w-2xl mx-auto text-base md:text-lg leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: about.intro }}
                  />
                </div>
              </AnimatedSection>

              <AnimatedSection delay={150} {...aboutAnim}>
                <div className="text-center mb-12 md:mb-16">
                  <p className="font-body text-gray max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
                    {about.teamDescription}
                  </p>
                </div>
              </AnimatedSection>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {content.teamMembers.map((member: any, i: number) => (
                  <TeamMember key={member.name || i} member={member} anim={aboutAnim} staggerIndex={i} />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Přechod O nás (světlá) → Filozofie (tmavá) */}
        <SectionDivider from="#f8f6f1" to="#0a1628" />

        {/* Philosophy Section */}
        <section id="filozofie" className="relative py-24 md:py-32 bg-navy overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(201,168,76,1) 1px, transparent 0)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="absolute top-20 right-10 w-64 h-64 bg-brass/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-48 h-48 bg-brass/5 rounded-full blur-2xl" />

          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <AnimatedSection {...philosophyAnim}>
                  <span className="font-body text-brass text-sm font-semibold tracking-[0.25em] uppercase">
                    {philosophy.sectionTitle}
                  </span>
                  <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white mt-4 mb-8 leading-tight">
                    {philosophy.sectionSubtitle}
                  </h2>
                  <div className="w-16 h-0.5 bg-brass mb-8" />
                </AnimatedSection>
                {philosophy.paragraphs.map((paragraph: string, i: number) => (
                  <AnimatedSection key={i} delay={100 + i * 100} {...philosophyAnim}>
                    <p className="font-body text-white/70 text-sm md:text-base leading-relaxed mb-6">{paragraph}</p>
                  </AnimatedSection>
                ))}
                <AnimatedSection delay={200} {...philosophyAnim}>
                  <div className="mt-8 relative">
                    <div className="absolute -left-2 -top-1 w-1 h-full bg-brass/30 rounded-full" />
                    <div className="pl-6 border-l-4 border-brass/40 bg-white/5 rounded-r-lg p-6 backdrop-blur-sm">
                      <p className="font-heading text-xl md:text-2xl text-white/90 italic leading-relaxed">
                        „Kupujete výsledek práce rodiny, která si za každým detailem stojí svým jménem.&quot;
                      </p>
                    </div>
                  </div>
                </AnimatedSection>
              </div>
              <div>
                <AnimatedSection delay={300} {...philosophyAnim} preset="scaleIn">
                  <div className="grid grid-cols-2 gap-6">
                    {philosophy.highlights.map((highlight: any, i: number) => (
                      <div
                        key={i}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8 text-center hover:border-brass/40 hover:bg-white/[0.07] group relative overflow-hidden card-lift"
                      >
                        <span className="block font-heading text-4xl md:text-5xl font-bold text-brass mb-2 group-hover:text-brass-light transition-colors relative z-10">
                          {highlight.number}
                        </span>
                        <span className="font-body text-white/50 text-sm tracking-wide relative z-10">{highlight.label}</span>
                      </div>
                    ))}
                  </div>
                </AnimatedSection>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy-medium to-navy" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 60px, rgba(201,168,76,1) 60px, rgba(201,168,76,1) 61px)',
            }}
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent" />
          <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
            <AnimatedSection {...ctaAnim}>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                {cta.title} <span className="text-brass italic">{cta.highlight}</span>?
              </h2>
              <p className="font-body text-white/50 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
                {cta.description}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={cta.primaryLink || '#galerie'}
                  className="group relative inline-flex items-center gap-2 bg-brass text-navy px-8 py-4 rounded-full font-body font-semibold text-sm tracking-wide hover:bg-brass-light transition-all duration-300 hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] overflow-hidden"
                  tabIndex={0}
                >
                  <span className="relative z-10">{cta.primaryButton}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform relative z-10" aria-hidden="true">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </a>
                <a
                  href={cta.secondaryLink || '#kontakt'}
                  className="inline-flex items-center gap-2 border border-white/20 text-white/70 px-8 py-4 rounded-full font-body font-medium text-sm tracking-wide hover:border-brass/50 hover:text-brass transition-all duration-300"
                >
                  {cta.secondaryButton}
                </a>
              </div>
            </AnimatedSection>
          </div>
        </section>

        {/* Přechod CTA (tmavá) → Galerie (světlá) */}
        <SectionDivider from="linear-gradient(90deg,#0a1628 0%,#1a2d4a 50%,#0a1628 100%)" to="#f8f6f1" />

        {/* Gallery Section */}
        <section id="galerie" className="relative py-24 md:py-32 bg-off-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
            <AnimatedSection {...galleryAnim}>
              <div className="text-center mb-10">
                <span className="font-body text-brass-dark text-sm font-semibold tracking-[0.25em] uppercase">Galerie</span>
                <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-navy mt-3 mb-6">
                  {gallery.sectionTitle}
                </h2>
                <div className="w-16 h-0.5 bg-brass mx-auto mb-6" />
                <p className="font-body text-gray max-w-2xl mx-auto text-base md:text-lg">{gallery.sectionSubtitle}</p>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={100} {...galleryAnim}>
              <div className="flex justify-center mb-12">
                <div className="inline-flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-light/50">
                  <button
                    onClick={() => setGalleryTab('current')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-body text-sm font-semibold transition-all duration-300 ${
                      galleryTab === 'current' ? 'bg-navy text-white shadow-md' : 'text-navy/50 hover:text-navy'
                    }`}
                    tabIndex={0}
                  >
                    <HouseIcon />
                    {gallery.tabCurrent}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${galleryTab === 'current' ? 'bg-brass text-navy' : 'bg-navy/10 text-navy/60'}`}>
                      {currentProjects.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setGalleryTab('sold')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-body text-sm font-semibold transition-all duration-300 ${
                      galleryTab === 'sold' ? 'bg-navy text-white shadow-md' : 'text-navy/50 hover:text-navy'
                    }`}
                    tabIndex={0}
                  >
                    <HistoryIcon />
                    {gallery.tabSold}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${galleryTab === 'sold' ? 'bg-brass text-navy' : 'bg-navy/10 text-navy/60'}`}>
                      {soldProjects.length}
                    </span>
                  </button>
                </div>
              </div>
            </AnimatedSection>

            {visibleProjects.length === 0 ? (
              <AnimatedSection delay={200} {...galleryAnim}>
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-light/60">
                  <div className="flex justify-center mb-4 text-navy/20">
                    <HouseIcon size={48} />
                  </div>
                  <p className="font-body text-gray">
                    {galleryTab === 'current'
                      ? 'Momentálně připravujeme nové projekty. Sledujte nás!'
                      : 'Historie prodejů se právě plní. První dokončené projekty zde brzy najdete.'}
                  </p>
                </div>
              </AnimatedSection>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                {visibleProjects.map((project: any, i: number) => (
                  <ProjectCard
                    key={project.id ?? i}
                    project={project}
                    anim={galleryAnim}
                    staggerIndex={i}
                    delay={150}
                    onDetail={(selected) => {
                      trackEvent('project_click', String(selected.id || ''));
                      window.location.href = `/projekty/${encodeURIComponent(projectSlug(selected))}/`;
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-navy text-white py-20">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="text-center mb-10"><span className="text-brass text-xs uppercase tracking-[.25em]">Jižní Čechy</span><h2 className="font-heading text-3xl md:text-4xl font-bold mt-3">Mapa našich projektů</h2></div>
            <ProjectMap projects={[...currentProjects, ...soldProjects]} className="h-[460px] rounded-2xl overflow-hidden border border-white/10" />
          </div>
        </section>

        <section className="bg-navy-light text-white pb-24 pt-20">
          <div className="max-w-4xl mx-auto px-6 text-center"><span className="text-brass text-xs uppercase tracking-[.25em]">Hlídací pes</span><h2 className="font-heading text-3xl md:text-4xl font-bold mt-3 mb-4">Nenechte si ujít nový projekt</h2><p className="text-white/60 mb-8">Pošleme vám e-mail při zveřejnění projektu nebo změně jeho ceny či stavu. Odběr nejprve potvrdíte e-mailem a kdykoli jej můžete zrušit.</p><WatchForm /></div>
        </section>

        {/* Přechod Galerie → Kontakt */}
        <SectionDivider from="#152238" to="#ffffff" compact />

        {/* Contact Section */}
        <div className="bg-white">
          <section id="kontakt" className="relative py-24 md:py-32 bg-white overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brass/20 to-transparent" />

            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
              <AnimatedSection {...contactAnim}>
                <div className="text-center mb-16">
                  <span className="font-body text-brass-dark text-sm font-semibold tracking-[0.25em] uppercase">
                    {contact.sectionTitle}
                  </span>
                  <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-navy mt-3 mb-6">
                    {contact.sectionSubtitle}
                  </h2>
                  <div className="w-16 h-0.5 bg-brass mx-auto mb-6" />
                  <p className="font-body text-gray max-w-2xl mx-auto text-base md:text-lg">{contact.description}</p>
                </div>
              </AnimatedSection>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <AnimatedSection delay={100} {...contactAnim} preset="slideInLeft">
                    <div className="space-y-8">
                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                          <PhoneIcon size={22} />
                        </div>
                        <div>
                          <p className="font-body text-gray text-xs tracking-wider uppercase mb-1">Telefon</p>
                          <a href={`tel:${site.phone}`} className="font-body text-navy text-lg font-medium hover:text-brass transition-colors">
                            {site.phone}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                          <MailIcon size={22} />
                        </div>
                        <div>
                          <p className="font-body text-gray text-xs tracking-wider uppercase mb-1">E-mail</p>
                          <a href={`mailto:${site.email}`} className="font-body text-navy text-lg font-medium hover:text-brass transition-colors">
                            {site.email}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                          <MapPinIcon size={22} />
                        </div>
                        <div>
                          <p className="font-body text-gray text-xs tracking-wider uppercase mb-1">Adresa</p>
                          <p className="font-body text-navy text-lg font-medium">{site.address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-5 group">
                        <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-body text-gray text-xs tracking-wider uppercase mb-1">Dostupnost</p>
                          <p className="font-body text-navy text-lg font-medium">Po-Pá: 8:00 - 17:00</p>
                        </div>
                      </div>
                      <div className="mt-8 p-6 bg-off-white rounded-2xl border border-gray-light/50">
                        <p className="font-body text-navy font-semibold mb-2">{site.companyFullName}</p>
                        <p className="font-body text-gray text-sm">IČO: {site.ico}</p>
                      </div>
                    </div>
                  </AnimatedSection>
                </div>
                <div>
                  <AnimatedSection delay={200} {...contactAnim} preset="slideInRight">
                    <ContactForm />
                  </AnimatedSection>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Přechod Kontakt (světlá) → Patička (tmavá) */}
        <SectionDivider from="#ffffff" to="#0a1628" />

        {/* Footer */}
        <footer className="relative bg-navy">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                      <path d="M50 8L85 30V70L50 92L15 70V30L50 8Z" stroke="currentColor" strokeWidth="2" className="text-brass" />
                      <text x="50" y="58" textAnchor="middle" className="text-brass fill-current" style={{ fontSize: '32px', fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>
                        DD
                      </text>
                    </svg>
                  </div>
                  <div>
                    <span className="text-white font-heading text-base font-bold">{site.companyName}</span>
                    <span className="text-brass/50 text-[10px] font-body block tracking-[0.15em] uppercase">s.r.o.</span>
                  </div>
                </div>
                <p className="font-body text-white/40 text-sm leading-relaxed max-w-xs">
                  Rodinná firma z jižních Čech. Vracíme život starým bytům s poctivostí a stylem.
                </p>
              </div>
              <div>
                <h4 className="font-heading text-white text-base font-semibold mb-4">Navigace</h4>
                <div className="flex flex-col gap-3">
                  {footer.links.map((link: any) => (
                    <a key={link.href} href={link.href} className="font-body text-white/40 text-sm hover:text-brass transition-colors duration-300">
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-heading text-white text-base font-semibold mb-4">Kontakt</h4>
                <div className="flex flex-col gap-3 font-body text-white/40 text-sm">
                  <a href={`tel:${site.phone}`} className="hover:text-brass transition-colors">{site.phone}</a>
                  <a href={`mailto:${site.email}`} className="hover:text-brass transition-colors">{site.email}</a>
                  <span>{site.address}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-white/5 mt-12">
              <div className="py-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                  <p className="font-body text-white/30 text-xs">{footer.copyright}</p>
                  <button
                    className="flex items-center gap-2 text-white/30 hover:text-brass text-xs font-body transition-colors"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    Zpět nahoru
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 7-7 7 7" />
                      <path d="M12 19V5" />
                    </svg>
                  </button>
                </div>
                <div className="border-t border-white/5 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-body">
                    <div className="space-y-2">
                      <p className="text-white/40">
                        <span className="font-semibold text-white/60">Společnost:</span> {legal.companyName}
                      </p>
                      <p className="text-white/40">
                        <span className="font-semibold text-white/60">IČO:</span> {legal.ico}
                      </p>
                      <p className="text-white/40">
                        <span className="font-semibold text-white/60">Sídlo:</span> {legal.registeredOffice}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-white/40 leading-relaxed">Zápis v OR: {legal.tradeRegister}</p>
                      <div className="flex flex-wrap gap-4 pt-2">
                        <Link href="/pravni-informace" className="text-white/40 hover:text-brass transition-colors">
                          Právní informace a GDPR
                        </Link>
                        <Link href="/obchodni-podminky" className="text-white/40 hover:text-brass transition-colors">
                          Obchodní podmínky
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>

        {/* Floating contact button */}
        <div className="fixed bottom-6 right-6 z-40">
          <a
            href="#kontakt"
            className="w-14 h-14 bg-brass text-navy rounded-full shadow-xl flex items-center justify-center hover:bg-brass-light transition-colors"
            aria-label="Kontaktujte nás"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
            </svg>
          </a>
        </div>
      </main>

      {detailProject && <ProjectModal project={detailProject} onClose={() => setDetailProject(null)} />}

      {/* Service Worker Registration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
          `,
        }}
      />
    </>
  );
}

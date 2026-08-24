'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Performance-optimized animation hook
const useAnimation = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentElement = elementRef.current;
    if (!currentElement) return;

    // Use Intersection Observer for smooth animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(currentElement);

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [threshold]);

  return { ref: elementRef, isVisible };
};

// Optimized component with reduced motion support
const AnimatedSection = ({ children, className = '', delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const { ref, isVisible } = useAnimation();
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setShouldAnimate(!mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setShouldAnimate(!e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const style = shouldAnimate && isVisible
    ? {
        opacity: 1,
        transform: 'translateY(0)',
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
        willChange: 'opacity, transform',
      }
    : {
        opacity: shouldAnimate ? (isVisible ? 1 : 0) : 1,
        transform: shouldAnimate && !isVisible ? 'translateY(30px)' : 'none',
      };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};

// Mobile menu component
const MobileMenu = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="M6 6 18 18" />
          </svg>
        </button>
        <nav className="flex flex-col items-center gap-8">
          <Link href="#hero" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">
            Domů
          </Link>
          <Link href="#o-nas" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">
            O nás
          </Link>
          <Link href="#filozofie" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">
            Filozofie
          </Link>
          <Link href="#galerie" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">
            Projekty
          </Link>
          <Link href="#kontakt" onClick={onClose} className="text-white text-xl hover:text-brass transition-colors">
            Kontakt
          </Link>
          <Link
            href="tel:+420725591623"
            onClick={onClose}
            className="flex items-center gap-2 bg-brass text-navy px-6 py-3 rounded-full text-lg font-medium hover:bg-brass-light transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
            </svg>
            +420725591623
          </Link>
        </nav>
      </div>
    </div>
  );
};

// Custom cursor component (optimized)
const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Only render on desktop
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(window.innerWidth > 1024);
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isDesktop || !isVisible) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        willChange: 'transform',
      }}
    >
      <div
        className="absolute w-4 h-4 bg-brass rounded-full"
        style={{
          left: position.x - 8,
          top: position.y - 8,
          transform: 'translate(-50%, -50%)',
          transition: 'left 0.1s ease-out, top 0.1s ease-out',
          willChange: 'left, top',
        }}
      />
      <div
        className="absolute w-20 h-20 border border-brass/20 rounded-full"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          transition: 'left 0.2s ease-out, top 0.2s ease-out, transform 0.2s ease-out',
          willChange: 'left, top, transform',
        }}
      />
    </div>
  );
};

// Page loader component
const PageLoader = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-navy flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-brass/20 rounded-full animate-pulse" />
          <div className="relative z-10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-house text-brass"
              aria-hidden="true"
            >
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

// Smooth scroll component
const SmoothScroll = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Use CSS scroll-behavior for better performance
    document.documentElement.classList.add('scroll-smooth');
    return () => {
      document.documentElement.classList.remove('scroll-smooth');
    };
  }, []);

  return <>{children}</>;
};

// Team member component
const TeamMember = ({
  name,
  role,
  description,
  email,
  imageSrc,
  delay = 0,
}: {
  name: string;
  role: string;
  description: string;
  email: string;
  imageSrc: string;
  delay?: number;
}) => (
  <AnimatedSection delay={delay}>
    <div className="group bg-white rounded-2xl p-6 lg:p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-light/50 relative overflow-hidden h-full flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brass via-brass-light to-copper origin-left transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
      <div className="w-40 h-52 mx-auto mb-6 rounded-xl overflow-hidden border-4 border-brass/20 shadow-lg relative">
        <Image
          src={imageSrc}
          alt={name}
          width={160}
          height={208}
          className="object-cover object-top"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="mb-4 text-center px-2">
        <h3 className="font-heading text-2xl font-bold text-navy mb-2">{name}</h3>
        <p className="font-body text-brass text-sm font-semibold tracking-wide uppercase mb-2">{role}</p>
      </div>
      <p className="font-heading text-navy/80 text-lg italic mb-4 text-center px-2">
        {description}
      </p>
      <p className="font-body text-gray text-sm leading-relaxed break-words mb-4 px-2 flex-grow">
        {description}
      </p>
      <div className="flex flex-col gap-3 pt-4 border-t border-gray-light/30 mt-auto">
        <a
          href={`mailto:${email}`}
          className="flex items-center gap-2 text-navy/70 hover:text-brass transition-colors text-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-mail"
            aria-hidden="true"
          >
            <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
            <rect x="2" y="4" width="20" height="16" rx="2" />
          </svg>
          <span className="truncate">{email}</span>
        </a>
      </div>
    </div>
  </AnimatedSection>
);

// Main page component
export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <PageLoader />
      <CustomCursor />
      <SmoothScroll>
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-transparent py-5">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
            <Link href="#hero" className="flex items-center gap-3 group" tabIndex={0}>
              <div className="relative w-12 h-12 flex items-center justify-center">
                <Image
                  src="/logo.svg"
                  alt="D&D HOMEINVEST Logo"
                  width={48}
                  height={48}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-heading text-lg font-bold tracking-wide leading-tight">
                  D&D HOMEINVEST
                </span>
                <span className="text-brass/70 text-[10px] font-body tracking-[0.2em] uppercase">
                  s.r.o.
                </span>
              </div>
            </Link>
            <div className="hidden lg:flex items-center gap-8">
              <Link
                href="#hero"
                tabIndex={0}
                className="text-white/80 hover:text-brass font-body text-sm font-medium tracking-wide transition-colors duration-300 relative group focus:outline-none focus:ring-2 focus:ring-brass/50 focus:ring-offset-2 focus:ring-offset-navy rounded"
              >
                Domů
                <span className="absolute -bottom-1 left-0 h-0.5 bg-brass transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </Link>
              <Link
                href="#o-nas"
                tabIndex={0}
                className="text-white/80 hover:text-brass font-body text-sm font-medium tracking-wide transition-colors duration-300 relative group focus:outline-none focus:ring-2 focus:ring-brass/50 focus:ring-offset-2 focus:ring-offset-navy rounded"
              >
                O nás
                <span className="absolute -bottom-1 left-0 h-0.5 bg-brass transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </Link>
              <Link
                href="#filozofie"
                tabIndex={0}
                className="text-white/80 hover:text-brass font-body text-sm font-medium tracking-wide transition-colors duration-300 relative group focus:outline-none focus:ring-2 focus:ring-brass/50 focus:ring-offset-2 focus:ring-offset-navy rounded"
              >
                Filozofie
                <span className="absolute -bottom-1 left-0 h-0.5 bg-brass transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </Link>
              <Link
                href="#galerie"
                tabIndex={0}
                className="text-white/80 hover:text-brass font-body text-sm font-medium tracking-wide transition-colors duration-300 relative group focus:outline-none focus:ring-2 focus:ring-brass/50 focus:ring-offset-2 focus:ring-offset-navy rounded"
              >
                Projekty
                <span className="absolute -bottom-1 left-0 h-0.5 bg-brass transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </Link>
              <Link
                href="#kontakt"
                tabIndex={0}
                className="text-white/80 hover:text-brass font-body text-sm font-medium tracking-wide transition-colors duration-300 relative group focus:outline-none focus:ring-2 focus:ring-brass/50 focus:ring-offset-2 focus:ring-offset-navy rounded"
              >
                Kontakt
                <span className="absolute -bottom-1 left-0 h-0.5 bg-brass transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </Link>
              <Link
                href="tel:+420725591623"
                className="flex items-center gap-2 bg-brass/10 border border-brass/30 text-brass px-4 py-2 rounded-full text-sm font-medium hover:bg-brass hover:text-navy transition-all duration-300"
                tabIndex={0}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-phone"
                  aria-hidden="true"
                >
                  <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
                </svg>
                +420725591623
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden text-white p-2 focus:outline-none focus:ring-2 focus:ring-brass/50 rounded"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
                tabIndex={0}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-menu"
                  aria-hidden="true"
                >
                  <path d="M4 5h16" />
                  <path d="M4 12h16" />
                  <path d="M4 19h16" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        {/* Main content */}
        <main className="scroll-smooth">
          {/* Hero Section */}
          <section
            id="hero"
            className="relative min-h-[120vh] flex items-center justify-center pt-24 pb-52"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/95 to-[#1a1a2e]" />
            <div className="absolute inset-0 overflow-hidden">
              {/* Decorative elements */}
              <div
                className="absolute top-1/4 right-1/4 w-64 h-64 border border-brass/10 rounded-full morph-shape cursor-pointer"
                style={{
                  willChange: 'border-radius',
                }}
              />
              <div
                className="absolute bottom-1/3 left-1/5 w-96 h-96 border border-brass/5 rounded-full morph-shape-alt cursor-pointer"
                style={{
                  willChange: 'border-radius',
                }}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brass/5 rounded-full blur-3xl" />
              {/* Floating dots */}
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-brass/30"
                  style={{
                    width: `${Math.random() * 3 + 1}px`,
                    height: `${Math.random() * 3 + 1}px`,
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    opacity: Math.random() * 0.3 + 0.1,
                    willChange: 'transform',
                  }}
                />
              ))}
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pb-32">
              <AnimatedSection>
                <div className="mb-8 flex justify-center">
                  <Image
                    src="/logo.svg"
                    alt="D&D HOMEINVEST Logo"
                    width={200}
                    height={200}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  />
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <div className="inline-flex items-center gap-2 bg-brass/10 border border-brass/20 rounded-full px-5 py-2 mb-8">
                  <div className="w-2 h-2 bg-brass rounded-full" />
                  <span className="text-brass/90 text-sm font-body font-medium tracking-wider uppercase">
                    Rodinná firma z jižních Čech
                  </span>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={200}>
                <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-8 leading-[1.2] bg-gradient-to-r from-white via-brass to-white bg-clip-text text-transparent">
                  Rodinné projekty s tradicí a stylem
                </h1>
              </AnimatedSection>

              <AnimatedSection delay={300}>
                <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-brass to-transparent mx-auto mb-6" />
              </AnimatedSection>

              <AnimatedSection delay={400}>
                <p className="font-heading text-xl sm:text-2xl md:text-3xl text-white/70 italic mb-4">
                  Rodinné projekty s tradicí a stylem
                </p>
              </AnimatedSection>

              <AnimatedSection delay={500}>
                <p className="font-body text-base sm:text-lg text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
                  Vracíme život starým bytům. Dáváme jim nový standard, moderní styl a skutečnou duši.
                </p>
              </AnimatedSection>

              <AnimatedSection delay={600}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="#galerie"
                    className="group flex items-center gap-2 bg-brass text-navy px-8 py-4 rounded-full font-body font-semibold text-sm tracking-wide hover:bg-brass-light transition-all duration-300 relative overflow-hidden"
                    tabIndex={0}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                    Naše projekty
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-chevron-right group-hover:translate-x-1 transition-transform relative z-10"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                  <Link
                    href="#kontakt"
                    className="group flex items-center gap-2 border border-white/20 text-white/80 px-8 py-4 rounded-full font-body font-medium text-sm tracking-wide hover:border-brass hover:text-brass transition-all duration-300 relative overflow-hidden"
                    tabIndex={0}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brass/10 to-transparent -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                    <span className="relative z-10">Kontaktujte nás</span>
                  </Link>
                </div>
              </AnimatedSection>
            </div>

            <AnimatedSection delay={800}>
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-40">
                <span className="text-white/30 text-xs font-body tracking-widest uppercase">Dolů</span>
                <div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-arrow-down text-brass/50"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="m19 12-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </AnimatedSection>
          </section>

          {/* Decorative wave */}
          <div className="w-full">
            <svg
              viewBox="0 0 1440 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              preserveAspectRatio="none"
            >
              <path
                d="M0,64L48,58.7C96,53,192,43,288,42.7C384,43,480,53,576,58.7C672,64,768,64,864,58.7C960,53,1056,43,1152,42.7C1248,43,1344,53,1392,58.7L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
                fill="#f8f6f1"
              />
            </svg>
          </div>

          {/* About Section */}
          <div className="bg-off-white">
            <div className="py-16">
              <div className="relative h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent max-w-4xl mx-auto" />
            </div>
            <section
              id="o-nas"
              className="relative py-24 md:py-32 bg-off-white overflow-hidden shadow-xl"
            >
              {/* Background decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brass rounded-bl-full" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-navy rounded-tr-full" />
              <div className="absolute top-1/4 left-10 w-32 h-32 bg-brass rounded-full blur-2xl" />
              <div className="absolute bottom-1/4 right-10 w-40 h-40 bg-navy rounded-full blur-2xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brass rounded-full blur-3xl" />

              <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
                <AnimatedSection>
                  <div className="text-center mb-12 md:mb-16">
                    <span className="font-body text-brass text-sm font-semibold tracking-[0.25em] uppercase">
                      O nás
                    </span>
                    <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-navy mt-4 mb-6 leading-tight">
                      Spojení poctivého řemesla a moderního bydlení
                    </h2>
                    <div className="w-16 h-0.5 bg-brass mx-auto mb-8" />
                    <p className="font-body text-gray max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
                      Značka D&D HOMEINVEST nevznikla přes noc. Je to přirozený vrchol naší rodinné cesty ve
                      stavebnictví. Uvědomili jsme si, že chceme nejen stavět a rekonstruovat, ale tvořit vlastní
                      kompletní domovy od A do Z – bez kompromisů a přesně podle našich nejvyšších standardů. Proto jsme
                      založili D&D HOMEINVEST jako rodinnou značku. Ta se může plně opřít o silné základy naší realizační
                      firmy{' '}
                      <a
                        href="https://vdstavby.cz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brass hover:text-brass-dark underline"
                      >
                        VDStavby
                      </a>
                      , která i nadále úspěšně pokračuje ve své činnosti. Díky našemu stabilnímu týmu prověřených
                      subdodavatelů, se kterými nás pojí letitá partnerství, máme u každého bytu 100% kontrolu nad
                      technickou kvalitou i těmi nejmenšími detaily.
                    </p>
                  </div>
                </AnimatedSection>

                <AnimatedSection delay={200}>
                  <div className="text-center mb-12 md:mb-16">
                    <p className="font-body text-navy/70 max-w-xl mx-auto text-base leading-relaxed">
                      Naše síla spočívá v propojení tří klíčových rolí. Každý projekt prochází rukama naší rodiny od prvního
                      nákresu až po finální předání klíčů:
                    </p>
                  </div>
                </AnimatedSection>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                  <TeamMember
                    name="Stanislav Dvořák"
                    role="Jednatel"
                    description="Stavím na dlouholetých zkušenostech v oboru stavebnictví. Do každého projektu vnáším technické know-how a smysl pro detail. Osobně garantuji, že naše rekonstrukce splňují nejvyšší standardy kvality a poctivého řemesla."
                    email="dvorak@ddhomeinvest.cz"
                    imageSrc="/images/team/whatsapp-image-2026-04-14-at-21-46-59.jpeg"
                  />
                  <TeamMember
                    name="Irena Dvořáková"
                    role="Jednatelka (Manželka)"
                    description="Stará se o to, aby interiéry byly nejen moderní, ale především útulné a funkční. Její cit pro detail a staging mění prázdné místnosti ve skutečné domovy."
                    email="dvorakova@ddhomeinvest.cz"
                    imageSrc="/images/team/mamka.jpeg"
                    delay={100}
                  />
                  <TeamMember
                    name="Jan Minařík"
                    role="Marketing a Media (Syn)"
                    description="Jan vdechuje našim projektům digitální život. Stará se o to, aby krása a kvalita našich realizací byla vidět na první pohled. Má pod palcem kompletní propagaci, správu sociálních sítí a prezentaci našich bytů na realitním trhu."
                    email="minarik@ddhomeinvest.cz"
                    imageSrc="/images/team/ja.jpeg"
                    delay={200}
                  />
                </div>
              </div>
            </section>
            <div className="py-16">
              <div className="relative h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent max-w-4xl mx-auto" />
            </div>
          </div>

          {/* Philosophy Section */}
          <section
            id="filozofie"
            className="relative py-24 md:py-32 bg-navy overflow-hidden shadow-2xl"
          >
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(201,168,76,1) 1px, transparent 0)',
                backgroundSize: '40px 40px',
              }}
            />
            <div className="absolute top-20 right-10 w-64 h-64 bg-brass/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-10 w-48 h-48 bg-brass/5 rounded-full blur-2xl" />
            <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-brass/5 rounded-full blur-xl" />
            <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-brass/10 rounded-full blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brass/3 rounded-full blur-3xl" />

            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <div>
                  <AnimatedSection>
                    <span className="font-body text-brass text-sm font-semibold tracking-[0.25em] uppercase">
                      Naše filozofie
                    </span>
                    <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white mt-4 mb-8 leading-tight">
                      Vlastní realizace, záruka kvality
                    </h2>
                    <div className="w-16 h-0.5 bg-brass mb-8" />
                  </AnimatedSection>
                  <AnimatedSection delay={100}>
                    <p className="font-body text-white/60 text-sm md:text-base leading-relaxed mb-6">
                      Neprodáváme byty v původním stavu ani narychlo opravené. Těžíme z našich kořenů a vlastního
                      realizačního zázemí. Když si kupujete domov od D&D HOMEINVEST, nekupujete jen čtyři stěny od anonymního
                      investora. Kupujete výsledek práce rodiny, která staví na letitých zkušenostech a za každým detailem si
                      stojí svým jménem.
                    </p>
                  </AnimatedSection>
                  <AnimatedSection delay={200}>
                    <div className="mt-8 relative">
                      <div className="absolute -left-2 -top-1 w-1 h-full bg-brass/30 rounded-full" />
                      <div className="pl-6 border-l-4 border-brass/40 bg-white/5 rounded-r-lg p-6 backdrop-blur-sm">
                        <p className="font-heading text-xl md:text-2xl text-white/90 italic leading-relaxed">
                          „Kupujete výsledek práce rodiny, která si za každým detailem stojí svým jménem."
                        </p>
                      </div>
                    </div>
                  </AnimatedSection>
                </div>
                <div>
                  <AnimatedSection delay={300}>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8 text-center hover:border-brass/30 transition-all duration-500 group relative overflow-hidden">
                        <span className="block font-heading text-4xl md:text-5xl font-bold text-brass mb-2 group-hover:text-brass-light transition-colors relative z-10">
                          0
                        </span>
                        <span className="font-body text-white/50 text-sm tracking-wide relative z-10">
                          Dokončených projektů
                        </span>
                      </div>
                      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8 text-center hover:border-brass/30 transition-all duration-500 group relative overflow-hidden">
                        <span className="block font-heading text-4xl md:text-5xl font-bold text-brass mb-2 group-hover:text-brass-light transition-colors relative z-10">
                          20+
                        </span>
                        <span className="font-body text-white/50 text-sm tracking-wide relative z-10">
                          Let zkušeností
                        </span>
                      </div>
                      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8 text-center hover:border-brass/30 transition-all duration-500 group relative overflow-hidden">
                        <span className="block font-heading text-4xl md:text-5xl font-bold text-brass mb-2 group-hover:text-brass-light transition-colors relative z-10">
                          100%
                        </span>
                        <span className="font-body text-white/50 text-sm tracking-wide relative z-10">
                          Rodinná péče
                        </span>
                      </div>
                      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8 text-center hover:border-brass/30 transition-all duration-500 group relative overflow-hidden">
                        <span className="block font-heading text-4xl md:text-5xl font-bold text-brass mb-2 group-hover:text-brass-light transition-colors relative z-10">
                          0
                        </span>
                        <span className="font-body text-white/50 text-sm tracking-wide relative z-10">
                          Kompromisů na kvalitě
                        </span>
                      </div>
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
              <AnimatedSection>
                <div>
                  <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                    Hledáte svůj nový <span className="text-brass italic">domov</span>?
                  </h2>
                  <p className="font-body text-white/50 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
                    Prohlédněte si naše aktuální projekty.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href="#galerie"
                      className="group inline-flex items-center gap-2 bg-brass text-navy px-8 py-4 rounded-full font-body font-semibold text-sm tracking-wide hover:bg-brass-light transition-all duration-300 hover:shadow-[0_0_30px_rgba(201,168,76,0.3)]"
                      tabIndex={0}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                      Prohlédnout projekty
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-arrow-right group-hover:translate-x-1 transition-transform relative z-10"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </Link>
                    <Link
                      href="#kontakt"
                      className="inline-flex items-center gap-2 border border-white/20 text-white/70 px-8 py-4 rounded-full font-body font-medium text-sm tracking-wide hover:border-brass/50 hover:text-brass transition-all duration-300"
                    >
                      Nezávazná konzultace
                    </Link>
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </section>

          {/* Gallery Section */}
          <section
            id="galerie"
            className="relative py-24 md:py-32 bg-off-white overflow-hidden shadow-xl"
          >
            <div className="absolute top-10 right-20 w-48 h-48 bg-brass rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-20 w-40 h-40 bg-navy rounded-full blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brass rounded-full blur-3xl" />

            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
              <AnimatedSection>
                <div className="text-center mb-10">
                  <span className="font-body text-brass text-sm font-semibold tracking-[0.25em] uppercase">
                    Galerie
                  </span>
                  <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-navy mt-3 mb-6">
                    Naše projekty
                  </h2>
                  <div className="w-16 h-0.5 bg-brass mx-auto mb-6" />
                  <p className="font-body text-gray max-w-2xl mx-auto text-base md:text-lg">
                    Prohlédněte si naši aktuální nabídku i historii realizací
                  </p>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={100}>
                <div className="flex justify-center mb-8">
                  <div className="inline-flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-light/50">
                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-body text-sm font-semibold transition-all duration-300 bg-navy text-white shadow-md" tabIndex={0}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-house"
                        aria-hidden="true"
                      >
                        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                        <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                      Aktuální nabídka
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brass text-navy">1</span>
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-body text-sm font-semibold transition-all duration-300 text-navy/50 hover:text-navy" tabIndex={0}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-history"
                        aria-hidden="true"
                      >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M12 7v5l4 2" />
                      </svg>
                      Historie prodejů
                    </button>
                  </div>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={200}>
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                  <button className="font-body text-sm px-5 py-2 rounded-full border transition-all duration-300 bg-navy text-white border-navy" tabIndex={0}>
                    Vše
                  </button>
                </div>
              </AnimatedSection>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <AnimatedSection delay={300}>
                  <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-light/50 relative h-full">
                    <div className="relative h-72 bg-navy/10 overflow-hidden">
                      <Image
                        src="/gallery/aktualni/p-ipravujeme.png"
                        alt="Budoucí byt 2+1"
                        width={600}
                        height={300}
                        className="object-cover w-full h-full"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-body font-semibold border bg-blue-500/20 text-blue-400 border-blue-500/30">
                        Připravujeme
                      </div>
                      <div className="absolute top-4 right-4 bg-brass/90 backdrop-blur-sm text-navy px-3 py-1 rounded-full text-xs font-body font-bold">
                        Na dotaz
                      </div>
                      <div className="absolute bottom-4 left-4 bg-navy/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-body font-bold border border-brass/30">
                        PENB: C
                      </div>
                      <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button className="bg-white/95 backdrop-blur-sm text-navy px-6 py-3 rounded-full font-body text-sm font-semibold flex items-center gap-2 shadow-xl border border-brass/20" tabIndex={0}>
                          Detail
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-arrow-up-right"
                            aria-hidden="true"
                          >
                            <path d="M7 7h10v10" />
                            <path d="M7 17 17 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="p-5 lg:p-6">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading text-base lg:text-lg font-bold text-navy group-hover:text-brass transition-colors leading-snug">
                            Budoucí byt 2+1
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-map-pin text-brass flex-shrink-0"
                              aria-hidden="true"
                            >
                              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span className="font-body text-gray text-sm">Bechyně</span>
                          </div>
                        </div>
                        <span className="font-body text-navy/80 text-xs lg:text-sm font-semibold bg-navy/5 px-3 py-1 rounded-lg whitespace-nowrap flex-shrink-0">
                          67m2
                        </span>
                      </div>
                      <p className="font-body text-gray text-sm leading-relaxed mb-4">V realizaci.</p>
                      <div className="flex flex-wrap gap-2" />
                    </div>
                  </div>
                </AnimatedSection>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <div className="w-full">
            <svg
              viewBox="0 0 1440 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto rotate-180"
              preserveAspectRatio="none"
            >
              <path
                d="M0,64L48,58.7C96,53,192,43,288,42.7C384,43,480,53,576,58.7C672,64,768,64,864,58.7C960,53,1056,43,1152,42.7C1248,43,1344,53,1392,58.7L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
                fill="#f8f6f1"
              />
            </svg>
          </div>
          <div className="bg-off-white">
            <div className="py-16">
              <div className="relative h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent max-w-4xl mx-auto" />
            </div>
            <section
              id="kontakt"
              className="relative py-24 md:py-32 bg-white overflow-hidden shadow-xl"
            >
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brass/20 to-transparent" />
              <div className="absolute top-20 left-20 w-48 h-48 bg-brass rounded-full blur-3xl" />
              <div className="absolute bottom-20 right-20 w-40 h-40 bg-navy rounded-full blur-2xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brass rounded-full blur-3xl" />

              <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
                <AnimatedSection>
                  <div className="text-center mb-16">
                    <span className="font-body text-brass text-sm font-semibold tracking-[0.25em] uppercase">
                      Kontakt
                    </span>
                    <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-navy mt-3 mb-6">
                      Máte zájem? Ozvěte se nám
                    </h2>
                    <div className="w-16 h-0.5 bg-brass mx-auto mb-6" />
                    <p className="font-body text-gray max-w-2xl mx-auto text-base md:text-lg">
                      Rádi vám zodpovíme jakékoliv dotazy ohledně našich projektů.
                    </p>
                  </div>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div>
                    <AnimatedSection delay={100}>
                      <div className="space-y-8">
                        <div className="flex items-start gap-5 group">
                          <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-phone"
                              aria-hidden="true"
                            >
                              <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-body text-gray text-xs tracking-wider uppercase mb-1">Telefon</p>
                            <a href="tel:+420725591623" className="font-body text-navy text-lg font-medium hover:text-brass transition-colors">
                              +420725591623
                            </a>
                          </div>
                        </div>
                        <div className="flex items-start gap-5 group">
                          <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-mail"
                              aria-hidden="true"
                            >
                              <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-body text-gray text-xs tracking-wider uppercase mb-1">E-mail</p>
                            <a href="mailto:info@ddhomeinvest.cz" className="font-body text-navy text-lg font-medium hover:text-brass transition-colors">
                              info@ddhomeinvest.cz
                            </a>
                          </div>
                        </div>
                        <div className="flex items-start gap-5 group">
                          <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-map-pin"
                              aria-hidden="true"
                            >
                              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-body text-gray text-xs tracking-wider uppercase mb-1">Adresa</p>
                            <p className="font-body text-navy text-lg font-medium">Mažice 61, Jižní Čechy</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-5 group">
                          <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center text-brass group-hover:bg-brass/10 transition-colors duration-300 flex-shrink-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-clock"
                              aria-hidden="true"
                            >
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
                          <p className="font-body text-navy font-semibold mb-2">D&D HOMEINVEST s.r.o.</p>
                          <p className="font-body text-gray text-sm">IČO: 29483638</p>
                        </div>
                      </div>
                    </AnimatedSection>
                  </div>
                  <div>
                    <AnimatedSection delay={200}>
                      <form className="bg-off-white rounded-2xl p-8 border border-gray-light/50">
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
                            <label className="font-body text-navy text-sm font-medium mb-2 block">Telefon</label>
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
                            className="w-full flex items-center justify-center gap-2 bg-navy text-white py-4 rounded-xl font-body font-semibold text-sm tracking-wide hover:bg-navy-light transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                            tabIndex={0}
                          >
                            Odeslat zprávu
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="lucide lucide-send"
                              aria-hidden="true"
                            >
                              <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
                              <path d="m21.854 2.147-10.94 10.939" />
                            </svg>
                          </button>
                        </div>
                      </form>
                    </AnimatedSection>
                  </div>
                </div>
              </div>
            </section>
            <div className="py-16">
              <div className="relative h-px bg-gradient-to-r from-transparent via-brass/30 to-transparent max-w-4xl mx-auto" />
            </div>
          </div>

          {/* Footer */}
          <footer className="relative bg-navy border-t border-white/5">
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
                      <span className="text-white font-heading text-base font-bold">D&D HOMEINVEST</span>
                      <span className="text-brass/50 text-[10px] font-body block tracking-[0.15em] uppercase">s.r.o.</span>
                    </div>
                  </div>
                  <p className="font-body text-white/40 text-sm leading-relaxed max-w-xs">
                    Rodinná firma z jižních Čech. Vracíme život starým bytům s poctivostí a stylem.
                  </p>
                </div>
                <div>
                  <h4 className="font-heading text-white text-base font-semibold mb-4">Navigace</h4>
                  <div className="flex flex-col gap-3">
                    <Link href="#o-nas" className="font-body text-white/40 text-sm hover:text-brass transition-colors duration-300">
                      O nás
                    </Link>
                    <Link href="#galerie" className="font-body text-white/40 text-sm hover:text-brass transition-colors duration-300">
                      Projekty
                    </Link>
                    <Link href="#kontakt" className="font-body text-white/40 text-sm hover:text-brass transition-colors duration-300">
                      Kontakt
                    </Link>
                  </div>
                </div>
                <div>
                  <h4 className="font-heading text-white text-base font-semibold mb-4">Kontakt</h4>
                  <div className="flex flex-col gap-3 font-body text-white/40 text-sm">
                    <a href="tel:+420725591623" className="hover:text-brass transition-colors">+420725591623</a>
                    <a href="mailto:info@ddhomeinvest.cz" className="hover:text-brass transition-colors">info@ddhomeinvest.cz</a>
                    <span>Mažice 61, Jižní Čechy</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                    <p className="font-body text-white/30 text-xs">© 2026 D&D HOMEINVEST s.r.o. Všechna práva vyhrazena.</p>
                    <button className="flex items-center gap-2 text-white/30 hover:text-brass text-xs font-body transition-colors" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                      Zpět nahoru
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-arrow-up"
                        aria-hidden="true"
                      >
                        <path d="m5 12 7-7 7 7" />
                        <path d="M12 19V5" />
                      </svg>
                    </button>
                  </div>
                  <div className="border-t border-white/5 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-body">
                      <div className="space-y-2">
                        <p className="text-white/40">
                          <span className="font-semibold text-white/60">Společnost:</span> D&D HOMEINVEST s.r.o.
                        </p>
                        <p className="text-white/40">
                          <span className="font-semibold text-white/60">IČO:</span> 29483638
                        </p>
                        <p className="text-white/40">
                          <span className="font-semibold text-white/60">Sídlo:</span> Mažice 61, Jižní Čechy
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-white/40 leading-relaxed">
                          Zápis v OR: Společnost je zapsaná v obchodním rejstříku vedeném Krajským soudem v Českých Budějovicích,
                          oddíl C, vložka 36554
                        </p>
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
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            <button className="w-14 h-14 bg-brass text-navy rounded-full shadow-xl flex items-center justify-center hover:bg-brass-light transition-colors" aria-label="Menu" aria-expanded={false}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-message-circle"
                aria-hidden="true"
              >
                <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
              </svg>
            </button>
          </div>
        </main>
      </SmoothScroll>

      {/* Service Worker Registration */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then((registration) => {
                  console.log('Service Worker registered: ', registration);
                }).catch((registrationError) => {
                  console.log('Service Worker registration failed: ', registrationError);
                });
              });
            }
            
            // iOS Safari cache buster - force reload on version change
            const currentVersion = document.querySelector('meta[name="ios-cache-buster"]')?.content || 'unknown';
            const storedVersion = localStorage.getItem('dd-homeinvest-version');
            
            if (storedVersion && storedVersion !== currentVersion) {
              console.log('Version changed, forcing reload...');
              localStorage.setItem('dd-homeinvest-version', currentVersion);
              window.location.reload(true);
            } else if (!storedVersion) {
              localStorage.setItem('dd-homeinvest-version', currentVersion);
            }
          `,
        }}
      />
    </>
  );
}

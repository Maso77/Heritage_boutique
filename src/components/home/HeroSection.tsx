import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';
import { whatsappHref } from '../../lib/site-contact';

interface HeroSectionProps {
  navigate: (route: string) => void;
}

type HeroSlide = {
  eyebrow: string;
  title: string;
  description: string;
  desktopImage: string;
  mobileImage: string;
  alt: string;
  hasCollectionCta?: boolean;
  hasWhatsAppCta?: boolean;
};

// Keep the pace deliberate. This can be changed without touching carousel logic.
const HERO_ROTATION_INTERVAL_MS = 10_000;
const INTERACTION_RESUME_DELAY_MS = 4_500;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DESKTOP_HERO_QUERY = '(min-width: 768px)';

const HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: 'HERITAGE • MONTRES ET ACCESSOIRES',
    title: "Portez aujourd'hui ce que vous transmettrez demain.",
    description: 'Une sélection de pièces choisies pour durer.',
    desktopImage: '/assets/hero-carousel/slide-1-desktop.webp',
    mobileImage: '/assets/hero-carousel/slide-1-mobile.webp',
    alt: 'Flacon de parfum doré présenté sur un socle en pierre claire.',
    hasCollectionCta: true,
    hasWhatsAppCta: true,
  },
  {
    eyebrow: 'LE TEMPS, À VOTRE RYTHME',
    title: 'Chaque seconde mérite une présence juste.',
    description: 'Une montre ne marque pas seulement les heures. Elle accompagne les moments qui comptent.',
    desktopImage: '/assets/hero-carousel/slide-2-desktop.webp',
    mobileImage: '/assets/hero-carousel/slide-2-mobile.webp',
    alt: 'Montre à cadran carré noire et or posée sur un socle en pierre.',
  },
  {
    eyebrow: 'LA PRÉCISION DANS LE DÉTAIL',
    title: 'Des matières choisies pour rester belles.',
    description: 'Acier, verre saphir et finitions soignées, pour porter votre pièce avec confiance au quotidien.',
    desktopImage: '/assets/hero-carousel/slide-3-desktop.webp',
    mobileImage: '/assets/hero-carousel/slide-3-mobile.webp',
    alt: 'Homme portant une montre chronographe au poignet.',
  },
  {
    eyebrow: 'UNE PIÈCE QUI DURE',
    title: "L'élégance se reconnaît dans ce qui reste.",
    description: 'Notre sélection réunit des lignes fiables, pensées pour vous suivre aujourd’hui et demain.',
    desktopImage: '/assets/hero-carousel/slide-4-desktop.webp',
    mobileImage: '/assets/hero-carousel/slide-4-mobile.webp',
    alt: 'Coffret et flacon de parfum dorés sur un plateau en marbre.',
  },
  {
    eyebrow: 'LA SÉLECTION HERITAGE',
    title: 'Choisissez la pièce qui vous accompagnera longtemps.',
    description: 'Explorez nos références et échangez avec un conseiller à Abidjan.',
    desktopImage: '/assets/hero-carousel/slide-5-desktop.webp',
    mobileImage: '/assets/hero-carousel/slide-5-mobile.webp',
    alt: 'Femme portant une montre élégante au poignet.',
    hasCollectionCta: true,
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ navigate }) => {
  const { siteSettings } = usePublicContent();
  const whatsappUrl = whatsappHref(
    siteSettings,
    'Bonjour HERITAGE, je souhaite échanger avec un conseiller.',
  );
  const [activeSlide, setActiveSlide] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  const [isDesktopHero, setIsDesktopHero] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(DESKTOP_HERO_QUERY).matches,
  );
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isFocusPaused, setIsFocusPaused] = useState(false);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const resumeTimerRef = useRef<number | null>(null);

  const pauseAfterInteraction = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }

    setIsInteractionPaused(true);
    resumeTimerRef.current = window.setTimeout(() => {
      setIsInteractionPaused(false);
      resumeTimerRef.current = null;
    }, INTERACTION_RESUME_DELAY_MS);
  };

  useEffect(() => {
    const motionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleMotionChange = () => {
      setPrefersReducedMotion(motionMedia.matches);
      if (motionMedia.matches) setActiveSlide(0);
    };

    handleMotionChange();
    motionMedia.addEventListener('change', handleMotionChange);
    return () => motionMedia.removeEventListener('change', handleMotionChange);
  }, []);

  useEffect(() => {
    const desktopMedia = window.matchMedia(DESKTOP_HERO_QUERY);
    const handleViewportChange = () => setIsDesktopHero(desktopMedia.matches);

    handleViewportChange();
    desktopMedia.addEventListener('change', handleViewportChange);
    return () => desktopMedia.removeEventListener('change', handleViewportChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isHoverPaused || isFocusPaused || isInteractionPaused) {
      return undefined;
    }

    const rotationTimer = window.setTimeout(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % HERO_SLIDES.length);
    }, HERO_ROTATION_INTERVAL_MS);

    return () => window.clearTimeout(rotationTimer);
  }, [activeSlide, isFocusPaused, isHoverPaused, isInteractionPaused, prefersReducedMotion]);

  useEffect(() => () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') {
      if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
      setIsInteractionPaused(true);
    }
  };

  const handlePointerRelease = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') pauseAfterInteraction();
  };

  return (
    <section
      className="relative w-full overflow-hidden bg-[#002141]"
      aria-label="Présentation de la Maison HERITAGE"
      aria-roledescription="carrousel"
      onFocusCapture={() => setIsFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFocusPaused(false);
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
    >
      <div className="relative h-[100svh] min-h-[640px] w-full overflow-hidden md:min-h-[640px]">
        <div className="absolute inset-0" aria-hidden="true">
          {HERO_SLIDES.map((slide, index) => (
            <picture
              key={slide.desktopImage}
              className={`absolute inset-0 block h-full w-full transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
                index === activeSlide ? 'z-10 opacity-100' : 'z-0 opacity-0'
              }`}
            >
              <source media="(max-width: 767px)" srcSet={slide.mobileImage} />
              <img
                src={slide.desktopImage}
                alt={slide.alt}
                width={1680}
                height={945}
                className="h-full w-full object-cover"
                style={{ objectPosition: isDesktopHero ? 'center center' : 'center top' }}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
              />
            </picture>
          ))}
          <div className="absolute inset-0 z-20 bg-gradient-to-r from-[#FAF9F7]/85 via-[#FAF9F7]/54 to-[#FAF9F7]/5 md:from-[#FAF9F7]/76 md:via-[#FAF9F7]/38 md:to-transparent" />
        </div>

        <div className="relative z-30 mx-auto h-full w-full max-w-7xl px-4 sm:px-6 md:px-8 lg:px-10">
          {HERO_SLIDES.map((slide, index) => (
            <div
              key={slide.title}
              id={`hero-slide-${index + 1}`}
              aria-hidden={index !== activeSlide}
              inert={index !== activeSlide ? true : undefined}
              style={{
                top: isDesktopHero ? '50%' : '7rem',
                transform: isDesktopHero
                  ? `translateY(${index === activeSlide ? '-50%' : '-46%'})`
                  : `translateY(${index === activeSlide ? '0' : '0.75rem'})`,
              }}
              className={`absolute left-4 right-4 top-20 transition-[opacity,transform] duration-1000 ease-in-out motion-reduce:transition-none sm:left-6 sm:right-6 md:left-8 md:right-auto md:w-[min(41rem,52vw)] lg:left-10 ${
                index === activeSlide
                  ? 'opacity-100'
                  : 'pointer-events-none opacity-0'
              }`}
            >
              <div
                className="max-w-xl rounded-sm bg-[#FAF9F7]/78 p-4 text-left shadow-[0_16px_44px_rgba(0,33,65,0.14)] backdrop-blur-[1px] sm:p-5 md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
                onMouseEnter={() => setIsHoverPaused(true)}
                onMouseLeave={() => setIsHoverPaused(false)}
              >
                <div className="mb-3 inline-flex items-center gap-2 md:mb-4">
                  <span className="h-[1.5px] w-6 bg-[#8B642A]" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#704E1D] sm:text-[10px] md:text-xs">
                    {slide.eyebrow}
                  </span>
                </div>

                {index === 0 ? (
                  <h1 className="font-playfair mb-4 text-[clamp(2rem,8.4vw,2.45rem)] font-bold leading-[1.05] tracking-tight text-[#002141] [text-shadow:0_1px_0_rgba(250,249,247,0.72)] sm:text-4xl md:mb-5 md:text-5xl md:leading-[1.12] lg:text-[54px]">
                    {slide.title}
                  </h1>
                ) : (
                  <h2 className="font-playfair mb-4 text-[clamp(2rem,8.4vw,2.45rem)] font-bold leading-[1.05] tracking-tight text-[#002141] [text-shadow:0_1px_0_rgba(250,249,247,0.72)] sm:text-4xl md:mb-5 md:text-5xl md:leading-[1.12] lg:text-[54px]">
                    {slide.title}
                  </h2>
                )}

                <p className="mb-5 max-w-lg text-[15px] font-medium leading-relaxed text-[#002141] sm:text-base md:mb-8 md:text-lg">
                  {slide.description}
                </p>

                {(slide.hasCollectionCta || slide.hasWhatsAppCta) && (
                  <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    {slide.hasCollectionCta && (
                      <button
                        type="button"
                        onClick={() => navigate('/montres')}
                        className="premium-cta group flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 bg-[#AC854B] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#FAF9F7] shadow-lg transition-colors hover:bg-[#96723c] sm:w-auto sm:px-6 sm:text-xs sm:tracking-[0.18em] md:px-8"
                      >
                        <span>{index === 0 ? 'DÉCOUVRIR LES MONTRES' : 'VOIR LA SÉLECTION'}</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </button>
                    )}

                    {slide.hasWhatsAppCta && whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="premium-cta flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 border border-[#002141]/25 bg-[#FAF9F7]/95 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.13em] text-[#002141] shadow-sm transition-colors hover:bg-[#F2EEE7] sm:w-auto sm:px-6 sm:text-xs sm:tracking-[0.15em] md:px-8"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0 text-[#D6BB8F]" aria-hidden="true" />
                        <span>ÉCHANGER AVEC UN CONSEILLER</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Diapositive {activeSlide + 1} sur {HERO_SLIDES.length}. {HERO_SLIDES[activeSlide].title}
        </p>
      </div>
    </section>
  );
};

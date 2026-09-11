import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';

interface HeroSectionProps {
  navigate: (route: string) => void;
}

interface HeroCopyBand {
  eyebrow: string;
  title: string;
  description: string;
  start: number;
  end: number;
  isOpening?: boolean;
  isClosing?: boolean;
}

const MOBILE_VIDEO_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const HERO_COPY_BANDS: HeroCopyBand[] = [
  {
    eyebrow: 'HERITAGE · MONTRES ET ACCESSOIRES',
    title: 'Portez aujourd’hui ce que vous transmettrez demain.',
    description: 'Une sélection de pièces choisies à Abidjan pour durer.',
    start: 0,
    end: 0.24,
    isOpening: true,
  },
  {
    eyebrow: 'LE TEMPS, À VOTRE RYTHME',
    title: 'Chaque seconde mérite une présence juste.',
    description: 'Une montre ne marque pas seulement les heures. Elle accompagne les moments qui comptent.',
    start: 0.2,
    end: 0.44,
  },
  {
    eyebrow: 'LA PRÉCISION DANS LE DÉTAIL',
    title: 'Des matières choisies pour rester belles.',
    description: 'Acier, verre saphir et finitions soignées, pour porter votre pièce avec confiance au quotidien.',
    start: 0.4,
    end: 0.64,
  },
  {
    eyebrow: 'UNE PIÈCE QUI DURE',
    title: 'L’élégance se reconnaît dans ce qui reste.',
    description: 'Notre sélection réunit des lignes fiables, pensées pour vous suivre aujourd’hui et demain.',
    start: 0.6,
    end: 0.84,
  },
  {
    eyebrow: 'LA SÉLECTION HERITAGE',
    title: 'Choisissez la pièce qui vous accompagnera longtemps.',
    description: 'Explorez nos références et échangez avec un conseiller à Abidjan.',
    start: 0.8,
    end: 1,
    isClosing: true,
  },
];

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const smoothstep = (value: number, start: number, end: number) => {
  const progress = clamp((value - start) / (end - start), 0, 1);
  return progress * progress * (3 - 2 * progress);
};

export const HeroSection: React.FC<HeroSectionProps> = ({ navigate }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const desktopVideoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const mediaLayerRef = useRef<HTMLDivElement>(null);
  const copyBandRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isPlayingRef = useRef(true);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) window.dispatchEvent(new Event('scroll'));
  }, [isPlaying]);

  useEffect(() => {
    const mobileMedia = window.matchMedia(MOBILE_VIDEO_QUERY);
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const desktopVideo = desktopVideoRef.current;
    const mobileVideo = mobileVideoRef.current;

    if (!desktopVideo || !mobileVideo) return;

    let activeVideo: HTMLVideoElement | null = null;
    let objectUrl = '';
    let loadController: AbortController | null = null;
    let targetProgress = 0;
    let displayedProgress = 0;
    let rafId: number | null = null;
    let lastTick = 0;
    let seekBusy = false;
    let pendingTime: number | null = null;

    const getHeroProgress = () => {
      const hero = heroRef.current;
      if (!hero) return 0;

      const heroTop = window.scrollY + hero.getBoundingClientRect().top;
      const scrollableDistance = Math.max(hero.offsetHeight - window.innerHeight, 1);
      return clamp((window.scrollY - heroTop) / scrollableDistance, 0, 1);
    };

    const updateCopyBands = (progress: number) => {
      const mediaLayer = mediaLayerRef.current;
      if (mediaLayer) {
        const mobileScale = mobileMedia.matches ? 1.6 : 1.04;
        const scale = mobileScale + progress * 0.035;
        const translateY = (mobileMedia.matches ? -4.5 : -2.5) * progress;
        const nextTransform = `translate3d(0, ${translateY.toFixed(2)}%, 0) scale(${scale.toFixed(3)})`;
        if (mediaLayer.style.transform !== nextTransform) mediaLayer.style.transform = nextTransform;
      }

      HERO_COPY_BANDS.forEach((band, index) => {
        const element = copyBandRefs.current[index];
        if (!element) return;

        const fadeLength = Math.min(0.035, (band.end - band.start) / 3);
        const fadeIn = band.isOpening ? 1 : smoothstep(progress, band.start, band.start + fadeLength);
        const fadeOut = band.isClosing ? 1 : 1 - smoothstep(progress, band.end - fadeLength, band.end);
        const opacity = fadeIn * fadeOut;
        const bandProgress = clamp((progress - band.start) / (band.end - band.start), 0, 1);
        const entryOffset = band.isOpening ? 14 : 86;
        const travelDistance = band.isOpening ? 112 : 174;
        const translateY = entryOffset - bandProgress * travelDistance;
        const scale = 1 - bandProgress * 0.025;

        const nextOpacity = opacity.toFixed(3);
        const nextTransform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
        if (element.style.opacity !== nextOpacity) element.style.opacity = nextOpacity;
        if (element.style.transform !== nextTransform) element.style.transform = nextTransform;
        element.style.pointerEvents = opacity > 0.45 ? 'auto' : 'none';
      });
    };

    const requestSeek = (time: number) => {
      const video = activeVideo;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

      const nextTime = clamp(time, 0, video.duration);
      if (Math.abs(video.currentTime - nextTime) < 0.01) return;

      if (seekBusy) {
        pendingTime = nextTime;
        return;
      }

      seekBusy = true;
      video.currentTime = nextTime;
    };

    const tick = (now: number) => {
      if (reducedMotionMedia.matches || !isPlayingRef.current) {
        rafId = null;
        lastTick = 0;
        return;
      }

      const delta = Math.min(100, now - (lastTick || now));
      lastTick = now;
      const smoothing = 0.16;
      displayedProgress +=
        (targetProgress - displayedProgress) *
        (1 - Math.pow(1 - smoothing, delta / 16.667));

      if (Math.abs(targetProgress - displayedProgress) < 0.0005) {
        displayedProgress = targetProgress;
        rafId = null;
        lastTick = 0;
      } else {
        rafId = window.requestAnimationFrame(tick);
      }

      updateCopyBands(displayedProgress);
      requestSeek(displayedProgress * (activeVideo?.duration || 0));
    };

    const updateFromScroll = () => {
      targetProgress = getHeroProgress();
      if (reducedMotionMedia.matches) {
        updateCopyBands(0);
        return;
      }

      if (isPlayingRef.current && rafId === null) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const clearActiveVideo = () => {
      loadController?.abort();
      loadController = null;

      if (activeVideo) {
        activeVideo.pause();
        activeVideo.removeAttribute('src');
        activeVideo.load();
      }

      if (objectUrl) URL.revokeObjectURL(objectUrl);

      activeVideo = null;
      objectUrl = '';
      seekBusy = false;
      pendingTime = null;
      setIsVideoReady(false);
    };

    const loadActiveVideo = async () => {
      clearActiveVideo();
      if (reducedMotionMedia.matches) return;

      const useMobileVideo = mobileMedia.matches;
      const video = useMobileVideo ? mobileVideo : desktopVideo;
      const source = useMobileVideo
        ? '/assets/hero-mobile-scroll.mp4'
        : '/assets/hero-desktop-scroll.mp4';

      activeVideo = video;
      const controller = new AbortController();
      loadController = controller;

      try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error('La vidéo du hero est indisponible.');

        const blob = await response.blob();
        if (controller.signal.aborted || activeVideo !== video) return;

        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        video.load();
      } catch {
        if (!controller.signal.aborted) setIsVideoReady(false);
      }
    };

    const handleCanPlay = (event: Event) => {
      if (event.currentTarget !== activeVideo || !activeVideo) return;

      targetProgress = getHeroProgress();
      displayedProgress = targetProgress;
      updateCopyBands(displayedProgress);
      requestSeek(targetProgress * activeVideo.duration);
      setIsVideoReady(true);
      updateFromScroll();
    };

    const handleSeeked = (event: Event) => {
      if (event.currentTarget !== activeVideo) return;

      seekBusy = false;
      if (pendingTime !== null) {
        const nextTime = pendingTime;
        pendingTime = null;
        requestSeek(nextTime);
      }
    };

    const handleVideoError = (event: Event) => {
      if (event.currentTarget !== activeVideo) return;
      seekBusy = false;
      pendingTime = null;
      setIsVideoReady(false);
    };

    const applyVideoMode = () => {
      setPrefersReducedMotion(reducedMotionMedia.matches);
      void loadActiveVideo();
      updateFromScroll();
    };

    [desktopVideo, mobileVideo].forEach((video) => {
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('error', handleVideoError);
    });

    window.addEventListener('scroll', updateFromScroll, { passive: true });
    mobileMedia.addEventListener('change', applyVideoMode);
    reducedMotionMedia.addEventListener('change', applyVideoMode);
    applyVideoMode();

    return () => {
      window.removeEventListener('scroll', updateFromScroll);
      mobileMedia.removeEventListener('change', applyVideoMode);
      reducedMotionMedia.removeEventListener('change', applyVideoMode);
      [desktopVideo, mobileVideo].forEach((video) => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleVideoError);
      });
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      clearActiveVideo();
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="hero-scroll-journey relative w-full bg-[#002141]"
      aria-label="Présentation de la Maison HERITAGE"
    >
      <div className="sticky top-0 flex h-[100svh] min-h-[600px] w-full items-center overflow-hidden">
        <div className="absolute inset-0 h-full w-full" aria-hidden="true">
          <div ref={mediaLayerRef} className="hero-scroll-media absolute inset-0 h-full w-full">
            <picture className="absolute inset-0 block h-full w-full">
              <source media="(max-width: 767px)" srcSet="/assets/hero-mobile-poster.jpg" />
              <img
                src="/assets/hero-desktop-poster.jpg"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-right md:object-[75%_center]"
                loading="eager"
                fetchPriority="high"
              />
            </picture>

            <video
              ref={desktopVideoRef}
              className={`absolute inset-0 hidden h-full w-full object-cover object-right transition-opacity duration-500 md:block md:object-[75%_center] ${
                isVideoReady ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ transform: 'translateZ(0)', willChange: 'opacity, transform' }}
              muted
              playsInline
              preload="none"
              aria-hidden="true"
              tabIndex={-1}
            />

            <video
              ref={mobileVideoRef}
              className={`absolute inset-0 block h-full w-full object-cover transition-opacity duration-500 md:hidden ${
                isVideoReady ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ transform: 'translateZ(0)', willChange: 'opacity, transform' }}
              muted
              playsInline
              preload="none"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-[#002141]/95 via-[#002141]/75 to-transparent md:w-[65%]" />
          <div className="hero-scroll-mobile-scrim absolute inset-0 md:hidden" />
        </div>

        <div className="hero-copy-stage relative z-10 mx-auto h-full w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {HERO_COPY_BANDS.map((band, index) => (
            <div
              key={band.title}
              data-hero-copy-band={index}
              ref={(element) => {
                copyBandRefs.current[index] = element;
              }}
              className="hero-copy-band absolute inset-0 flex items-end pb-20 md:items-center md:pb-0"
              style={{
                opacity: index === 0 ? 1 : 0,
                transform: 'translate3d(0, 86px, 0) scale(1)',
              }}
            >
              <div className="hero-copy-content max-w-2xl text-left">
                <div className="hero-eyebrow mb-4 inline-flex items-center gap-2">
                  <span className="h-[1.5px] w-6 bg-[#D6BB8F]" />
                  <span className="hero-eyebrow-text text-[10px] font-bold uppercase tracking-[0.25em] text-[#D6BB8F] sm:text-xs">
                    {band.eyebrow}
                  </span>
                </div>

                {band.isOpening ? (
                  <h1 className="hero-copy-heading font-playfair mb-5 text-3xl font-bold leading-[1.18] tracking-tight text-[#FAF9F7] sm:text-4xl md:text-5xl lg:text-[54px]">
                    {band.title}
                  </h1>
                ) : (
                  <h2 className="hero-copy-heading font-playfair mb-5 text-3xl font-bold leading-[1.18] tracking-tight text-[#FAF9F7] sm:text-4xl md:text-5xl lg:text-[54px]">
                    {band.title}
                  </h2>
                )}

                <p className="hero-copy-description mb-8 max-w-lg text-base font-normal leading-relaxed text-[#FAF9F7]/90 sm:text-lg">
                  {band.description}
                </p>

                {band.isOpening && (
                  <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      id="hero-primary-cta"
                      onClick={() => navigate('/montres')}
                      className="premium-cta group flex cursor-pointer items-center justify-center gap-3 bg-[#AC854B] px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[#FAF9F7] shadow-lg hover:bg-[#96723c]"
                    >
                      <span>DÉCOUVRIR LES MONTRES</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>

                    <a
                      href="https://wa.me/2250707181560?text=Bonjour%20HERITAGE%2C%20je%20souhaite%20un%20conseil%20au%20sujet%20de%20votre%20s%C3%A9lection%20de%20montres."
                      target="_blank"
                      rel="noopener noreferrer"
                      id="hero-secondary-cta"
                      className="premium-cta flex cursor-pointer items-center justify-center gap-3 border border-[#FAF9F7]/30 bg-transparent px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[#FAF9F7] hover:bg-[#FAF9F7]/10"
                    >
                      <MessageCircle className="h-4 w-4 text-[#D6BB8F]" />
                      <span>ÉCHANGER AVEC UN CONSEILLER</span>
                    </a>
                  </div>
                )}

                {band.isClosing && (
                  <button
                    type="button"
                    onClick={() => navigate('/montres')}
                    className="premium-cta group flex cursor-pointer items-center justify-center gap-3 bg-[#AC854B] px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[#FAF9F7] shadow-lg hover:bg-[#96723c] sm:inline-flex"
                  >
                    <span>VOIR LA SÉLECTION</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Eye, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { usePublicContent, xof as formatXOF } from '../../lib/public-content';
import { useStore } from '../../context/StoreContext';

interface SignaturePiecesSectionProps {
  navigate: (route: string) => void;
}

interface SignatureItem {
  id: string;
  title: string;
  subTitle: string;
  specs: string;
  priceXOF: number;
  image: string;
  slug: string;
  badge?: string;
}

export const SignaturePiecesSection: React.FC<SignaturePiecesSectionProps> = ({ navigate }) => {
  const { isInWishlist, toggleWishlist } = useStore();
  const { products } = usePublicContent();
  const SIGNATURE_ITEMS = useMemo<SignatureItem[]>(() => products
    .filter((product) => product.category === 'montres')
    .slice(0, 6)
    .map((product) => ({
      id: product.id,
      title: product.name,
      subTitle: product.brand,
      specs: product.shortDescription,
      priceXOF: product.priceXOF,
      image: product.primaryImage,
      slug: product.slug,
      badge: product.attributes?.mouvement || undefined
    })), [products]);
  const REPEAT_COUNT = 9;
  const BASE_COUNT = Math.max(SIGNATURE_ITEMS.length, 1);
  const CENTER_CYCLE = Math.floor(REPEAT_COUNT / 2);
  const INITIAL_INDEX = CENTER_CYCLE * BASE_COUNT;
  const EXTENDED_ITEMS = useMemo(() => {
    const items: { item: SignatureItem; originalIndex: number; uniqueKey: string }[] = [];
    for (let repeat = 0; repeat < REPEAT_COUNT; repeat += 1) {
      SIGNATURE_ITEMS.forEach((item, index) => items.push({ item, originalIndex: index, uniqueKey: `${item.id}-repeat-${repeat}` }));
    }
    return items;
  }, [SIGNATURE_ITEMS]);
  const [activeIndex, setActiveIndex] = useState(INITIAL_INDEX);
  const [withAnimation, setWithAnimation] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.min(1024, window.innerWidth);
    }
    return 375;
  });

  useEffect(() => {
    setActiveIndex(INITIAL_INDEX);
  }, [INITIAL_INDEX]);

  // ResizeObserver to calculate dynamic track dimensions
  useEffect(() => {
    if (!trackRef.current) return;
    const updateSize = () => {
      if (trackRef.current) {
        setTrackWidth(trackRef.current.clientWidth);
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, []);

  // When animation completes, silently re-center activeIndex to the middle cycle
  // This allows truly infinite looping in both directions without any visual jump
  const handleAnimationComplete = () => {
    if (!withAnimation) return;
    setIsDragging(false);
    const currentMod = ((activeIndex % BASE_COUNT) + BASE_COUNT) % BASE_COUNT;
    const normalizedIndex = CENTER_CYCLE * BASE_COUNT + currentMod;
    if (activeIndex !== normalizedIndex) {
      setWithAnimation(false);
      setActiveIndex(normalizedIndex);
    }
  };

  // Re-enable smooth transitions on the very next animation frame after silent reset
  useEffect(() => {
    if (!withAnimation) {
      const raf = requestAnimationFrame(() => {
        setWithAnimation(true);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [withAnimation]);

  // Responsive item sizing & spacing for centered 3-card layout
  const isMobile = trackWidth < 640;
  const isTablet = trackWidth >= 640 && trackWidth < 1024;
  const isDesktop = trackWidth >= 1024;

  const gap = isMobile ? 12 : isTablet ? 20 : 28;

  // Compute cardWidth so 3 cards fit comfortably within the centered stage
  const rawCardWidth = Math.floor((trackWidth - 2 * gap) / 3);
  const cardWidth = isMobile
    ? Math.min(230, Math.max(170, Math.floor(trackWidth * 0.58)))
    : isTablet
    ? Math.min(280, Math.max(210, rawCardWidth))
    : Math.min(340, Math.max(260, rawCardWidth));

  const step = cardWidth + gap;

  // Formula to perfectly center activeIndex card in the exact middle of the section/track
  const targetX = trackWidth / 2 - cardWidth / 2 - activeIndex * step;

  // Infinite next / prev without limits in either direction
  const handlePrev = () => {
    setActiveIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    setActiveIndex((prev) => prev + 1);
  };

  const handleDragEnd = (offsetX: number, velocityX: number) => {
    const dragThreshold = Math.max(24, step * 0.12);
    const velocityThreshold = 220;

    if (Math.abs(offsetX) < dragThreshold && Math.abs(velocityX) < velocityThreshold) {
      return;
    }

    // A deliberate long pull can advance several cards, while a short flick
    // still moves exactly one card. The cap keeps the infinite-track reset
    // comfortably outside the visible stage.
    const gestureDistance = Math.max(Math.abs(offsetX), Math.abs(velocityX) * 0.16);
    const stepsToMove = Math.min(3, Math.max(1, Math.round(gestureDistance / step)));
    setActiveIndex((prev) => prev + (offsetX < 0 || velocityX < 0 ? stepsToMove : -stepsToMove));
  };

  // Shortest path cyclic navigation for dot indicators
  const handleDotClick = (targetOriginalIndex: number) => {
    const currentOriginalIndex = ((activeIndex % BASE_COUNT) + BASE_COUNT) % BASE_COUNT;
    let diff = targetOriginalIndex - currentOriginalIndex;
    if (diff > BASE_COUNT / 2) {
      diff -= BASE_COUNT;
    } else if (diff < -BASE_COUNT / 2) {
      diff += BASE_COUNT;
    }
    setActiveIndex((prev) => prev + diff);
  };

  const realActiveOriginalIndex = ((activeIndex % BASE_COUNT) + BASE_COUNT) % BASE_COUNT;

  if (!SIGNATURE_ITEMS.length) return null;

  return (
    <section className="pt-12 pb-20 md:pt-24 md:pb-32 bg-[#FAF9F7] border-b border-[#002141]/10 overflow-hidden select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with elegant French typography */}
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-14">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] sm:tracking-[0.28em] text-[#AC854B] block mb-2 sm:mb-3">
            HERITAGE ABIDJAN &middot; SÉLECTION MAISON
          </span>
          <h2 className="font-playfair text-2xl sm:text-4xl md:text-5xl font-bold text-[#002141] tracking-tight mb-2 sm:mb-4">
            Explorez Nos Pièces Signatures
          </h2>
          <p className="text-xs sm:text-base text-[#4A4A4A] leading-relaxed max-w-2xl mx-auto px-2 sm:px-0">
            De l'aube au crépuscule, nos garde-temps vous accompagnent à chaque instant : symboles d'assurance, de précision et de distinction.
          </p>
        </div>

        {/* Carousel Container - Centered 3-card stage */}
        <div className="relative w-full max-w-5xl mx-auto px-1 sm:px-4">
          {/* Navigation Arrows */}
          <button
            type="button"
            id="signature-slider-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Pièce précédente"
            className="absolute left-0 sm:-left-3 md:-left-6 top-[36%] sm:top-[38%] -translate-y-1/2 z-40 w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-white/95 border border-[#002141]/15 text-[#002141] hover:bg-[#002141] hover:text-white shadow-xl flex items-center justify-center transition-all duration-200 cursor-pointer group focus:outline-hidden active:scale-95 hover:scale-105"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <button
            type="button"
            id="signature-slider-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Pièce suivante"
            className="absolute right-0 sm:-right-3 md:-right-6 top-[36%] sm:top-[38%] -translate-y-1/2 z-40 w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-white/95 border border-[#002141]/15 text-[#002141] hover:bg-[#002141] hover:text-white shadow-xl flex items-center justify-center transition-all duration-200 cursor-pointer group focus:outline-hidden active:scale-95 hover:scale-105"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Fluid Sliding Track - Expanded vertical height */}
          <div ref={trackRef} className="overflow-hidden py-6 sm:py-12 touch-pan-y">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(_, info) => {
                handleDragEnd(info.offset.x, info.velocity.x);
              }}
              animate={{ x: targetX }}
              onAnimationComplete={handleAnimationComplete}
              transition={
                withAnimation
                  ? {
                      type: 'spring',
                      stiffness: 240,
                      damping: 26,
                      mass: 0.75
                    }
                  : { duration: 0 }
              }
              className="flex items-center cursor-grab active:cursor-grabbing"
              style={{ gap: `${gap}px` }}
            >
              {EXTENDED_ITEMS.map(({ item, uniqueKey }, index) => {
                const distance = Math.abs(index - activeIndex);
                const isCenter = index === activeIndex;

                // While dragging, the full repeated track is available behind the
                // three-card stage, so a long pull never exposes an empty gap.
                // Once it settles, the composition returns to its intended focus.
                const scaleVal = isCenter
                  ? isDesktop ? 1.12 : isTablet ? 1.08 : 1.05
                  : distance === 1 || isDragging
                    ? isDesktop ? 0.92 : isTablet ? 0.90 : 0.88
                    : 0.60;
                const opacityVal = distance <= 1 || isDragging ? 1 : 0;

                return (
                  <motion.div
                    key={uniqueKey}
                    onClick={() => {
                      if (!isCenter) {
                        setActiveIndex(index);
                      }
                    }}
                    animate={{
                      scale: scaleVal,
                      opacity: opacityVal,
                      pointerEvents: opacityVal > 0.1 ? 'auto' : 'none'
                    }}
                    transition={
                      withAnimation
                        ? {
                            duration: isDragging ? 0.12 : 0.4,
                            ease: [0.22, 1, 0.36, 1]
                          }
                        : { duration: 0 }
                    }
                    className="shrink-0 flex flex-col items-center text-center cursor-pointer select-none transition-all"
                    style={{
                      width: `${cardWidth}px`,
                      zIndex: isCenter ? 30 : distance === 1 ? 10 : 0
                    }}
                  >
                    {/* Square Framed Box matching the reference design */}
                    <div
                      className={`premium-section-card w-full bg-white rounded-none border p-2.5 sm:p-6 flex items-center justify-center relative overflow-hidden transition-all duration-300 ${
                        isCenter
                          ? 'border-[#AC854B] shadow-2xl ring-1 ring-[#AC854B]/60'
                          : 'border-[#002141]/10 shadow-sm hover:border-[#002141]/30 hover:shadow-md'
                      }`}
                      style={{ aspectRatio: '1 / 1.02' }}
                    >
                      {/* Wishlist Button */}
                      {(() => {
                        const product = products.find((p) => p.id === item.id || p.slug === item.slug);
                        const isFav = product ? isInWishlist(product.id) : false;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (product) toggleWishlist(product);
                            }}
                            aria-label={
                              isFav
                                ? `Retirer ${item.title} de la liste d'envies`
                                : `Ajouter ${item.title} à la liste d'envies`
                            }
                            className={`absolute top-2 left-2 sm:top-3 sm:left-3 p-1 sm:p-1.5 rounded-full border shadow-xs transition-colors cursor-pointer z-20 ${
                              isFav
                                ? 'bg-white text-[#AC854B] border-[#AC854B]/40 scale-105'
                                : 'bg-white/85 hover:bg-white text-[#002141]/60 hover:text-[#AC854B] border-[#002141]/10'
                            }`}
                          >
                            <Heart className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isFav ? 'fill-[#AC854B] text-[#AC854B]' : ''}`} />
                          </button>
                        );
                      })()}

                      {/* Center Item Badge */}
                      {isCenter && item.badge && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-[#002141] text-[#FAF9F7] text-[7px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest px-1.5 py-0.5 sm:px-2.5 sm:py-1 z-10 shadow-xs">
                          {item.badge}
                        </div>
                      )}

                      {/* Watch Image with Dynamic Zoom on Center */}
                      <div className="relative w-full h-full flex items-center justify-center">
                        <motion.img
                          src={item.image}
                          alt={item.title}
                          animate={{
                            scale: isCenter ? 1.12 : 0.92
                          }}
                          transition={
                            withAnimation
                              ? {
                                  duration: 0.4,
                                  ease: [0.22, 1, 0.36, 1]
                                }
                              : { duration: 0 }
                          }
                          className={`max-h-full max-w-full object-contain ${
                            isCenter ? 'drop-shadow-xl' : 'drop-shadow-xs'
                          }`}
                          loading="lazy"
                          draggable={false}
                        />
                      </div>
                    </div>

                    {/* Product Information below card */}
                    <div className="mt-2.5 sm:mt-5 w-full px-1">
                      <h3
                        className={`font-playfair text-xs sm:text-lg font-bold transition-colors line-clamp-1 ${
                          isCenter ? 'text-[#002141]' : 'text-[#3A3A3A]'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-[#002141]/70 font-medium mb-0.5 sm:mb-1">
                        {item.subTitle}
                      </p>
                      <p className="text-[10px] sm:text-xs text-[#666666] mb-1 sm:mb-2 leading-tight sm:leading-relaxed line-clamp-1">
                        {item.specs}
                      </p>
                      <p
                        className={`tracking-wide transition-all ${
                          isCenter ? 'text-[#002141] font-bold text-xs sm:text-base' : 'text-[#555555] font-semibold text-[11px] sm:text-sm'
                        }`}
                      >
                        {formatXOF(item.priceXOF)}
                      </p>

                      {/* Quick action button when zoomed in the center */}
                      <div className="h-6 sm:h-8 mt-1 sm:mt-2 flex items-center justify-center">
                        {isCenter && (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.25 }}
                            id={`signature-view-details-${uniqueKey}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/montres/${item.slug}`);
                            }}
                            className="premium-cta inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-[#AC854B] hover:text-[#002141] cursor-pointer"
                          >
                            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>Consulter la fiche</span>
                            <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center items-center gap-2 mt-4 sm:mt-6">
            {SIGNATURE_ITEMS.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Afficher ${item.title}`}
                onClick={() => handleDotClick(idx)}
                className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${
                  realActiveOriginalIndex === idx
                    ? 'w-7 sm:w-8 bg-[#002141]'
                    : 'w-2 bg-[#002141]/25 hover:bg-[#002141]/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Action Button: Découvrir Toutes Les Montres */}
        <div className="text-center mt-12 md:mt-14">
          <button
            type="button"
            id="signature-shop-all-watches-btn"
            onClick={() => navigate('/boutique')}
            className="premium-cta inline-flex items-center justify-center px-8 py-3.5 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.18em] shadow-sm cursor-pointer group"
          >
            <span>Découvrir Toutes Les Montres</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
};

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);

  useEffect(() => {
    setActiveIndex(INITIAL_INDEX);
  }, [INITIAL_INDEX]);

  // ResizeObserver to calculate dynamic track dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // When animation completes, silently re-center activeIndex to the middle cycle
  // This allows truly infinite looping in both directions without any visual jump
  const handleAnimationComplete = () => {
    if (!withAnimation) return;
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

  // Responsive item sizing & spacing
  const isMobile = containerWidth < 640;
  const isTablet = containerWidth >= 640 && containerWidth < 1024;

  const gap = isMobile ? 12 : isTablet ? 20 : 28;
  const cardWidth = isMobile
    ? Math.max(240, Math.min(270, Math.floor(containerWidth * 0.76)))
    : isTablet
    ? 290
    : Math.min(330, Math.floor((containerWidth - 2 * gap) / 3));

  const step = cardWidth + gap;

  // Formula to perfectly center card activeIndex inside container
  const targetX = containerWidth / 2 - cardWidth / 2 - activeIndex * step;

  // Infinite next / prev without limits in either direction
  const handlePrev = () => {
    setActiveIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    setActiveIndex((prev) => prev + 1);
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
    <section className="pt-12 pb-20 md:pt-20 md:pb-28 bg-[#FAF9F7] border-b border-[#002141]/10 overflow-hidden select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with elegant French typography */}
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] sm:tracking-[0.28em] text-[#AC854B] block mb-2 sm:mb-3">
            HERITAGE ABIDJAN &middot; SÉLECTION MAISON
          </span>
          <h2 className="font-playfair text-2xl sm:text-4xl md:text-5xl font-bold text-[#002141] tracking-tight mb-3 sm:mb-4">
            Explorez Nos Pièces Signatures
          </h2>
          <p className="text-xs sm:text-base text-[#4A4A4A] leading-relaxed max-w-2xl mx-auto px-2 sm:px-0">
            De l'aube au crépuscule, nos garde-temps vous accompagnent à chaque instant : symboles d'assurance, de précision et de distinction.
          </p>
        </div>

        {/* Carousel Container */}
        <div ref={containerRef} className="relative max-w-5xl mx-auto">
          {/* Navigation Arrows */}
          <button
            type="button"
            id="signature-slider-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Pièce précédente"
            className="absolute left-2 sm:-left-4 md:-left-8 top-[35%] sm:top-1/3 -translate-y-1/2 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 border border-[#002141]/15 text-[#002141] hover:bg-[#002141] hover:text-white shadow-md hidden sm:flex items-center justify-center transition-all duration-200 cursor-pointer group focus:outline-hidden"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <button
            type="button"
            id="signature-slider-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Pièce suivante"
            className="absolute right-2 sm:-right-4 md:-right-8 top-[35%] sm:top-1/3 -translate-y-1/2 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 border border-[#002141]/15 text-[#002141] hover:bg-[#002141] hover:text-white shadow-md hidden sm:flex items-center justify-center transition-all duration-200 cursor-pointer group focus:outline-hidden"
          >
            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Fluid Sliding Track powered by motion */}
          <div className="overflow-visible py-4 sm:py-8 touch-pan-y">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                const threshold = 25;
                if (info.offset.x < -threshold || info.velocity.x < -150) {
                  handleNext();
                } else if (info.offset.x > threshold || info.velocity.x > 150) {
                  handlePrev();
                }
              }}
              animate={{ x: targetX }}
              onAnimationComplete={handleAnimationComplete}
              transition={
                withAnimation
                  ? {
                      type: 'spring',
                      stiffness: 220,
                      damping: 26,
                      mass: 0.8
                    }
                  : { duration: 0 }
              }
              className="flex items-center cursor-grab active:cursor-grabbing"
              style={{ gap: `${gap}px` }}
            >
              {EXTENDED_ITEMS.map(({ item, uniqueKey }, index) => {
                const isCenter = index === activeIndex;
                const isNeighbor = Math.abs(index - activeIndex) === 1;

                return (
                  <motion.div
                    key={uniqueKey}
                    onClick={() => {
                      if (!isCenter) {
                        setActiveIndex(index);
                      }
                    }}
                    animate={{
                      scale: isCenter ? (isMobile ? 1.02 : 1.08) : isNeighbor ? 0.94 : 0.86,
                      opacity: isCenter ? 1 : isNeighbor ? 0.72 : 0.4,
                      filter: isCenter ? 'blur(0px)' : isNeighbor ? 'blur(0px)' : 'blur(0.5px)'
                    }}
                    transition={
                      withAnimation
                        ? {
                            duration: 0.45,
                            ease: [0.25, 1, 0.5, 1]
                          }
                        : { duration: 0 }
                    }
                    className="shrink-0 flex flex-col items-center text-center cursor-pointer select-none"
                    style={{
                      width: `${cardWidth}px`,
                      zIndex: isCenter ? 30 : 10
                    }}
                  >
                    {/* Square Framed Box matching the reference design */}
                    <div
                      className={`premium-section-card w-full bg-white rounded-none border p-4 sm:p-7 flex items-center justify-center relative overflow-hidden transition-all duration-400 ${
                        isCenter
                          ? 'border-[#002141]/30 shadow-2xl ring-1 ring-[#AC854B]/50'
                          : 'border-[#002141]/10 shadow-xs hover:border-[#002141]/25'
                      }`}
                      style={{ aspectRatio: '1 / 1.05' }}
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
                            className={`absolute top-2.5 left-2.5 sm:top-3 sm:left-3 p-1.5 rounded-full border shadow-xs transition-colors cursor-pointer z-20 ${
                              isFav
                                ? 'bg-white text-[#AC854B] border-[#AC854B]/40 scale-105'
                                : 'bg-white/85 hover:bg-white text-[#002141]/60 hover:text-[#AC854B] border-[#002141]/10'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#AC854B] text-[#AC854B]' : ''}`} />
                          </button>
                        );
                      })()}

                      {/* Center Item Badge */}
                      {isCenter && item.badge && (
                        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-[#002141] text-[#FAF9F7] text-[8px] sm:text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 z-10 shadow-xs">
                          {item.badge}
                        </div>
                      )}

                      {/* Watch Image with Dynamic Zoom on Center */}
                      <div className="relative w-full h-full flex items-center justify-center">
                        <motion.img
                          src={item.image}
                          alt={item.title}
                          animate={{
                            scale: isCenter ? (isMobile ? 1.08 : 1.15) : 0.95
                          }}
                          transition={
                            withAnimation
                              ? {
                                  duration: 0.45,
                                  ease: [0.25, 1, 0.5, 1]
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
                    <div className="mt-3 sm:mt-5 w-full px-1 sm:px-2">
                      <h3
                        className={`font-playfair text-base sm:text-xl font-bold transition-colors line-clamp-1 ${
                          isCenter ? 'text-[#002141]' : 'text-[#3A3A3A]'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-[#002141]/70 font-medium mb-0.5 sm:mb-1">
                        {item.subTitle}
                      </p>
                      <p className="text-[11px] sm:text-xs text-[#666666] mb-1.5 sm:mb-2 leading-tight sm:leading-relaxed line-clamp-1">
                        {item.specs}
                      </p>
                      <p
                        className={`font-semibold text-sm sm:text-base tracking-wide ${
                          isCenter ? 'text-[#002141] font-bold text-sm sm:text-base' : 'text-[#4A4A4A]'
                        }`}
                      >
                        {formatXOF(item.priceXOF)}
                      </p>

                      {/* Quick action button when zoomed in the center */}
                      <div className="h-7 sm:h-8 mt-1.5 sm:mt-2 flex items-center justify-center">
                        {isCenter && (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.3 }}
                            id={`signature-view-details-${uniqueKey}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/montres/${item.slug}`);
                            }}
                            className="premium-cta inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#AC854B] hover:text-[#002141] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Consulter la fiche</span>
                            <ArrowRight className="w-3 h-3" />
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
          <div className="flex justify-center items-center gap-2 mt-4">
            {SIGNATURE_ITEMS.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Afficher ${item.title}`}
                onClick={() => handleDotClick(idx)}
                className={`h-2 transition-all duration-300 rounded-full cursor-pointer ${
                  realActiveOriginalIndex === idx
                    ? 'w-8 bg-[#002141]'
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

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';

interface CategoriesSectionProps {
  navigate: (route: string) => void;
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({ navigate }) => {
  const { products } = usePublicContent();
  const watches = products.filter((product) => product.category === 'montres');
  const featuredWatch = watches[0];

  // Nothing is substituted when Supabase has no published watch: the section
  // remains a catalogue entry point, without a fictitious product image/count.
  return (
    <section className="py-20 md:py-28 bg-[#FAF9F7] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 md:mb-16">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
            COLLECTION ACTIVE
          </span>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-bold text-[#002141] leading-tight mb-4">
            Choisissez ce qui vous accompagnera longtemps
          </h2>
          <p className="text-sm md:text-base text-[#3A3A3A] leading-relaxed">
            Commencez par la pièce qui correspond à votre usage. Prenez ensuite le temps d'en
            examiner la matière, le mouvement et la référence.
          </p>
        </div>

        {/* Featured Category Card - Montres */}
        <div className="premium-section-card grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-[#002141]/10 p-8 md:p-12 shadow-xs">
          <div className="lg:col-span-6 space-y-6">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#AC854B] block">
              CATÉGORIE DISPONIBLE
            </span>
            <h3 className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141]">
              Montres
            </h3>
            <p className="text-sm text-[#3A3A3A] leading-relaxed max-w-lg">
              Des mécanismes et des lignes choisis pour rester justes au fil des années. Découvrez
              nos calibres automatiques suisses et chronographes de précision rigoureusement
              sélectionnés.
            </p>
            <div className="pt-2">
              <button
                type="button"
                id="categories-discover-watches"
                onClick={() => navigate('/montres')}
                className="premium-cta inline-flex items-center gap-3 px-6 py-3.5 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] cursor-pointer group"
              >
                <span>DÉCOUVRIR LES MONTRES</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div
              className="relative aspect-4/3 overflow-hidden bg-[#FAF9F7] border border-[#002141]/5 group cursor-pointer"
              onClick={() => navigate('/montres')}
            >
              {featuredWatch?.primaryImage && <img
                src={featuredWatch.primaryImage}
                alt={featuredWatch.name}
                className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-500"
              />}
              {watches.length > 0 && <div className="absolute bottom-4 right-4 bg-[#002141]/80 text-[#FAF9F7] px-3 py-1 text-[11px] font-semibold tracking-wider uppercase">
                {watches.length} RÉFÉRENCE{watches.length > 1 ? 'S' : ''} PUBLIÉE{watches.length > 1 ? 'S' : ''}
              </div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

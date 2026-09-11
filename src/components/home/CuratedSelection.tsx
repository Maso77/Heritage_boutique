import React from 'react';
import { usePublicContent } from '../../lib/public-content';
import { ProductCard } from '../catalog/ProductCard';
import { ArrowRight } from 'lucide-react';

interface CuratedSelectionProps {
  navigate: (route: string) => void;
}

export const CuratedSelection: React.FC<CuratedSelectionProps> = ({ navigate }) => {
  const { products } = usePublicContent();
  const featured = products.filter((product) => product.category === 'montres').slice(0, 3);

  return (
    <section className="py-20 md:py-28 bg-white border-b border-[#002141]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-6">
          <div className="max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
              SÉLECTION SIGNATURE
            </span>
            <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-bold text-[#002141] leading-tight mb-4">
              Des montres qui n'ont pas besoin d'en faire trop
            </h2>
            <p className="text-sm md:text-base text-[#3A3A3A] leading-relaxed">
              Une montre se remarque d'abord par ce qu'elle tient dans le temps. Voici trois
              expressions de cette exigence.
            </p>
          </div>

          <div>
            <button
              type="button"
              id="curated-view-all-watches"
              onClick={() => navigate('/montres')}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#002141] hover:text-[#AC854B] pb-1 border-b-2 border-[#AC854B] transition-colors cursor-pointer group"
            >
              <span>VOIR TOUTES LES MONTRES</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* 3 Featured Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} navigate={navigate} />
          ))}
        </div>
      </div>
    </section>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { usePublicContent, xof as formatXOF } from '../../lib/public-content';
import { Search, X, ArrowRight } from 'lucide-react';
import { Product } from '../../types';

interface SearchModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  navigate: (route: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  navigate,
}) => {
  const { isSearchOpen: storeIsOpen, setIsSearchOpen } = useStore();
  const { products } = usePublicContent();
  const isSearchOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen;

  const handleClose = () => {
    if (propOnClose) propOnClose();
    setIsSearchOpen(false);
  };

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const results: Product[] = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(trimmed) ||
        p.reference.toLowerCase().includes(trimmed) ||
        p.brand.toLowerCase().includes(trimmed) ||
        p.attributes.mouvement.toLowerCase().includes(trimmed) ||
        (p.attributes.cadran && p.attributes.cadran.toLowerCase().includes(trimmed)) ||
        (p.attributes.boitier && p.attributes.boitier.toLowerCase().includes(trimmed))
      );
    });
  }, [query, products]);

  if (!isSearchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#002141]/75 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche de pièces"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl bg-[#FAF9F7] rounded-none shadow-2xl border border-[#002141]/10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header with input */}
        <div className="flex items-center px-6 py-4 border-b border-[#002141]/10 bg-white">
          <Search className="w-5 h-5 text-[#AC854B] mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Modèle, référence ou caractéristique (ex: Le Locle, T006, Automatique...)"
            className="w-full bg-transparent text-[#002141] placeholder-[#3A3A3A]/50 text-sm sm:text-base focus:outline-hidden"
            aria-label="Champ de recherche"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-[#3A3A3A]/60 hover:text-[#002141] mr-2 cursor-pointer"
              aria-label="Effacer le texte"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 -mr-1.5 text-[#3A3A3A]/60 hover:text-[#002141] cursor-pointer"
            aria-label="Fermer la recherche"
          >
            <span className="text-xs uppercase font-semibold tracking-wider">Fermer</span>
          </button>
        </div>

        {/* Results / Suggestions container */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {!query.trim() ? (
            <div className="py-4 text-center">
              <p className="text-xs uppercase tracking-widest text-[#AC854B] font-semibold mb-3">
                Suggestions de recherche
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Tissot Le Locle', 'PR516 Chronographe', 'Seastar 1000', 'Automatique', 'Acier 316L', 'Cadran Bleu'].map(
                  (term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="px-3 py-1.5 text-xs bg-[#E8E1D3]/50 hover:bg-[#D6BB8F]/30 text-[#002141] transition-colors cursor-pointer"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-[#3A3A3A] mb-3">
                {results.length} résultat{results.length > 1 ? 's' : ''} correspondant à votre recherche :
              </p>
              {results.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    navigate(`/montres/${product.slug}`);
                    handleClose();
                  }}
                  className="group flex items-center justify-between p-3 bg-white hover:bg-[#FAF9F7] border border-[#002141]/5 hover:border-[#AC854B]/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={product.primaryImage}
                      alt={product.name}
                      className="w-14 h-18 object-contain bg-[#FAF9F7] p-1 flex-shrink-0"
                    />
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#AC854B] block">
                        {product.brand} &middot; Réf. {product.reference}
                      </span>
                      <h4 className="font-playfair text-sm sm:text-base font-bold text-[#002141] group-hover:text-[#AC854B] transition-colors">
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#3A3A3A]">
                        <span>{product.attributes.mouvement}</span>
                        <span>&middot;</span>
                        <span>{product.attributes.diametre}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className="text-sm font-bold text-[#002141] block">
                      {formatXOF(product.priceXOF)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#AC854B] mt-1 group-hover:translate-x-1 transition-transform">
                      Voir la pièce <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Zero result state conforming to PRD */
            <div className="py-8 text-center space-y-4">
              <p className="text-sm text-[#002141] font-medium">
                Aucune pièce ne correspond à votre recherche.
              </p>
              <p className="text-xs text-[#3A3A3A] max-w-sm mx-auto">
                Modifiez vos termes ou découvrez l'ensemble des montres suisses actuellement disponibles chez HERITAGE.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/montres');
                    handleClose();
                  }}
                  className="px-6 py-2.5 bg-[#002141] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest hover:bg-[#AC854B] transition-colors cursor-pointer"
                >
                  VOIR TOUTES LES MONTRES
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

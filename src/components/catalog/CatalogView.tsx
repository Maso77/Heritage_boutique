import React, { useState, useMemo } from 'react';
import { usePublicContent, xof as formatXOF } from '../../lib/public-content';
import { whatsappHref } from '../../lib/site-contact';
import { PublicFeedbackSections } from '../common/PublicFeedbackSections';
import { ProductCard } from './ProductCard';
import { FilterState, Product } from '../../types';
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  Check,
  Tag,
  Banknote,
  Layers,
  Search
} from 'lucide-react';

interface CatalogViewProps {
  navigate: (route: string) => void;
  initialBrand?: string;
}

const PRICE_PRESETS = [
  { id: 'all', label: 'Tous les budgets', min: undefined, max: undefined },
  { id: 'under_150k', label: 'Moins de 150 000 FCFA', min: undefined, max: 150000 },
  { id: '150k_300k', label: '150 000 – 300 000 FCFA', min: 150000, max: 300000 },
  { id: '300k_450k', label: '300 000 – 450 000 FCFA', min: 300000, max: 450000 },
  { id: 'above_450k', label: 'Plus de 450 000 FCFA', min: 450000, max: undefined }
];

const CATEGORY_NAMES: Record<string, string> = {
  montres: 'Montres & Horlogerie',
  parfums: 'Haute Parfumerie',
  lunettes: 'Accessoires & Lunettes'
};

export const CatalogView: React.FC<CatalogViewProps> = ({ navigate, initialBrand }) => {
  const { products: publishedProducts, siteSettings } = usePublicContent();
  const whatsappUrl = whatsappHref(siteSettings, 'Bonjour HERITAGE, je consulte votre catalogue et souhaite un conseil.');

  // Bornes dynamiques du catalogue
  const { minCatalogPrice, maxCatalogPrice } = useMemo(() => {
    if (publishedProducts.length === 0) return { minCatalogPrice: 0, maxCatalogPrice: 1000000 };
    const prices = publishedProducts.map((p) => p.priceXOF);
    return {
      minCatalogPrice: Math.min(...prices),
      maxCatalogPrice: Math.max(...prices)
    };
  }, [publishedProducts]);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    brand: initialBrand ? [initialBrand] : [],
    category: [],
    movement: [],
    diameter: [],
    waterResistance: [],
    material: [],
    dialColor: [],
    availability: [],
    minPrice: undefined,
    maxPrice: undefined,
    pricePreset: 'all',
    sort: 'pertinence'
  });

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Facet options derived from actual published products
  const facetOptions = useMemo(() => {
    const brands = Array.from(new Set(publishedProducts.map((p) => p.brand))) as string[];
    const categories = Array.from(new Set(publishedProducts.map((p) => p.category || 'montres'))) as string[];
    const movements = Array.from(
      new Set(
        publishedProducts
          .map((p) => p.attributes?.mouvement)
          .filter(Boolean) as string[]
      )
    );
    const diameters = Array.from(
      new Set(
        publishedProducts
          .map((p) => p.attributes?.diametre)
          .filter(Boolean) as string[]
      )
    );
    const availabilities = Array.from(new Set(publishedProducts.map((p) => p.stockStatus)));

    // Comptages par marque et catégorie
    const brandCounts: Record<string, number> = {};
    brands.forEach((b) => {
      brandCounts[b] = publishedProducts.filter((p) => p.brand === b).length;
    });

    const categoryCounts: Record<string, number> = {};
    categories.forEach((c) => {
      categoryCounts[c] = publishedProducts.filter((p) => (p.category || 'montres') === c).length;
    });

    return { brands, categories, movements, diameters, availabilities, brandCounts, categoryCounts };
  }, [publishedProducts]);

  // Toggle helpers
  const toggleArrayFilter = (key: 'brand' | 'category' | 'movement' | 'diameter' | 'availability', value: string) => {
    setFilters((prev) => {
      const currentList = prev[key] || [];
      const exists = currentList.includes(value);
      const updated = exists ? currentList.filter((item) => item !== value) : [...currentList, value];
      return { ...prev, [key]: updated };
    });
  };

  // Preset de prix
  const applyPricePreset = (presetId: string) => {
    const preset = PRICE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setFilters((prev) => ({
      ...prev,
      pricePreset: presetId,
      minPrice: preset.min,
      maxPrice: preset.max
    }));
  };

  // Slider de prix maximum
  const handleMaxPriceSlider = (val: number) => {
    setFilters((prev) => ({
      ...prev,
      pricePreset: 'custom',
      maxPrice: val >= maxCatalogPrice ? undefined : val
    }));
  };

  // Inputs directs Min/Max
  const handleMinPriceChange = (valStr: string) => {
    const num = valStr === '' ? undefined : Math.max(0, parseInt(valStr, 10) || 0);
    setFilters((prev) => ({
      ...prev,
      pricePreset: 'custom',
      minPrice: num
    }));
  };

  const handleMaxPriceChange = (valStr: string) => {
    const num = valStr === '' ? undefined : Math.max(0, parseInt(valStr, 10) || 0);
    setFilters((prev) => ({
      ...prev,
      pricePreset: 'custom',
      maxPrice: num
    }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      brand: [],
      category: [],
      movement: [],
      diameter: [],
      waterResistance: [],
      material: [],
      dialColor: [],
      availability: [],
      minPrice: undefined,
      maxPrice: undefined,
      pricePreset: 'all',
      sort: 'pertinence'
    });
  };

  // Filtered & sorted product list
  const filteredProducts = useMemo(() => {
    return publishedProducts
      .filter((product) => {
        // Search
        if (filters.search.trim()) {
          const s = filters.search.toLowerCase();
          const matches =
            product.name.toLowerCase().includes(s) ||
            product.reference.toLowerCase().includes(s) ||
            product.brand.toLowerCase().includes(s) ||
            (product.attributes?.mouvement && product.attributes.mouvement.toLowerCase().includes(s)) ||
            (product.category && product.category.toLowerCase().includes(s));
          if (!matches) return false;
        }

        // Marque
        if (filters.brand.length > 0 && !filters.brand.includes(product.brand)) {
          return false;
        }

        // Catégorie
        const prodCat = product.category || 'montres';
        if (filters.category.length > 0 && !filters.category.includes(prodCat)) {
          return false;
        }

        // Prix minimum
        if (filters.minPrice !== undefined && product.priceXOF < filters.minPrice) {
          return false;
        }

        // Prix maximum
        if (filters.maxPrice !== undefined && product.priceXOF > filters.maxPrice) {
          return false;
        }

        // Mouvement
        if (
          filters.movement.length > 0 &&
          (!product.attributes?.mouvement || !filters.movement.includes(product.attributes.mouvement))
        ) {
          return false;
        }

        // Diamètre
        if (
          filters.diameter.length > 0 &&
          (!product.attributes?.diametre || !filters.diameter.includes(product.attributes.diametre))
        ) {
          return false;
        }

        // Disponibilité
        if (filters.availability.length > 0 && !filters.availability.includes(product.stockStatus)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sort === 'prix_croissant') return a.priceXOF - b.priceXOF;
        if (filters.sort === 'prix_decroissant') return b.priceXOF - a.priceXOF;
        return 0; // Default pertinence
      });
  }, [publishedProducts, filters]);

  // Nombre de filtres actifs
  const activeFilterCount =
    filters.brand.length +
    filters.category.length +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    filters.movement.length +
    filters.diameter.length +
    filters.availability.length +
    (filters.search ? 1 : 0);

  // Valeur affichée du slider de prix max
  const currentSliderValue = filters.maxPrice !== undefined ? filters.maxPrice : maxCatalogPrice;

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#002141] transition-colors cursor-pointer"
          >
            Accueil
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Boutique</span>
          {initialBrand && (
            <>
              <span>/</span>
              <span className="text-[#AC854B] font-semibold">{initialBrand}</span>
            </>
          )}
        </nav>

        {/* Page Header */}
        <div className="max-w-3xl mb-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
            CATALOGUE OFFICIEL ABIDJAN
          </span>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-[#002141] leading-tight mb-4">
            {initialBrand ? `Montres ${initialBrand} à Abidjan` : 'La Boutique & Catalogue HERITAGE'}
          </h1>
          <p className="text-sm sm:text-base text-[#3A3A3A] leading-relaxed mb-4">
            Découvrez nos pièces d'exception sélectionnées pour leur précision, leur facture et leur durabilité.
            Filtrez par budget, marque et catégorie pour trouver votre prochain garde-temps ou sillage exclusif.
          </p>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#E8E1D3]/50 text-xs font-semibold text-[#002141] border border-[#AC854B]/20">
            <span>
              {filteredProducts.length} {filteredProducts.length > 1 ? 'pièces correspondent' : 'pièce correspond'} à votre recherche
            </span>
            <span className="text-[#AC854B] font-serif">·</span>
            <span className="text-[#3A3A3A]">{siteSettings?.address || 'Abidjan, Côte d’Ivoire'}</span>
          </div>
        </div>

        {/* Quick Filter Pills (Catégories & Marques & Prix phares) */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#3A3A3A]/70 shrink-0 mr-1">
            Accès rapide :
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors shrink-0 cursor-pointer ${
              activeFilterCount === 0
                ? 'bg-[#002141] text-[#FAF9F7] border-[#002141]'
                : 'bg-white text-[#002141] border-[#002141]/15 hover:border-[#AC854B]'
            }`}
          >
            Tout ({publishedProducts.length})
          </button>
          {facetOptions.categories.map((cat) => {
            const isCatActive = filters.category.length === 1 && filters.category.includes(cat);
            return (
              <button
                key={`quick-cat-${cat}`}
                type="button"
                onClick={() => {
                  setFilters((prev) => ({
                    ...prev,
                    category: isCatActive ? [] : [cat]
                  }));
                }}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors shrink-0 cursor-pointer ${
                  isCatActive
                    ? 'bg-[#002141] text-[#FAF9F7] border-[#002141]'
                    : 'bg-white text-[#002141] border-[#002141]/15 hover:border-[#AC854B]'
                }`}
              >
                {CATEGORY_NAMES[cat] || cat} ({facetOptions.categoryCounts[cat] || 0})
              </button>
            );
          })}
          {facetOptions.brands.map((brand) => {
            const isBrandActive = filters.brand.length === 1 && filters.brand.includes(brand);
            return (
              <button
                key={`quick-brand-${brand}`}
                type="button"
                onClick={() => {
                  setFilters((prev) => ({
                    ...prev,
                    brand: isBrandActive ? [] : [brand]
                  }));
                }}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors shrink-0 cursor-pointer ${
                  isBrandActive
                    ? 'bg-[#AC854B] text-[#FAF9F7] border-[#AC854B]'
                    : 'bg-white text-[#002141] border-[#002141]/15 hover:border-[#AC854B]'
                }`}
              >
                {brand} ({facetOptions.brandCounts[brand] || 0})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => applyPricePreset('under_150k')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors shrink-0 cursor-pointer ${
              filters.pricePreset === 'under_150k'
                ? 'bg-[#002141] text-[#FAF9F7] border-[#002141]'
                : 'bg-white text-[#002141] border-[#002141]/15 hover:border-[#AC854B]'
            }`}
          >
            &lt; 150 000 FCFA
          </button>
          <button
            type="button"
            onClick={() => {
              const isAuto = filters.movement.length === 1 && filters.movement.includes('Automatique');
              setFilters((prev) => ({
                ...prev,
                movement: isAuto ? [] : ['Automatique']
              }));
            }}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-xs border transition-colors shrink-0 cursor-pointer ${
              filters.movement.includes('Automatique')
                ? 'bg-[#002141] text-[#FAF9F7] border-[#002141]'
                : 'bg-white text-[#002141] border-[#002141]/15 hover:border-[#AC854B]'
            }`}
          >
            Mécanique Automatique
          </button>
        </div>

        {/* Top Controls Bar: Search, Mobile Filter Toggle, and Sort */}
        <div className="bg-white border border-[#002141]/10 p-4 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Rechercher par nom, marque, référence ou calibre..."
              className="w-full text-xs sm:text-sm bg-[#FAF9F7] pl-9 pr-3.5 py-2.5 border border-[#002141]/15 text-[#002141] placeholder-[#3A3A3A]/60 focus:outline-hidden focus:border-[#AC854B]"
            />
            <Search className="w-4 h-4 text-[#3A3A3A]/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A3A3A]/60 hover:text-[#002141]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4">
            {/* Mobile Filter Trigger */}
            <button
              type="button"
              id="mobile-filters-trigger"
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 px-4 py-2.5 bg-[#FAF9F7] border border-[#002141]/15 text-xs font-semibold uppercase tracking-wider text-[#002141] hover:border-[#AC854B] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#AC854B]" />
              <span>Filtres {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
            </button>

            {/* Sort Select */}
            <div className="flex items-center gap-2">
              <label htmlFor="catalog-sort" className="text-xs text-[#3A3A3A] whitespace-nowrap">
                Trier par :
              </label>
              <div className="relative">
                <select
                  id="catalog-sort"
                  value={filters.sort}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      sort: e.target.value as FilterState['sort']
                    })
                  }
                  className="appearance-none bg-[#FAF9F7] border border-[#002141]/15 text-xs font-semibold text-[#002141] py-2 pl-3 pr-8 focus:outline-hidden focus:border-[#AC854B] cursor-pointer"
                >
                  <option value="pertinence">Pertinence</option>
                  <option value="prix_croissant">Prix croissant</option>
                  <option value="prix_decroissant">Prix décroissant</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#3A3A3A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Active Filter Tags (si filtres appliqués) */}
        {activeFilterCount > 0 && (
          <div className="mb-6 bg-[#E8E1D3]/30 border border-[#AC854B]/20 p-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-[#002141] uppercase tracking-wider text-[10px] mr-1">
              Filtres actifs :
            </span>

            {/* Badges Catégorie */}
            {filters.category.map((cat) => (
              <span
                key={`badge-cat-${cat}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#002141]/15 text-[#002141] font-medium"
              >
                <span>Catégorie : {CATEGORY_NAMES[cat] || cat}</span>
                <button
                  type="button"
                  onClick={() => toggleArrayFilter('category', cat)}
                  className="text-[#AC854B] hover:text-[#002141]"
                  aria-label={`Supprimer filtre ${cat}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Badges Marque */}
            {filters.brand.map((brand) => (
              <span
                key={`badge-brand-${brand}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#002141]/15 text-[#002141] font-medium"
              >
                <span>Marque : {brand}</span>
                <button
                  type="button"
                  onClick={() => toggleArrayFilter('brand', brand)}
                  className="text-[#AC854B] hover:text-[#002141]"
                  aria-label={`Supprimer filtre ${brand}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Badge Prix */}
            {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#002141]/15 text-[#002141] font-medium">
                <span>
                  Budget :{' '}
                  {filters.minPrice !== undefined && filters.maxPrice !== undefined
                    ? `${formatXOF(filters.minPrice)} – ${formatXOF(filters.maxPrice)}`
                    : filters.minPrice !== undefined
                    ? `À partir de ${formatXOF(filters.minPrice)}`
                    : `Jusqu'à ${formatXOF(filters.maxPrice!)}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      minPrice: undefined,
                      maxPrice: undefined,
                      pricePreset: 'all'
                    }))
                  }
                  className="text-[#AC854B] hover:text-[#002141]"
                  aria-label="Supprimer filtre prix"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Badges Mouvement */}
            {filters.movement.map((mov) => (
              <span
                key={`badge-mov-${mov}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#002141]/15 text-[#002141] font-medium"
              >
                <span>Mouvement : {mov}</span>
                <button
                  type="button"
                  onClick={() => toggleArrayFilter('movement', mov)}
                  className="text-[#AC854B] hover:text-[#002141]"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Badge Recherche */}
            {filters.search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#002141]/15 text-[#002141] font-medium">
                <span>Recherche : "{filters.search}"</span>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, search: '' })}
                  className="text-[#AC854B] hover:text-[#002141]"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-[#AC854B] hover:text-[#002141] uppercase tracking-wider cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tout effacer</span>
            </button>
          </div>
        )}

        {/* Main Grid with Sidebar Filter Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Filter Sidebar (280px wide) */}
          <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#002141]/10 p-6 space-y-6 sticky top-24">
            <div className="flex items-center justify-between pb-4 border-b border-[#002141]/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#AC854B]" />
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141]">
                  Filtres
                </h3>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#AC854B] hover:text-[#002141] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Réinitialiser</span>
                </button>
              )}
            </div>

            {/* 1. FILTRE PAR PRIX */}
            <div className="space-y-4 pb-6 border-b border-[#002141]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-[#AC854B]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                    Prix (FCFA)
                  </h4>
                </div>
                {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
                  <button
                    type="button"
                    onClick={() => applyPricePreset('all')}
                    className="text-[10px] text-[#AC854B] hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Presets rapides de prix */}
              <div className="space-y-1.5">
                {PRICE_PRESETS.map((preset) => {
                  const isSelected = filters.pricePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPricePreset(preset.id)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#002141] text-[#FAF9F7] font-semibold'
                          : 'text-[#3A3A3A] hover:bg-[#FAF9F7] hover:text-[#002141]'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-[#D6BB8F]" />}
                    </button>
                  );
                })}
              </div>

              {/* Slider de budget maximal */}
              <div className="pt-2 space-y-2">
                <div className="flex justify-between items-center text-[11px] text-[#3A3A3A]">
                  <span>Plafond budgétaire :</span>
                  <span className="font-bold text-[#002141]">
                    {filters.maxPrice !== undefined ? formatXOF(filters.maxPrice) : 'Sans limite'}
                  </span>
                </div>
                <input
                  type="range"
                  min={minCatalogPrice}
                  max={maxCatalogPrice}
                  step={25000}
                  value={currentSliderValue}
                  onChange={(e) => handleMaxPriceSlider(parseInt(e.target.value, 10))}
                  className="w-full accent-[#AC854B] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#3A3A3A]/70">
                  <span>{formatXOF(minCatalogPrice)}</span>
                  <span>{formatXOF(maxCatalogPrice)}</span>
                </div>
              </div>

              {/* Inputs Min et Max manuels */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label htmlFor="price-min-desktop" className="text-[10px] uppercase tracking-wider text-[#3A3A3A] block mb-1">
                    Min (FCFA)
                  </label>
                  <input
                    id="price-min-desktop"
                    type="number"
                    value={filters.minPrice !== undefined ? filters.minPrice : ''}
                    placeholder={minCatalogPrice.toString()}
                    onChange={(e) => handleMinPriceChange(e.target.value)}
                    className="w-full text-xs bg-[#FAF9F7] px-2.5 py-1.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                  />
                </div>
                <div>
                  <label htmlFor="price-max-desktop" className="text-[10px] uppercase tracking-wider text-[#3A3A3A] block mb-1">
                    Max (FCFA)
                  </label>
                  <input
                    id="price-max-desktop"
                    type="number"
                    value={filters.maxPrice !== undefined ? filters.maxPrice : ''}
                    placeholder={maxCatalogPrice.toString()}
                    onChange={(e) => handleMaxPriceChange(e.target.value)}
                    className="w-full text-xs bg-[#FAF9F7] px-2.5 py-1.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                  />
                </div>
              </div>
            </div>

            {/* 2. FILTRE PAR MARQUE */}
            <div className="space-y-3 pb-6 border-b border-[#002141]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#AC854B]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                    Marque
                  </h4>
                </div>
                {filters.brand.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, brand: [] }))}
                    className="text-[10px] text-[#AC854B] hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {facetOptions.brands.map((brand) => {
                  const isChecked = filters.brand.includes(brand);
                  const count = facetOptions.brandCounts[brand] || 0;
                  return (
                    <label
                      key={`desktop-brand-${brand}`}
                      className={`flex items-center justify-between p-2 rounded-xs text-xs cursor-pointer select-none transition-colors ${
                        isChecked ? 'bg-[#FAF9F7] text-[#002141] font-medium' : 'text-[#3A3A3A] hover:bg-[#FAF9F7]/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayFilter('brand', brand)}
                          className="rounded-xs border-[#002141]/30 text-[#002141] focus:ring-[#AC854B] cursor-pointer"
                        />
                        <span>{brand}</span>
                      </div>
                      <span className="text-[11px] px-1.5 py-0.5 bg-white border border-[#002141]/10 text-[#3A3A3A]">
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. FILTRE PAR CATÉGORIE */}
            <div className="space-y-3 pb-6 border-b border-[#002141]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#AC854B]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                    Catégorie
                  </h4>
                </div>
                {filters.category.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, category: [] }))}
                    className="text-[10px] text-[#AC854B] hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {facetOptions.categories.map((cat) => {
                  const isChecked = filters.category.includes(cat);
                  const count = facetOptions.categoryCounts[cat] || 0;
                  return (
                    <label
                      key={`desktop-cat-${cat}`}
                      className={`flex items-center justify-between p-2 rounded-xs text-xs cursor-pointer select-none transition-colors ${
                        isChecked ? 'bg-[#FAF9F7] text-[#002141] font-medium' : 'text-[#3A3A3A] hover:bg-[#FAF9F7]/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayFilter('category', cat)}
                          className="rounded-xs border-[#002141]/30 text-[#002141] focus:ring-[#AC854B] cursor-pointer"
                        />
                        <span>{CATEGORY_NAMES[cat] || cat}</span>
                      </div>
                      <span className="text-[11px] px-1.5 py-0.5 bg-white border border-[#002141]/10 text-[#3A3A3A]">
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. FILTRE PAR MOUVEMENT (HORLOGERIE) */}
            {facetOptions.movements.length > 0 && (
              <div className="space-y-3 pb-6 border-b border-[#002141]/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                  Mouvement
                </h4>
                <div className="space-y-2">
                  {facetOptions.movements.map((mov) => (
                    <label
                      key={`desktop-mov-${mov}`}
                      className="flex items-center gap-2.5 text-xs text-[#3A3A3A] hover:text-[#002141] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={filters.movement.includes(mov)}
                        onChange={() => toggleArrayFilter('movement', mov)}
                        className="rounded-xs border-[#002141]/30 text-[#002141] focus:ring-[#AC854B] cursor-pointer"
                      />
                      <span>{mov}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 5. FILTRE PAR DISPONIBILITÉ */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141] mb-3">
                Disponibilité à Abidjan
              </h4>
              <div className="space-y-2">
                {facetOptions.availabilities.map((avail) => (
                  <label
                    key={`desktop-avail-${avail}`}
                    className="flex items-center gap-2.5 text-xs text-[#3A3A3A] hover:text-[#002141] cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={filters.availability.includes(avail)}
                      onChange={() => toggleArrayFilter('availability', avail)}
                      className="rounded-xs border-[#002141]/30 text-[#002141] focus:ring-[#AC854B] cursor-pointer"
                    />
                    <span>{avail}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          {/* Product Grid Area */}
          <div className="lg:col-span-9">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} navigate={navigate} />
                ))}
              </div>
            ) : (
              /* Zero Results State */
              <div className="bg-white border border-[#002141]/10 p-12 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#E8E1D3]/50 flex items-center justify-center text-[#AC854B]">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <p className="font-playfair text-xl font-bold text-[#002141]">
                  Aucune pièce ne correspond à cette combinaison de filtres
                </p>
                <p className="text-xs text-[#3A3A3A] max-w-md mx-auto leading-relaxed">
                  Élargissez votre fourchette de prix, retirez un filtre de marque ou de catégorie
                  pour découvrir les autres pièces de la Maison HERITAGE disponibles à Abidjan.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-6 py-3 bg-[#002141] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest hover:bg-[#AC854B] transition-colors cursor-pointer"
                  >
                    RÉINITIALISER TOUS LES FILTRES
                  </button>
                  {filters.pricePreset !== 'all' && (
                    <button
                      type="button"
                      onClick={() => applyPricePreset('all')}
                      className="px-6 py-3 bg-transparent border border-[#002141]/20 text-[#002141] text-xs font-semibold uppercase tracking-widest hover:border-[#AC854B] transition-colors cursor-pointer"
                    >
                      ÉLARGIR LE BUDGET
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Advice Prompt Banner at Bottom */}
        <div className="mt-16 bg-white border border-[#002141]/10 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-playfair text-xl font-bold text-[#002141] mb-2">
              Une référence vous intéresse, mais vous hésitez encore ?
            </h3>
            <p className="text-xs sm:text-sm text-[#3A3A3A] max-w-2xl leading-relaxed">
              HERITAGE vous accompagne à {siteSettings?.address || 'Abidjan'}. Obtenez une précision technique,
              validez la taille sur votre poignet ou organisez une remise en main propre sécurisée.
            </p>
          </div>
          {whatsappUrl && <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-2.5 shrink-0 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-[#D6BB8F]" />
            <span>ÉCHANGER AVEC UN CONSEILLER</span>
          </a>}
        </div>
        <PublicFeedbackSections placement="catalog" />
      </div>

      {/* Mobile Filters Drawer */}
      {isMobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#002141]/80 backdrop-blur-xs flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between p-6 overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#002141]/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#AC854B]" />
                <h3 className="font-playfair text-lg font-bold text-[#002141]">
                  Filtres ({activeFilterCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-2 -mr-2 text-[#3A3A3A] hover:text-[#002141]"
                aria-label="Fermer les filtres"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body with all filter groups */}
            <div className="flex-1 py-6 space-y-6">
              {/* 1. Prix Mobile */}
              <div className="space-y-3 pb-5 border-b border-[#002141]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-[#AC854B]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                      Budget (FCFA)
                    </h4>
                  </div>
                  {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
                    <button
                      type="button"
                      onClick={() => applyPricePreset('all')}
                      className="text-[10px] text-[#AC854B] underline"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {PRICE_PRESETS.map((preset) => {
                    const isSelected = filters.pricePreset === preset.id;
                    return (
                      <button
                        key={`mobile-preset-${preset.id}`}
                        type="button"
                        onClick={() => applyPricePreset(preset.id)}
                        className={`text-left px-3 py-2 text-xs rounded-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#002141] text-[#FAF9F7] font-semibold'
                            : 'bg-[#FAF9F7] text-[#3A3A3A]'
                        }`}
                      >
                        <span>{preset.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-[#D6BB8F]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Range Slider Mobile */}
                <div className="pt-2 space-y-2">
                  <div className="flex justify-between items-center text-xs text-[#3A3A3A]">
                    <span>Budget max :</span>
                    <span className="font-bold text-[#002141]">
                      {filters.maxPrice !== undefined ? formatXOF(filters.maxPrice) : 'Sans limite'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={minCatalogPrice}
                    max={maxCatalogPrice}
                    step={25000}
                    value={currentSliderValue}
                    onChange={(e) => handleMaxPriceSlider(parseInt(e.target.value, 10))}
                    className="w-full accent-[#AC854B]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label htmlFor="price-min-mobile" className="text-[10px] uppercase text-[#3A3A3A] block mb-1">
                      Min (FCFA)
                    </label>
                    <input
                      id="price-min-mobile"
                      type="number"
                      value={filters.minPrice !== undefined ? filters.minPrice : ''}
                      placeholder={minCatalogPrice.toString()}
                      onChange={(e) => handleMinPriceChange(e.target.value)}
                      className="w-full text-xs bg-[#FAF9F7] p-2 border border-[#002141]/15"
                    />
                  </div>
                  <div>
                    <label htmlFor="price-max-mobile" className="text-[10px] uppercase text-[#3A3A3A] block mb-1">
                      Max (FCFA)
                    </label>
                    <input
                      id="price-max-mobile"
                      type="number"
                      value={filters.maxPrice !== undefined ? filters.maxPrice : ''}
                      placeholder={maxCatalogPrice.toString()}
                      onChange={(e) => handleMaxPriceChange(e.target.value)}
                      className="w-full text-xs bg-[#FAF9F7] p-2 border border-[#002141]/15"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Marque Mobile */}
              <div className="space-y-3 pb-5 border-b border-[#002141]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#AC854B]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                      Marque
                    </h4>
                  </div>
                  {filters.brand.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, brand: [] }))}
                      className="text-[10px] text-[#AC854B] underline"
                    >
                      Effacer
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {facetOptions.brands.map((brand) => {
                    const isChecked = filters.brand.includes(brand);
                    const count = facetOptions.brandCounts[brand] || 0;
                    return (
                      <label
                        key={`mobile-brand-${brand}`}
                        className={`flex items-center justify-between p-2 rounded-xs text-xs cursor-pointer ${
                          isChecked ? 'bg-[#FAF9F7] font-semibold text-[#002141]' : 'text-[#3A3A3A]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleArrayFilter('brand', brand)}
                            className="rounded-xs"
                          />
                          <span>{brand}</span>
                        </div>
                        <span className="text-[11px] px-1.5 py-0.5 bg-white border border-[#002141]/10 text-[#3A3A3A]">
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 3. Catégorie Mobile */}
              <div className="space-y-3 pb-5 border-b border-[#002141]/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#AC854B]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                      Catégorie
                    </h4>
                  </div>
                  {filters.category.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, category: [] }))}
                      className="text-[10px] text-[#AC854B] underline"
                    >
                      Effacer
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {facetOptions.categories.map((cat) => {
                    const isChecked = filters.category.includes(cat);
                    const count = facetOptions.categoryCounts[cat] || 0;
                    return (
                      <label
                        key={`mobile-cat-${cat}`}
                        className={`flex items-center justify-between p-2 rounded-xs text-xs cursor-pointer ${
                          isChecked ? 'bg-[#FAF9F7] font-semibold text-[#002141]' : 'text-[#3A3A3A]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleArrayFilter('category', cat)}
                            className="rounded-xs"
                          />
                          <span>{CATEGORY_NAMES[cat] || cat}</span>
                        </div>
                        <span className="text-[11px] px-1.5 py-0.5 bg-white border border-[#002141]/10 text-[#3A3A3A]">
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 4. Mouvement Mobile */}
              {facetOptions.movements.length > 0 && (
                <div className="space-y-3 pb-5 border-b border-[#002141]/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                    Mouvement
                  </h4>
                  <div className="space-y-2">
                    {facetOptions.movements.map((mov) => (
                      <label key={`mobile-mov-${mov}`} className="flex items-center gap-2 text-xs text-[#002141]">
                        <input
                          type="checkbox"
                          checked={filters.movement.includes(mov)}
                          onChange={() => toggleArrayFilter('movement', mov)}
                          className="rounded-xs"
                        />
                        <span>{mov}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Disponibilité Mobile */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#002141]">
                  Disponibilité
                </h4>
                <div className="space-y-2">
                  {facetOptions.availabilities.map((avail) => (
                    <label key={`mobile-avail-${avail}`} className="flex items-center gap-2 text-xs text-[#002141]">
                      <input
                        type="checkbox"
                        checked={filters.availability.includes(avail)}
                        onChange={() => toggleArrayFilter('availability', avail)}
                        className="rounded-xs"
                      />
                      <span>{avail}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-[#002141]/10 space-y-2">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-3.5 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest transition-colors cursor-pointer"
              >
                AFFICHER ({filteredProducts.length} {filteredProducts.length > 1 ? 'PIÈCES' : 'PIÈCE'})
              </button>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full py-2.5 bg-transparent text-[#002141] text-xs font-semibold uppercase tracking-widest border border-[#002141]/20 hover:border-[#AC854B] transition-colors cursor-pointer"
                >
                  RÉINITIALISER TOUS LES FILTRES
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

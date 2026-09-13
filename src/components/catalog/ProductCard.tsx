import React from 'react';
import { Product } from '../../types';
import { formatXOF } from '../../data/products';
import { useStore } from '../../context/StoreContext';
import { usePublicContent } from '../../lib/public-content';
import { ArrowRight, ShoppingBag, Heart, Star } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  navigate: (route: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, navigate }) => {
  const { addToCart, isInWishlist, toggleWishlist } = useStore();
  const { reviews } = usePublicContent();
  const isFavorite = isInWishlist(product.id);

  const productReviews = (reviews || []).filter((review) => {
    const rating = Number(review.rating);
    return String(review.product_id) === String(product.id) && Number.isInteger(rating) && rating >= 1 && rating <= 5;
  });
  const reviewCount = productReviews.length;
  const averageRating = reviewCount > 0 ? (productReviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviewCount).toFixed(1) : null;

  const handleCardClick = () => {
    navigate(`/montres/${product.slug}`);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <div
      onClick={handleCardClick}
      className="premium-product-card group bg-white border border-[#002141]/10 flex flex-col justify-between overflow-hidden hover:border-[#AC854B] cursor-pointer"
    >
      {/* Visual Container (Ratio 4:5 compliant) */}
      <div className="relative aspect-4/5 w-full bg-[#FAF9F7] overflow-hidden p-6 flex items-center justify-center">
        <img
          src={product.primaryImage}
          alt={product.additionalImages[0]?.alt || product.name}
          className="premium-product-card__image w-full h-full object-contain will-change-transform"
          loading="lazy"
        />

        {/* Availability Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 ${
              product.stockStatus === 'En stock'
                ? 'bg-[#002141] text-[#FAF9F7]'
                : product.stockStatus === 'Stock limité'
                ? 'bg-[#AC854B] text-[#FAF9F7]'
                : 'bg-[#3A3A3A] text-[#FAF9F7]'
            }`}
          >
            {product.stockStatus}
          </span>
        </div>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={isFavorite ? `Retirer ${product.name} de la liste d'envies` : `Ajouter ${product.name} à la liste d'envies`}
          className={`absolute top-3 right-3 p-2 rounded-full shadow-xs border transition-all duration-200 cursor-pointer z-10 ${
            isFavorite
              ? 'bg-white text-[#AC854B] border-[#AC854B]/40 scale-105'
              : 'bg-white/85 hover:bg-white text-[#002141]/60 hover:text-[#AC854B] border-[#002141]/10'
          }`}
        >
          <Heart className={`w-4 h-4 transition-colors ${isFavorite ? 'fill-[#AC854B] text-[#AC854B]' : ''}`} />
        </button>

        {/* Quick Add Button overlay */}
        <button
          type="button"
          onClick={handleQuickAdd}
          aria-label={`Ajouter ${product.name} au panier`}
          className="absolute bottom-3 right-3 p-2.5 bg-white/90 hover:bg-[#002141] hover:text-[#FAF9F7] text-[#002141] rounded-full shadow-xs border border-[#002141]/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <ShoppingBag className="w-4 h-4" />
        </button>
      </div>

      {/* Product Content Block */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Reference */}
          <div className="flex items-center justify-between text-[11px] text-[#3A3A3A] mb-1.5">
            <span className="font-bold uppercase tracking-[0.16em] text-[#AC854B]">
              {product.brand}
            </span>
            <span className="font-mono text-[10px] text-[#3A3A3A]/70">
              {product.reference}
            </span>
          </div>

          {/* Model Name */}
          <h3 className="font-playfair text-base sm:text-lg font-bold text-[#002141] group-hover:text-[#AC854B] transition-colors line-clamp-1 mb-1.5">
            {product.name}
          </h3>

          {/* Average rating badge (if reviews exist) */}
          {averageRating && (
            <div className="flex items-center gap-1.5 mb-2.5 text-xs">
              <div className="flex items-center text-[#AC854B]">
                <Star className="w-3.5 h-3.5 fill-[#AC854B]" />
              </div>
              <span className="font-semibold text-[#002141] text-[11px]">{averageRating}</span>
              <span className="text-[10px] text-[#3A3A3A]/60">({reviewCount} {reviewCount > 1 ? 'avis' : 'avis'})</span>
            </div>
          )}

          {/* Key Attributes summary */}
          <p className="text-xs text-[#3A3A3A]/80 line-clamp-2 leading-relaxed mb-4">
            {product.shortDescription}
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="pt-3 border-t border-[#002141]/10 flex items-center justify-between mt-auto">
          <div>
            <span className="text-[10px] uppercase font-medium tracking-wider text-[#3A3A3A]/70 block">
              Prix officiel
            </span>
            <span className="text-sm sm:text-base font-bold text-[#002141]">
              {formatXOF(product.priceXOF)}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#AC854B] group-hover:translate-x-1 transition-transform">
            <span>VOIR</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};

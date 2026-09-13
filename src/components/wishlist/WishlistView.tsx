import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { usePublicContent, xof as formatXOF } from '../../lib/public-content';
import { whatsappHref } from '../../lib/site-contact';
import { Product } from '../../types';
import {
  Heart,
  ShoppingBag,
  ArrowRight,
  Trash2,
  Share2,
  MessageCircle,
  ShieldCheck,
  Clock,
  Truck,
  Check
} from 'lucide-react';

interface WishlistViewProps {
  navigate: (route: string) => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({ navigate }) => {
  const {
    wishlist,
    removeFromWishlist,
    clearWishlist,
    addToCart,
    setCartToast
  } = useStore();
  const { products, siteSettings } = usePublicContent();

  const [copiedLink, setCopiedLink] = useState(false);
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});

  // Filter products that are in the user's wishlist
  const wishlistProducts = products.filter((product) => wishlist.includes(product.id));

  // Quick add single item to cart
  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
    setAddedItems((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [product.id]: false }));
    }, 2500);
  };

  // Add all in-stock products to cart
  const handleAddAllToCart = () => {
    const inStockItems = wishlistProducts.filter(
      (p) => p.stockStatus !== 'Indisponible' && p.stockCount > 0
    );

    if (inStockItems.length === 0) {
      setCartToast('Aucun article disponible en stock à ajouter.');
      return;
    }

    inStockItems.forEach((product) => {
      addToCart(product, 1);
    });

    setCartToast(
      `${inStockItems.length} article${inStockItems.length > 1 ? 's ont été ajoutés' : ' a été ajouté'} à votre panier.`
    );
  };

  // Share or copy link
  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Ma liste d'envies - HERITAGE Abidjan",
          text: "Découvrez ma sélection de montres et pièces de prestige sur HERITAGE.",
          url: shareUrl
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Ignore
    }
  };

  // Construct WhatsApp advice message with all wishlist items
  const whatsappMessage = `Bonjour HERITAGE, voici les modèles de ma liste d'envies que je souhaite commander ou réserver :\n${wishlistProducts
    .map((p, idx) => `${idx + 1}. ${p.brand} ${p.name} (Réf. ${p.reference}) - ${formatXOF(p.priceXOF)}`)
    .join('\n')}\n\nPouvez-vous me confirmer la disponibilité et les modalités de livraison à Abidjan ?`;

  const whatsappUrl = whatsappHref(siteSettings, whatsappMessage);

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
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
          <button
            type="button"
            onClick={() => navigate('/boutique')}
            className="hover:text-[#002141] transition-colors cursor-pointer"
          >
            Boutique
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Liste d'envies</span>
        </nav>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between pb-8 mb-10 border-b border-[#002141]/10 gap-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] mb-2">
              <Heart className="w-3.5 h-3.5 fill-[#AC854B]" />
              <span>SÉLECTION PERSONNELLE</span>
            </div>
            <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-[#002141] tracking-tight mb-3">
              Votre Liste d'Envies
            </h1>
            <p className="text-sm md:text-base text-[#4A4A4A] max-w-2xl leading-relaxed">
              Conservez vos pièces d'exception favorites, comparez leurs spécificités ou sollicitez
              notre atelier à Abidjan pour une présentation privée.
            </p>
          </div>

          {wishlistProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                id="wishlist-share-btn"
                onClick={handleShare}
                className="px-4 py-2.5 bg-white border border-[#002141]/15 text-[#002141] hover:border-[#AC854B] text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lien copié</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-[#AC854B]" />
                    <span>Partager</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="wishlist-clear-btn"
                onClick={clearWishlist}
                className="px-4 py-2.5 bg-white border border-[#002141]/15 text-rose-700 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider la liste</span>
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {wishlistProducts.length === 0 ? (
          <div className="bg-white border border-[#002141]/10 p-12 sm:p-20 text-center max-w-2xl mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#FAF9F7] border border-[#002141]/10 flex items-center justify-center mx-auto mb-6 text-[#AC854B]">
              <Heart className="w-8 h-8 stroke-[1.5]" />
            </div>

            <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141] mb-3">
              Votre liste d'envies est vide
            </h2>
            <p className="text-sm text-[#4A4A4A] leading-relaxed mb-8 max-w-md mx-auto">
              Vous n'avez pas encore sélectionné de pièces coup de cœur. Explorez notre catalogue
              de montres suisses et accessoires certifiés pour constituer votre liste.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                id="wishlist-empty-explore-btn"
                onClick={() => navigate('/boutique')}
                className="w-full sm:w-auto px-8 py-4 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.18em] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <span>DÉCOUVRIR LE CATALOGUE</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/montres')}
                className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-[#FAF9F7] border border-[#002141]/20 text-[#002141] text-xs font-bold uppercase tracking-[0.16em] transition-colors cursor-pointer"
              >
                <span>MONTRES SUISSES</span>
              </button>
            </div>

            {/* Quick Inspiration Pills */}
            <div className="mt-12 pt-8 border-t border-[#002141]/10">
              <p className="text-xs uppercase tracking-widest text-[#3A3A3A]/70 mb-4 font-semibold">
                Suggestions populaires
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: 'Tissot PR516', slug: 'tissot-pr516-40mm-t149-417-11-011-00' },
                  { label: 'Tissot Le Locle 20th', slug: 'tissot-le-locle-20th-anniversary-t006-407-11-033-03' },
                  { label: 'Tissot Seastar 1000', slug: 'tissot-seastar-1000-40mm-t120-410-33-051-00' },
                  { label: 'Chemin Des Tourelles', slug: 'tissot-chemin-des-tourelles-42mm-t139-407-22-038-00' }
                ].map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => navigate(`/montres/${item.slug}`)}
                    className="text-xs px-3.5 py-1.5 bg-[#FAF9F7] hover:bg-[#002141] hover:text-white border border-[#002141]/10 transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Populated Wishlist Layout */
          <div className="space-y-10">
            {/* Top Bar Summary & Quick Actions */}
            <div className="bg-white border border-[#002141]/10 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#AC854B]" />
                <span className="text-sm font-semibold text-[#002141]">
                  {wishlistProducts.length} pièce{wishlistProducts.length > 1 ? 's' : ''} enregistrée{wishlistProducts.length > 1 ? 's' : ''} dans votre liste
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  id="wishlist-add-all-btn"
                  onClick={handleAddAllToCart}
                  className="w-full sm:w-auto px-5 py-3 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>TOUT AJOUTER AU PANIER</span>
                </button>

                {whatsappUrl && <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="wishlist-whatsapp-all-btn"
                  className="w-full sm:w-auto px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-[0.14em] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>DEMANDER CONSEIL SUR CETTE SÉLECTION</span>
                </a>}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {wishlistProducts.map((product) => {
                const isAdded = addedItems[product.id];
                const isOutOfStock =
                  product.stockStatus === 'Indisponible' || product.stockCount <= 0;

                return (
                  <div
                    key={product.id}
                    className="premium-product-card bg-white border border-[#002141]/10 flex flex-col justify-between overflow-hidden group hover:border-[#AC854B] relative"
                  >
                    {/* Visual Container */}
                    <div
                      onClick={() => navigate(`/montres/${product.slug}`)}
                      className="relative aspect-4/5 w-full bg-[#FAF9F7] overflow-hidden p-6 flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={product.primaryImage}
                        alt={product.name}
                        className="premium-product-card__image w-full h-full object-contain will-change-transform"
                        loading="lazy"
                      />

                      {/* Stock Status Badge */}
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

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromWishlist(product.id);
                        }}
                        aria-label={`Retirer ${product.name} de la liste d'envies`}
                        className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-full shadow-xs border border-rose-200 transition-colors cursor-pointer"
                        title="Retirer des favoris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Product Details */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Brand & Reference */}
                        <div className="flex items-center justify-between text-[11px] text-[#3A3A3A] mb-1.5">
                          <span className="font-bold uppercase tracking-[0.16em] text-[#AC854B]">
                            {product.brand}
                          </span>
                          <span className="text-[10px] tracking-wider text-[#3A3A3A]/70">
                            RÉF. {product.reference}
                          </span>
                        </div>

                        {/* Title */}
                        <h3
                          onClick={() => navigate(`/montres/${product.slug}`)}
                          className="font-playfair text-lg font-bold text-[#002141] hover:text-[#AC854B] transition-colors leading-snug mb-3 cursor-pointer line-clamp-2"
                        >
                          {product.name}
                        </h3>

                        {/* Specs Pills */}
                        <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] text-[#3A3A3A]/80 font-medium">
                          {product.attributes?.mouvement && (
                            <span className="bg-[#FAF9F7] border border-[#002141]/10 px-2 py-0.5">
                              {product.attributes.mouvement}
                            </span>
                          )}
                          {product.attributes?.diametre && (
                            <span className="bg-[#FAF9F7] border border-[#002141]/10 px-2 py-0.5">
                              {product.attributes.diametre}
                            </span>
                          )}
                          {product.attributes?.verre && (
                            <span className="bg-[#FAF9F7] border border-[#002141]/10 px-2 py-0.5">
                              {product.attributes.verre}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price & Action CTA */}
                      <div className="pt-4 border-t border-[#002141]/10">
                        <div className="flex items-baseline justify-between mb-4">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/70 block">
                              PRIX ABIDJAN
                            </span>
                            <span className="font-playfair text-xl font-bold text-[#002141]">
                              {formatXOF(product.priceXOF)}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#3A3A3A]/70">
                            {product.stockCount} dispo.
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddToCart(product)}
                            disabled={isOutOfStock}
                            className={`py-3 px-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                              isOutOfStock
                                ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                                : isAdded
                                ? 'bg-emerald-700 text-white'
                                : 'bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7]'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>AJOUTÉ</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>PANIER</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/montres/${product.slug}`)}
                            className="py-3 px-3 bg-[#FAF9F7] hover:bg-[#002141] hover:text-[#FAF9F7] text-[#002141] border border-[#002141]/20 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>DÉTAILS</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reassurance Banner */}
            <div className="mt-16 bg-white border border-[#002141]/10 p-8 sm:p-10 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex items-start gap-4">
                  <ShieldCheck className="w-6 h-6 text-[#AC854B] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-playfair text-base font-bold text-[#002141] mb-1">
                      Certificat d'Authenticité
                    </h3>
                    <p className="text-xs text-[#4A4A4A] leading-relaxed">
                      Chaque pièce de votre liste d'envies provient directement des circuits officiels
                      avec papiers et numéro de série vérifiable.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock className="w-6 h-6 text-[#AC854B] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-playfair text-base font-bold text-[#002141] mb-1">
                      Garantie Mécanisme 2 Ans
                    </h3>
                    <p className="text-xs text-[#4A4A4A] leading-relaxed">
                      Prise en charge intégrale assurée à Abidjan pour vos mouvements automatiques
                      et calibres à quartz suisses.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Truck className="w-6 h-6 text-[#AC854B] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-playfair text-base font-bold text-[#002141] mb-1">
                      Remise en Mains Propres
                    </h3>
                    <p className="text-xs text-[#4A4A4A] leading-relaxed">
                      Livraison discrète et assurée partout à Abidjan ou retrait exclusif sur
                      rendez-vous à {siteSettings?.address || 'notre Maison à Abidjan'}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

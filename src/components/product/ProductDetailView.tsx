import React, { useState } from 'react';
import { Product } from '../../types';
import { usePublicContent, xof as formatXOF } from '../../lib/public-content';
import { useStore } from '../../context/StoreContext';
import {
  ShieldCheck,
  Clock,
  Truck,
  MessageCircle,
  ShoppingBag,
  Check,
  ChevronRight,
  ZoomIn,
  Heart,
  Share2
} from 'lucide-react';
import { ShareModal } from './ShareModal';

interface ProductDetailViewProps {
  product: Product;
  navigate: (route: string) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, navigate }) => {
  const { addToCart, isInWishlist, toggleWishlist } = useStore();
  const { siteSettings } = usePublicContent();
  const isFavorite = isInWishlist(product.id);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const images = product.additionalImages.length > 0
    ? product.additionalImages
    : [{ url: product.primaryImage, alt: product.name, isPrimary: true }];

  const currentImage = images[selectedImageIndex] || images[0];

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3000);
  };

  const whatsappMessage = `Bonjour HERITAGE, je souhaite un conseil au sujet de la pièce : ${product.name} (Réf. ${product.reference}).`;
  const whatsappNumber = (siteSettings?.whatsapp_phone || siteSettings?.phone || '').replace(/\D/g, '');
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}` : '';
  const applicableInformation = [
    { title: 'Provenance de la pièce', value: product.provenanceSummary, icon: ShieldCheck },
    { title: 'Garantie et service', value: product.warrantySummary, icon: Clock },
    { title: 'Livraison et retours', value: product.deliverySummary, icon: Truck }
  ].filter((item) => Boolean(item.value?.trim()));

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#002141] transition-colors"
          >
            Accueil
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate('/montres')}
            className="hover:text-[#002141] transition-colors"
          >
            Montres
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate('/montres')}
            className="hover:text-[#002141] transition-colors"
          >
            {product.brand}
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Main Product Layout: Gallery (Left) & Decision Block (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start mb-20">
          {/* Gallery Column */}
          <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4 sticky top-24">
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-20 sm:w-20 sm:h-24 p-2 bg-white border transition-all flex-shrink-0 cursor-pointer ${
                      selectedImageIndex === idx
                        ? 'border-[#AC854B] ring-1 ring-[#AC854B]'
                        : 'border-[#002141]/10 hover:border-[#002141]/30 opacity-70 hover:opacity-100'
                    }`}
                    aria-label={`Vue ${idx + 1}`}
                  >
                    <img
                      src={img.url}
                      alt={img.alt}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main Stage Image */}
            <div className="flex-1 bg-white border border-[#002141]/10 p-8 sm:p-12 relative overflow-hidden group">
              <div
                className={`relative aspect-4/5 w-full flex items-center justify-center cursor-zoom-in transition-transform duration-300 ${
                  isZoomed ? 'scale-125' : 'scale-100'
                }`}
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <img
                  src={currentImage.url}
                  alt={currentImage.alt}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Zoom hint, Share & Wishlist quick buttons */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  type="button"
                  id="pdp-quick-share"
                  onClick={() => setIsShareModalOpen(true)}
                  aria-label="Partager cette pièce"
                  title="Partager cette pièce"
                  className="p-2 rounded-full border shadow-xs bg-[#FAF9F7]/90 hover:bg-white text-[#002141] hover:text-[#AC854B] border-[#002141]/10 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  aria-label={isFavorite ? 'Retirer de la liste d\'envies' : 'Ajouter à la liste d\'envies'}
                  className={`p-2 rounded-full border shadow-xs transition-colors cursor-pointer ${
                    isFavorite
                      ? 'bg-white text-[#AC854B] border-[#AC854B]/50'
                      : 'bg-[#FAF9F7]/90 hover:bg-white text-[#002141] hover:text-[#AC854B] border-[#002141]/10'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#AC854B] text-[#AC854B]' : ''}`} />
                </button>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF9F7]/90 text-[10px] text-[#3A3A3A] border border-[#002141]/10 pointer-events-none">
                  <ZoomIn className="w-3.5 h-3.5 text-[#AC854B]" />
                  <span>Agrandir</span>
                </div>
              </div>

              {/* Status pill */}
              <div className="absolute top-4 left-4">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 ${
                    product.stockStatus === 'En stock'
                      ? 'bg-[#002141] text-[#FAF9F7]'
                      : 'bg-[#AC854B] text-[#FAF9F7]'
                  }`}
                >
                  {product.stockStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Decision Column (Right) */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              {/* Brand & Reference */}
              <div className="flex items-center justify-between text-xs text-[#3A3A3A] mb-2">
                <span className="font-bold uppercase tracking-[0.2em] text-[#AC854B]">
                  {product.brand}
                </span>
                <span className="font-mono text-xs text-[#3A3A3A]/80">
                  Réf. {product.reference}
                </span>
              </div>

              {/* H1 Title */}
              <h1 className="font-playfair text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#002141] leading-tight mb-4">
                {product.name}
              </h1>

              {/* Price */}
              <div className="pt-2 pb-4 border-b border-[#002141]/10">
                <span className="text-xs uppercase tracking-wider text-[#3A3A3A] block mb-1">
                  Prix officiel HERITAGE
                </span>
                <span className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141]">
                  {formatXOF(product.priceXOF)}
                </span>
                <span className="text-[11px] text-[#3A3A3A]/70 block mt-1">
                  Prix net en Francs CFA, contrôle de disponibilité inclus.
                </span>
              </div>
            </div>

            {/* Quick Summary */}
            <p className="text-xs sm:text-sm text-[#3A3A3A] leading-relaxed">
              {product.shortDescription}
            </p>

            {/* Purchase & Action Controls */}
            <div className="space-y-4 pt-2">
              {/* Quantity row */}
              <div className="flex items-center gap-4">
                <label htmlFor="pdp-qty" className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">
                  Quantité :
                </label>
                <div className="flex items-center border border-[#002141]/20 bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-xs font-bold text-[#002141] hover:bg-[#FAF9F7]"
                    aria-label="Diminuer"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 text-xs font-bold text-[#002141]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))}
                    disabled={quantity >= product.stockCount}
                    className="px-3 py-2 text-xs font-bold text-[#002141] hover:bg-[#FAF9F7] disabled:opacity-30"
                    aria-label="Augmenter"
                  >
                    +
                  </button>
                </div>
                <span className="text-[11px] text-[#3A3A3A]/70">
                  ({product.stockCount} disponible{product.stockCount > 1 ? 's' : ''} à Abidjan)
                </span>
              </div>

              {/* Primary CTA: Ajouter au panier */}
              <button
                type="button"
                id="pdp-add-to-cart"
                onClick={handleAddToCart}
                className="premium-cta w-full py-4 px-6 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-3 cursor-pointer shadow-sm"
              >
                {addedNotice ? (
                  <>
                    <Check className="w-4 h-4 text-[#D6BB8F]" />
                    <span>AJOUTÉ À VOTRE SÉLECTION</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>AJOUTER AU PANIER</span>
                  </>
                )}
              </button>

              {/* Secondary CTA: WhatsApp Conseil */}
              {whatsappUrl && <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                id="pdp-whatsapp-advisor"
                className="premium-cta w-full py-3.5 px-6 bg-white hover:bg-[#FAF9F7] text-[#002141] border border-[#002141]/20 text-xs font-bold uppercase tracking-[0.16em] flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-[#AC854B]" />
                <span>ÉCHANGER AVEC UN CONSEILLER</span>
              </a>}

              {/* Secondary Actions: Wishlist & Share */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="pdp-toggle-wishlist"
                  onClick={() => toggleWishlist(product)}
                  className={`w-full py-3 px-4 border text-xs font-bold uppercase tracking-[0.14em] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isFavorite
                      ? 'bg-[#AC854B]/10 border-[#AC854B] text-[#AC854B]'
                      : 'bg-white hover:bg-[#FAF9F7] text-[#002141] border-[#002141]/20 hover:border-[#AC854B]'
                  }`}
                >
                  <Heart className={`w-4 h-4 transition-colors ${isFavorite ? 'fill-[#AC854B] text-[#AC854B]' : ''}`} />
                  <span className="truncate">{isFavorite ? 'DANS VOS FAVORIS' : 'AJOUTER AUX FAVORIS'}</span>
                </button>

                <button
                  type="button"
                  id="pdp-open-share"
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-full py-3 px-4 bg-white hover:bg-[#FAF9F7] text-[#002141] border border-[#002141]/20 hover:border-[#AC854B] text-xs font-bold uppercase tracking-[0.14em] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#AC854B]" />
                  <span>PARTAGER LA PIÈCE</span>
                </button>
              </div>

              {/* Mandatory Micro-copy */}
              <p className="text-[11px] text-[#3A3A3A]/75 text-center leading-relaxed pt-1">
                Le prix et la disponibilité sont contrôlés à nouveau avant la validation de votre commande.
              </p>
            </div>

            {/* Reassurance strip */}
            {applicableInformation.length > 0 && <div className="pt-6 border-t border-[#002141]/10 space-y-3 text-xs text-[#3A3A3A]">{applicableInformation.map((item) => { const Icon = item.icon; return <div key={item.title} className="flex items-center gap-3"><Icon className="w-4 h-4 text-[#AC854B] flex-shrink-0" /><span>{item.value}</span></div>; })}</div>}
          </div>
        </div>

        {/* Value Story Section (Récit de valeur) */}
        {(product.valueStoryTitle || product.valueStoryText) && <div className="bg-white border border-[#002141]/10 p-8 sm:p-12 mb-16">
          <div className="max-w-3xl">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
              RÉCIT DE VALEUR
            </span>
            <h2 className="font-playfair text-xl sm:text-2xl font-bold text-[#002141] mb-4">
              {product.valueStoryTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#3A3A3A] leading-relaxed">
              {product.valueStoryText}
            </p>
          </div>
        </div>}

        {/* Horological Specifications Table */}
        <div className="bg-white border border-[#002141]/10 p-8 sm:p-12 mb-16">
          <div className="mb-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
              FICHE TECHNIQUE
            </span>
            <h2 className="font-playfair text-2xl font-bold text-[#002141]">
              Caractéristiques horlogères
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {Object.entries(product.attributes).map(([key, val]) => {
              const labelMapping: Record<string, string> = {
                modele: 'Modèle',
                reference: 'Référence',
                diametre: 'Diamètre du boîtier',
                boitier: 'Matière du boîtier',
                verre: 'Type de verre',
                fondDeBoite: 'Fond de boîte',
                mouvement: 'Type de calibre',
                reserveDeMarche: 'Réserve de marche',
                bracelet: 'Bracelet',
                etancheite: 'Étanchéité',
                cadran: 'Cadran',
                fabrication: 'Origine de fabrication'
              };
              const label = labelMapping[key] || key;
              return (
                <div
                  key={key}
                  className="flex items-baseline justify-between py-3 border-b border-[#002141]/10 text-xs sm:text-sm"
                >
                  <span className="text-[#3A3A3A] font-medium">{label}</span>
                  <span className="font-semibold text-[#002141] text-right ml-4">{val}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Applicable Conditions Section (Provenance, Garantie, Livraison) */}
        {applicableInformation.length > 0 && <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">{applicableInformation.map((item) => <div key={item.title} className="bg-white border border-[#002141]/10 p-6"><h3 className="font-playfair text-base font-bold text-[#002141] mb-2">{item.title}</h3><p className="text-xs text-[#3A3A3A] leading-relaxed">{item.value}</p></div>)}</div>}

        {/* Decision FAQ */}
        {product.faq.length > 0 && <div className="bg-white border border-[#002141]/10 p-8 sm:p-12 mb-16">
          <div className="max-w-3xl mb-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
              QUESTIONS FRÉQUENTES
            </span>
            <h2 className="font-playfair text-2xl font-bold text-[#002141]">
              FAQ de décision pour cette pièce
            </h2>
          </div>

          <div className="space-y-6 max-w-3xl">
            {product.faq.map((item, idx) => (
              <div key={idx} className="pb-6 border-b border-[#002141]/10 last:border-0 last:pb-0">
                <h4 className="font-semibold text-sm text-[#002141] mb-2">
                  {item.question}
                </h4>
                <p className="text-xs sm:text-sm text-[#3A3A3A] leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>

          {whatsappUrl && <div className="pt-8 mt-6 border-t border-[#002141]/10">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#002141] hover:text-[#AC854B] transition-colors"
            >
              <span>ÉCHANGER À PROPOS DE CETTE PIÈCE</span>
              <ChevronRight className="w-4 h-4 text-[#AC854B]" />
            </a>
          </div>}
        </div>}
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        product={product}
      />
    </div>
  );
};

import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatXOF } from '../../data/products';
import { ArrowRight, Trash2, ShieldCheck, Truck, Clock } from 'lucide-react';

interface CartViewProps {
  navigate: (route: string) => void;
}

export const CartView: React.FC<CartViewProps> = ({ navigate }) => {
  const { cart, updateQuantity, removeFromCart, cartSubtotal, cartItemCount } = useStore();

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
          <span className="text-[#002141] font-semibold">Panier</span>
        </nav>

        <div className="max-w-3xl mb-12">
          <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[#002141] mb-2">
            Votre sélection
          </h1>
          <p className="text-sm text-[#3A3A3A]">
            Vérifiez vos pièces horlogères avant de finaliser votre commande.
          </p>
        </div>

        {cart.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-[#002141]/10 p-12 sm:p-16 text-center max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#FAF9F7] border border-[#AC854B]/30 flex items-center justify-center text-[#AC854B]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="font-playfair text-2xl font-bold text-[#002141]">
              Votre sélection est encore vide.
            </h2>
            <p className="text-xs sm:text-sm text-[#3A3A3A] leading-relaxed max-w-md mx-auto">
              Prenez le temps de découvrir les pièces actuellement publiées et disponibles chez
              HERITAGE à Abidjan.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/montres')}
                className="premium-cta px-8 py-3.5 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] cursor-pointer"
              >
                DÉCOUVRIR LES MONTRES
              </button>
            </div>
          </div>
        ) : (
          /* Populated Cart Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Items List */}
            <div className="lg:col-span-8 bg-white border border-[#002141]/10 p-6 sm:p-8 space-y-6">
              <div className="border-b border-[#002141]/10 pb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#3A3A3A]">
                  Articles ({cartItemCount})
                </span>
                <span className="text-xs text-[#3A3A3A]">Prix unitaire</span>
              </div>

              <div className="divide-y divide-[#002141]/10">
                {cart.map(({ product, quantity }) => (
                  <div key={product.sku} className="py-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                    <div className="flex gap-4 items-center flex-1">
                      <img
                        src={product.primaryImage}
                        alt={product.name}
                        className="w-20 h-24 sm:w-24 sm:h-28 object-contain bg-[#FAF9F7] p-2 flex-shrink-0"
                      />
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#AC854B] block">
                          {product.brand} &middot; Réf. {product.reference}
                        </span>
                        <h3
                          onClick={() => navigate(`/montres/${product.slug}`)}
                          className="font-playfair text-base sm:text-lg font-bold text-[#002141] hover:text-[#AC854B] transition-colors cursor-pointer"
                        >
                          {product.name}
                        </h3>
                        <p className="text-xs text-[#3A3A3A]/70 mt-1">
                          {product.attributes.mouvement} &middot; {product.attributes.diametre}
                        </p>

                        <button
                          type="button"
                          onClick={() => removeFromCart(product.sku)}
                          className="inline-flex items-center gap-1.5 text-xs text-[#3A3A3A]/60 hover:text-red-600 transition-colors mt-3"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Retirer de la sélection</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-[#002141]/20 bg-[#FAF9F7]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.sku, quantity - 1)}
                          className="px-2.5 py-1 text-xs text-[#002141] hover:bg-[#002141]/5"
                        >
                          -
                        </button>
                        <span className="px-3 py-1 text-xs font-bold text-[#002141]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.sku, quantity + 1)}
                          disabled={quantity >= product.stockCount}
                          className="px-2.5 py-1 text-xs text-[#002141] hover:bg-[#002141]/5 disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="font-playfair text-base sm:text-lg font-bold text-[#002141]">
                          {formatXOF(product.priceXOF * quantity)}
                        </span>
                        {quantity > 1 && (
                          <span className="text-[10px] text-[#3A3A3A]/70 block">
                            ({formatXOF(product.priceXOF)} / pièce)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="lg:col-span-4 bg-white border border-[#002141]/10 p-6 sm:p-8 space-y-6 sticky top-24">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#002141] pb-4 border-b border-[#002141]/10">
                Récapitulatif de commande
              </h2>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between text-[#3A3A3A]">
                  <span>Sous-total articles</span>
                  <span className="font-semibold text-[#002141]">{formatXOF(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[#3A3A3A]">
                  <span>Livraison sécurisée</span>
                  <span className="text-xs font-medium text-[#3A3A3A]">Calculée à l'étape suivante</span>
                </div>
                <div className="pt-3 border-t border-[#002141]/10 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#002141]">Total indicatif</span>
                  <span className="font-playfair text-xl font-bold text-[#002141]">
                    {formatXOF(cartSubtotal)}
                  </span>
                </div>
              </div>

              {/* Mandatory micro-copy */}
              <p className="text-[11px] text-[#3A3A3A]/75 leading-relaxed bg-[#FAF9F7] p-3 border border-[#002141]/5">
                Le prix et la disponibilité sont contrôlés à nouveau avant la validation de votre commande.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  id="cart-proceed-checkout"
                  onClick={() => navigate('/commande')}
                  className="premium-cta w-full py-4 px-6 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-3 cursor-pointer shadow-sm"
                >
                  <span>PASSER À LA COMMANDE</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/montres')}
                  className="w-full py-3 px-6 bg-transparent hover:bg-[#FAF9F7] text-[#002141] border border-[#002141]/20 text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer text-center"
                >
                  DÉCOUVRIR LES MONTRES
                </button>
              </div>

              {/* Reassurance pills */}
              <div className="pt-4 border-t border-[#002141]/10 space-y-2 text-xs text-[#3A3A3A]/80">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#AC854B]" />
                  <span>Validation directe et transmission WhatsApp</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#AC854B]" />
                  <span>Remise en main propre ou livraison à Abidjan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#AC854B]" />
                  <span>Garantie manufacture suisse de 2 ans</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

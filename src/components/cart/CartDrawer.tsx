import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatXOF } from '../../data/products';
import { X, Trash2, ArrowRight, ShieldCheck } from 'lucide-react';

interface CartDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  navigate: (route: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  navigate,
}) => {
  const {
    isCartOpen: storeIsOpen,
    setIsCartOpen,
    cart,
    updateQuantity,
    removeFromCart,
    cartSubtotal,
    cartItemCount
  } = useStore();

  const isCartOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen;

  const handleClose = () => {
    if (propOnClose) propOnClose();
    setIsCartOpen(false);
  };

  if (!isCartOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#002141]/70 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Panier d'achats"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md bg-[#FAF9F7] h-full shadow-2xl flex flex-col justify-between overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#002141]/10 flex items-center justify-between bg-white">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#AC854B] block">
              Panier HERITAGE
            </span>
            <h2 className="font-playfair text-xl font-bold text-[#002141]">
              Votre sélection ({cartItemCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -mr-2 text-[#3A3A3A] hover:text-[#002141] cursor-pointer"
            aria-label="Fermer le panier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Items Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cart.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#E8E1D3]/50 flex items-center justify-center text-[#AC854B]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="font-playfair text-base text-[#002141] font-bold">
                Votre sélection est encore vide.
              </p>
              <p className="text-xs text-[#3A3A3A] max-w-xs mx-auto leading-relaxed">
                Prenez le temps de découvrir les pièces horlogères actuellement publiées et disponibles chez HERITAGE.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/montres');
                    setIsCartOpen(false);
                  }}
                  className="premium-cta px-6 py-2.5 bg-[#002141] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest hover:bg-[#AC854B] cursor-pointer"
                >
                  DÉCOUVRIR LES MONTRES
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(({ product, quantity }) => (
                <div
                  key={product.sku}
                  className="flex gap-4 p-4 bg-white border border-[#002141]/5 relative"
                >
                  <img
                    src={product.primaryImage}
                    alt={product.name}
                    className="w-20 h-24 object-contain bg-[#FAF9F7] p-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-[#AC854B] block">
                        {product.brand}
                      </span>
                      <h4 className="font-playfair text-sm font-bold text-[#002141] truncate">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-[#3A3A3A]/70 truncate">
                        Réf. {product.reference}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#002141]/5">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-[#002141]/20 bg-[#FAF9F7]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.sku, quantity - 1)}
                          className="px-2 py-0.5 text-xs text-[#002141] hover:bg-[#002141]/5"
                          aria-label="Diminuer la quantité"
                        >
                          -
                        </button>
                        <span className="px-2.5 py-0.5 text-xs font-semibold text-[#002141]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.sku, quantity + 1)}
                          disabled={quantity >= product.stockCount}
                          className="px-2 py-0.5 text-xs text-[#002141] hover:bg-[#002141]/5 disabled:opacity-30"
                          aria-label="Augmenter la quantité"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-[#002141]">
                          {formatXOF(product.priceXOF * quantity)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeFromCart(product.sku)}
                    className="absolute top-2 right-2 text-[#3A3A3A]/40 hover:text-red-600 p-1"
                    aria-label="Retirer de la sélection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer with Subtotal & Checkout Action */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-[#002141]/10 bg-white space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-[#3A3A3A] font-semibold">
                Sous-total
              </span>
              <span className="font-playfair text-lg font-bold text-[#002141]">
                {formatXOF(cartSubtotal)}
              </span>
            </div>

            <p className="text-[11px] text-[#3A3A3A]/75 leading-tight">
              Le prix et la disponibilité sont contrôlés à nouveau avant la validation finale de votre commande.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigate('/commande');
                  setIsCartOpen(false);
                }}
                className="premium-cta w-full py-3 px-4 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>FINALISER MA COMMANDE</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate('/panier');
                  setIsCartOpen(false);
                }}
                className="w-full py-2.5 px-4 bg-[#FAF9F7] hover:bg-[#E8E1D3]/50 text-[#002141] text-xs font-semibold uppercase tracking-widest border border-[#002141]/20 transition-colors cursor-pointer"
              >
                VOIR LE PANIER DÉTAILLÉ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

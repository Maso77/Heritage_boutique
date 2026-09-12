import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatXOF } from '../../data/products';
import { OrderCustomer } from '../../types';
import {
  ShieldCheck,
  Truck,
  MapPin,
  ArrowRight,
  AlertCircle,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';

interface CheckoutViewProps {
  navigate: (route: string) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({ navigate }) => {
  const { cart, cartSubtotal, createOrder } = useStore();

  const [customer, setCustomer] = useState<OrderCustomer>({
    fullName: '',
    email: '',
    phone: '',
    commune: 'Cocody',
    deliveryAddress: '',
    notes: '',
    deliveryMode: 'livraison_abidjan'
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const deliveryCost = customer.deliveryMode === 'livraison_abidjan' ? 5000 : 0;
  const totalAmount = cartSubtotal + deliveryCost;

  const abidjanCommunes = [
    'Cocody',
    'Plateau',
    'Yopougon',
    'Marcory',
    'Treichville',
    'Port-Bouët',
    'Koumassi',
    'Adjamé',
    'Attécoubé',
    'Abobo',
    'Bingerville',
    'Songon'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Votre sélection est vide.');
      return;
    }

    if (!customer.fullName.trim()) {
      setErrorMsg('Veuillez renseigner votre nom complet.');
      return;
    }

    if (!customer.email.trim() || !customer.email.includes('@')) {
      setErrorMsg('Veuillez renseigner une adresse email valide.');
      return;
    }

    if (!customer.phone.trim()) {
      setErrorMsg('Veuillez renseigner votre numéro de téléphone ou WhatsApp.');
      return;
    }

    if (customer.deliveryMode === 'livraison_abidjan' && !customer.deliveryAddress.trim()) {
      setErrorMsg('Veuillez indiquer une adresse ou un repère de livraison à Abidjan.');
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('Veuillez accepter les Conditions Générales de Vente.');
      return;
    }

    setIsProcessing(true);

    // Create server order record with direct command validation
    setTimeout(() => {
      createOrder(customer, 'transmission_whatsapp');
      setIsProcessing(false);
      navigate('/commande/confirmation');
    }, 600);
  };

  if (cart.length === 0) {
    return (
      <div className="bg-[#FAF9F7] min-h-screen pt-28 pb-20">
        <div className="max-w-md mx-auto px-4 text-center space-y-6 bg-white p-8 border border-[#002141]/10">
          <h2 className="font-playfair text-xl font-bold text-[#002141]">
            Votre panier est vide
          </h2>
          <p className="text-xs text-[#3A3A3A]">
            Veuillez ajouter une pièce horlogère à votre sélection avant de valider votre commande.
          </p>
          <button
            type="button"
            onClick={() => navigate('/montres')}
            className="px-6 py-3 bg-[#002141] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest"
          >
            DÉCOUVRIR LES MONTRES
          </button>
        </div>
      </div>
    );
  }

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
            onClick={() => navigate('/panier')}
            className="hover:text-[#002141] transition-colors"
          >
            Panier
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Validation de commande</span>
        </nav>

        <div className="max-w-3xl mb-10">
          <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[#002141] mb-2">
            Finaliser votre commande
          </h1>
          <p className="text-sm text-[#3A3A3A]">
            Renseignez vos coordonnées pour la livraison de vos pièces à Abidjan et transmettez directement votre commande à nos conseillers.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Form Section */}
            <div className="lg:col-span-8 space-y-8">
              {/* Step 1: Coordonnées */}
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#002141]/10">
                  <span className="w-6 h-6 rounded-full bg-[#002141] text-[#FAF9F7] text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141]">
                    Vos coordonnées de livraison
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      required
                      value={customer.fullName}
                      onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
                      placeholder="Ex: Kouassi Marc"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Adresse e-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      placeholder="contact@exemple.ci"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Téléphone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Mode de réception */}
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#002141]/10">
                  <span className="w-6 h-6 rounded-full bg-[#002141] text-[#FAF9F7] text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141]">
                    Mode de réception à Abidjan
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <label
                    className={`p-4 border cursor-pointer flex flex-col justify-between transition-colors ${
                      customer.deliveryMode === 'livraison_abidjan'
                        ? 'border-[#AC854B] bg-[#FAF9F7]'
                        : 'border-[#002141]/15 hover:border-[#002141]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-[#AC854B]" />
                        <span className="font-semibold text-xs text-[#002141]">
                          Livraison sécurisée
                        </span>
                      </div>
                      <input
                        type="radio"
                        name="deliveryMode"
                        checked={customer.deliveryMode === 'livraison_abidjan'}
                        onChange={() => setCustomer({ ...customer, deliveryMode: 'livraison_abidjan' })}
                        className="text-[#002141] focus:ring-[#AC854B]"
                      />
                    </div>
                    <p className="text-[11px] text-[#3A3A3A] mb-2">
                      Sous pli scellé remis en main propre à Abidjan.
                    </p>
                    <span className="font-bold text-xs text-[#002141]">5 000 FCFA</span>
                  </label>

                  <label
                    className={`p-4 border cursor-pointer flex flex-col justify-between transition-colors ${
                      customer.deliveryMode === 'retrait_yopougon'
                        ? 'border-[#AC854B] bg-[#FAF9F7]'
                        : 'border-[#002141]/15 hover:border-[#002141]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#AC854B]" />
                        <span className="font-semibold text-xs text-[#002141]">
                          Retrait sur rendez-vous
                        </span>
                      </div>
                      <input
                        type="radio"
                        name="deliveryMode"
                        checked={customer.deliveryMode === 'retrait_yopougon'}
                        onChange={() => setCustomer({ ...customer, deliveryMode: 'retrait_yopougon' })}
                        className="text-[#002141] focus:ring-[#AC854B]"
                      />
                    </div>
                    <p className="text-[11px] text-[#3A3A3A] mb-2">
                      Accueil à la Maison HERITAGE à Yopougon, Abidjan.
                    </p>
                    <span className="font-bold text-xs text-[#AC854B]">Gratuit</span>
                  </label>
                </div>

                {customer.deliveryMode === 'livraison_abidjan' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                        Commune d'Abidjan *
                      </label>
                      <select
                        value={customer.commune}
                        onChange={(e) => setCustomer({ ...customer, commune: e.target.value })}
                        className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                      >
                        {abidjanCommunes.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                        Adresse précise ou repère *
                      </label>
                      <input
                        type="text"
                        required
                        value={customer.deliveryAddress}
                        onChange={(e) => setCustomer({ ...customer, deliveryAddress: e.target.value })}
                        placeholder="Quartier, rue, repère connu..."
                        className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Information sur le processus */}
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#002141]/10">
                  <span className="w-6 h-6 rounded-full bg-[#002141] text-[#FAF9F7] text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141]">
                    Validation et transmission directes
                  </h2>
                </div>

                <div className="flex items-start gap-3.5 p-4 bg-[#FAF9F7] border border-[#002141]/10 text-xs text-[#3A3A3A] leading-relaxed">
                  <MessageSquare className="w-5 h-5 text-[#25D366] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#002141] block mb-1">
                      Enregistrement instantané & transmission WhatsApp
                    </span>
                    <p>
                      Aucun paiement en ligne n'est effectué sur ce site. Après validation de vos coordonnées, votre commande sera enregistrée et vous pourrez la transmettre directement par WhatsApp à notre conseiller pour convenir de la remise ou de la livraison à Abidjan.
                    </p>
                  </div>
                </div>
              </div>

              {/* CGV Checkbox */}
              <div className="bg-white border border-[#002141]/10 p-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 rounded-xs border-[#002141]/30 text-[#002141] focus:ring-[#AC854B]"
                  />
                  <span className="text-xs text-[#3A3A3A] leading-relaxed">
                    J'ai pris connaissance et j'accepte sans réserve les{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/cgv')}
                      className="underline text-[#002141] font-semibold"
                    >
                      Conditions Générales de Vente
                    </button>{' '}
                    et la{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/confidentialite')}
                      className="underline text-[#002141] font-semibold"
                    >
                      Politique de Confidentialité
                    </button>{' '}
                    de la Maison HERITAGE.
                  </span>
                </label>
              </div>
            </div>

            {/* Sidebar Summary Section */}
            <div className="lg:col-span-4 bg-white border border-[#002141]/10 p-6 sm:p-8 space-y-6 sticky top-24">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#002141] pb-4 border-b border-[#002141]/10">
                Votre commande ({cart.length})
              </h2>

              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {cart.map(({ product, quantity }) => (
                  <div key={product.sku} className="flex gap-3 items-center justify-between text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={product.primaryImage}
                        alt=""
                        className="w-12 h-14 object-contain bg-[#FAF9F7] p-1 flex-shrink-0"
                      />
                      <div className="truncate">
                        <span className="font-semibold text-[#002141] block truncate">
                          {product.name}
                        </span>
                        <span className="text-[11px] text-[#3A3A3A]/70">
                          Qté : {quantity} &middot; Réf. {product.reference}
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold text-[#002141] flex-shrink-0">
                      {formatXOF(product.priceXOF * quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#002141]/10 space-y-2 text-xs">
                <div className="flex justify-between text-[#3A3A3A]">
                  <span>Sous-total</span>
                  <span className="font-medium text-[#002141]">{formatXOF(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[#3A3A3A]">
                  <span>Livraison</span>
                  <span className="font-medium text-[#002141]">
                    {deliveryCost === 0 ? 'Gratuite (Retrait)' : formatXOF(deliveryCost)}
                  </span>
                </div>
                <div className="pt-3 border-t border-[#002141]/10 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#002141]">Montant total</span>
                  <span className="font-playfair text-xl font-bold text-[#002141]">
                    {formatXOF(totalAmount)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                id="checkout-pay-button"
                className="premium-cta w-full py-4 px-6 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isProcessing ? (
                  <span>VALIDATION EN COURS...</span>
                ) : (
                  <>
                    <span>VALIDER MA COMMANDE</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-[#3A3A3A]/75 text-center leading-relaxed">
                Le prix et la disponibilité sont contrôlés à nouveau avant la validation.
              </p>

              <div className="pt-4 border-t border-[#002141]/10 space-y-2 text-xs text-[#3A3A3A]/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#AC854B]" />
                  <span>Enregistrement sécurisé de votre commande</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#AC854B]" />
                  <span>Conseiller dédié & suivi à Abidjan</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

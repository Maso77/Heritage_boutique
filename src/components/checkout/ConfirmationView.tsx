import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatXOF } from '../../data/products';
import { CheckCircle, Phone, MapPin, MessageSquare } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';
import { whatsappHref } from '../../lib/site-contact';

interface ConfirmationViewProps {
  navigate: (route: string) => void;
}

export const ConfirmationView: React.FC<ConfirmationViewProps> = ({ navigate }) => {
  const { currentOrder } = useStore();
  const { siteSettings } = usePublicContent();

  if (!currentOrder) {
    return (
      <div className="bg-[#FAF9F7] min-h-screen pt-28 pb-20">
        <div className="max-w-md mx-auto px-4 text-center space-y-6 bg-white p-8 border border-[#002141]/10">
          <h2 className="font-playfair text-xl font-bold text-[#002141]">
            Aucune commande récente trouvée
          </h2>
          <p className="text-xs text-[#3A3A3A]">
            Vous pouvez consulter votre historique de commandes depuis votre espace client.
          </p>
          <button
            type="button"
            onClick={() => navigate('/compte')}
            className="px-6 py-3 bg-[#002141] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest cursor-pointer"
          >
            VOIR MON COMPTE
          </button>
        </div>
      </div>
    );
  }

  // Pre-filled WhatsApp message generator
  const orderItemsSummary = currentOrder.items
    ? currentOrder.items.map((i) => `• ${i.quantity}x ${i.product.name} (${formatXOF(i.product.priceXOF * i.quantity)})`).join('\n')
    : '';

  const whatsappMessage = `Bonjour HERITAGE,

Je viens de valider ma commande N° *${currentOrder.orderNumber}* sur le site.

*Détails du client :*
• Nom : ${currentOrder.customer.fullName}
• Téléphone : ${currentOrder.customer.phone}
• Email : ${currentOrder.customer.email}

*Mode de réception :*
${currentOrder.customer.deliveryMode === 'livraison_abidjan' ? `• Livraison à Abidjan (${currentOrder.customer.commune}) - ${currentOrder.customer.deliveryAddress || ''}` : `• Retrait sur rendez-vous à la Maison HERITAGE${siteSettings?.address ? ` (${siteSettings.address})` : ''}`}

*Articles commandés :*
${orderItemsSummary}

*Total indicatif :* ${formatXOF(currentOrder.totalXOF)}

Merci de me recontacter pour finaliser la livraison.`;

  const whatsappUrl = whatsappHref(siteSettings, whatsappMessage);

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Banner */}
        <div className="bg-white border border-[#002141]/10 p-8 sm:p-12 text-center mb-8 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#FAF9F7] border border-[#AC854B]/30 flex items-center justify-center text-[#AC854B] mb-6">
            <CheckCircle className="w-8 h-8 text-[#AC854B]" />
          </div>

          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
            COMMANDE ENREGISTRÉE AVEC SUCCÈS
          </span>

          <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[#002141] mb-4">
            Merci pour votre confiance
          </h1>

          <p className="text-sm text-[#3A3A3A] max-w-lg mx-auto leading-relaxed mb-6">
            Votre commande a bien été soumise et enregistrée auprès de nos services. Pour une prise en charge prioritaire et convenir de votre créneau de livraison à Abidjan, vous pouvez l'envoyer directement par WhatsApp.
          </p>

          {/* Prominent WhatsApp CTA Button */}
          {whatsappUrl && <div className="max-w-md mx-auto mb-6">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold uppercase tracking-[0.16em] flex items-center justify-center gap-3 shadow-md transition-all rounded-xs cursor-pointer"
            >
              <MessageSquare className="w-5 h-5 flex-shrink-0" />
              <span>TRANSMETTRE LA COMMANDE PAR WHATSAPP</span>
            </a>
          </div>}

          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-4 bg-[#FAF9F7] border border-[#002141]/10 text-xs text-[#3A3A3A]">
            <div>
              <span className="text-[#3A3A3A]/70 block">Numéro de commande :</span>
              <strong className="font-mono text-sm text-[#002141]">{currentOrder.orderNumber}</strong>
            </div>
            <span className="hidden sm:inline text-[#002141]/20">|</span>
            <div>
              <span className="text-[#3A3A3A]/70 block">Statut de la commande :</span>
              <span className="font-bold text-[#002141] uppercase tracking-wider">
                Enregistrée — En attente de livraison
              </span>
            </div>
          </div>
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
          {/* Purchased Items */}
          <div className="md:col-span-7 bg-white border border-[#002141]/10 p-6 sm:p-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141] pb-4 mb-4 border-b border-[#002141]/10">
              Pièces sélectionnées
            </h2>

            <div className="divide-y divide-[#002141]/10">
              {currentOrder.items.map(({ product, quantity }) => (
                <div key={product.sku} className="py-4 flex gap-4 items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <img
                      src={product.primaryImage}
                      alt=""
                      className="w-14 h-18 object-contain bg-[#FAF9F7] p-1 flex-shrink-0"
                    />
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#AC854B] block">
                        {product.brand}
                      </span>
                      <h4 className="font-playfair text-sm font-bold text-[#002141]">
                        {product.name}
                      </h4>
                      <span className="text-xs text-[#3A3A3A]/70">
                        Qté : {quantity} &middot; Réf. {product.reference}
                      </span>
                    </div>
                  </div>
                  <span className="font-semibold text-xs text-[#002141]">
                    {formatXOF(product.priceXOF * quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#002141]/10 space-y-2 text-xs">
              <div className="flex justify-between text-[#3A3A3A]">
                <span>Sous-total</span>
                <span>{formatXOF(currentOrder.subtotalXOF)}</span>
              </div>
              <div className="flex justify-between text-[#3A3A3A]">
                <span>Frais de remise</span>
                <span>
                  {currentOrder.deliveryCostXOF === 0
                    ? 'Gratuit (Retrait sur rendez-vous)'
                    : formatXOF(currentOrder.deliveryCostXOF)}
                </span>
              </div>
              <div className="pt-3 border-t border-[#002141]/10 flex justify-between items-baseline">
                <span className="text-sm font-bold text-[#002141]">Montant total</span>
                <span className="font-playfair text-lg font-bold text-[#002141]">
                  {formatXOF(currentOrder.totalXOF)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery & Next Steps */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141] pb-4 mb-4 border-b border-[#002141]/10">
                Mode de réception
              </h2>

              <div className="space-y-3 text-xs text-[#3A3A3A]">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#AC854B] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#002141] block">
                      {currentOrder.customer.deliveryMode === 'livraison_abidjan'
                        ? `Livraison à ${currentOrder.customer.commune}`
                        : 'Retrait sur rendez-vous à la Maison HERITAGE'}
                    </span>
                    {currentOrder.customer.deliveryAddress && (
                      <span className="text-[#3A3A3A]/80 block mt-0.5">
                        {currentOrder.customer.deliveryAddress}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-[#002141]/5">
                  <Phone className="w-4 h-4 text-[#AC854B] flex-shrink-0" />
                  <span>Contact : {currentOrder.customer.phone}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141] pb-4 mb-4 border-b border-[#002141]/10">
                Prochaines étapes
              </h2>

              <ol className="space-y-3 text-xs text-[#3A3A3A]">
                <li className="flex gap-2.5">
                  <span className="font-bold text-[#AC854B]">1.</span>
                  <span>Transmission du récapitulatif par WhatsApp ou prise de contact par notre conseiller.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-bold text-[#AC854B]">2.</span>
                  <span>Contrôle qualité horloger et mise sous scellé de vos pièces.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-bold text-[#AC854B]">3.</span>
                  <span>Remise en main propre ou livraison à l'adresse indiquée à Abidjan.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/compte')}
            className="premium-cta w-full sm:w-auto px-8 py-3.5 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] cursor-pointer text-center"
          >
            SUIVRE CETTE COMMANDE DANS MON COMPTE
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-[#FAF9F7] text-[#002141] border border-[#002141]/20 text-xs font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer text-center"
          >
            RETOURNER À L'ACCUEIL
          </button>
        </div>
      </div>
    </div>
  );
};

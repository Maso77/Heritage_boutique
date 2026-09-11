import React from 'react';
import { MessageCircle } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';

interface WhatsAppButtonProps {
  currentRoute?: string;
  activeReference?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ currentRoute = '', activeReference }) => {
  const { siteSettings } = usePublicContent();
  const route = currentRoute || (typeof window !== 'undefined' ? window.location.pathname : '');

  // Never display floating WhatsApp button on checkout or cart to prevent covering critical payment CTAs
  if (
    route === '/commande' ||
    route === '/panier' ||
    route.startsWith('/commande/')
  ) {
    return null;
  }

  const messageText = activeReference
    ? `Bonjour HERITAGE, je souhaite un conseil au sujet de la référence ${activeReference}.`
    : 'Bonjour HERITAGE, je souhaite échanger avec un conseiller au sujet de votre sélection de montres.';

  const whatsappNumber = (siteSettings?.whatsapp_phone || siteSettings?.phone || '').replace(/\D/g, '');
  if (!whatsappNumber) return null;
  const encodedUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageText)}`;

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <a
        href={encodedUrl}
        target="_blank"
        rel="noopener noreferrer"
        id="floating-whatsapp-concierge"
        aria-label="Échanger avec un conseiller HERITAGE sur WhatsApp"
        className="group flex items-center gap-2.5 bg-[#002141] hover:bg-[#001730] text-[#FAF9F7] px-4 py-3 rounded-full shadow-xl border border-[#AC854B]/40 transition-transform duration-200 hover:scale-105"
      >
        <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center text-white flex-shrink-0">
          <MessageCircle className="w-3.5 h-3.5 fill-current" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#D6BB8F]">
            Conseil Direct
          </span>
          <span className="text-xs font-semibold tracking-wide">
            Échanger avec HERITAGE
          </span>
        </div>
      </a>
    </div>
  );
};

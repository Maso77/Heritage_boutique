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
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      <a
        href={encodedUrl}
        target="_blank"
        rel="noopener noreferrer"
        id="floating-whatsapp-concierge"
        aria-label="Échanger avec un conseiller HERITAGE sur WhatsApp"
        className="group flex items-center gap-2 sm:gap-2.5 bg-[#002141] hover:bg-[#001730] text-[#FAF9F7] px-3 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-2xl border border-[#AC854B]/40 transition-transform duration-200 hover:scale-105"
      >
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#25D366] flex items-center justify-center text-white flex-shrink-0">
          <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-[#D6BB8F]">
            Conseil Direct
          </span>
          <span className="text-[11px] sm:text-xs font-semibold tracking-wide hidden sm:inline">
            Échanger avec HERITAGE
          </span>
          <span className="text-[10px] font-semibold tracking-wide sm:hidden">
            WhatsApp
          </span>
        </div>
      </a>
    </div>
  );
};

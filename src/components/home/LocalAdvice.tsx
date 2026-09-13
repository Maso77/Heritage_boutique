import React from 'react';
import { MessageCircle, Phone, MapPin } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';
import { whatsappHref } from '../../lib/site-contact';

interface LocalAdviceProps {
  navigate: (route: string) => void;
}

export const LocalAdvice: React.FC<LocalAdviceProps> = ({ navigate }) => {
  const { siteSettings } = usePublicContent();
  const whatsappUrl = whatsappHref(siteSettings, 'Bonjour HERITAGE, je souhaite un conseil au sujet de votre sélection de montres.');

  return (
    <section className="py-20 md:py-28 bg-white border-b border-[#002141]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="premium-section-card bg-[#002141] text-[#FAF9F7] p-8 md:p-14 lg:p-16 relative overflow-hidden">
          {/* Subtle background circle */}
          <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full border border-[#D6BB8F]/10 pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D6BB8F] block mb-3">
              CONSEIL LOCAL DÉDIÉ
            </span>

            <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-bold text-[#FAF9F7] leading-tight mb-4">
              Une question mérite parfois une vraie conversation
            </h2>

            <p className="text-sm sm:text-base text-[#FAF9F7]/85 leading-relaxed mb-8">
              Vous hésitez entre deux références, cherchez une pièce à offrir ou souhaitez
              comprendre un détail technique. Échangez avec HERITAGE depuis Abidjan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-xs text-[#FAF9F7]/90 max-w-lg">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-[#D6BB8F] flex-shrink-0" />
                <span>{siteSettings?.address || 'Maison HERITAGE à Abidjan'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#D6BB8F] flex-shrink-0" />
                <span>Appel ou WhatsApp : {siteSettings?.whatsapp_phone || siteSettings?.phone || ''}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {whatsappUrl && <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="premium-cta px-8 py-4 bg-[#AC854B] hover:bg-[#96723c] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] flex items-center justify-center gap-3"
              >
                <MessageCircle className="w-4 h-4" />
                <span>ÉCHANGER AVEC HERITAGE</span>
              </a>}

              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="premium-cta px-8 py-4 bg-transparent hover:bg-[#FAF9F7]/10 text-[#FAF9F7] border border-[#FAF9F7]/25 text-xs font-bold uppercase tracking-[0.16em] cursor-pointer text-center"
              >
                FORMULAIRE DE CONTACT
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

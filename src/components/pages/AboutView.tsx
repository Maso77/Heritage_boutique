import React from 'react';
import { ArrowRight, Compass, ShieldCheck, HeartHandshake } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';

interface AboutViewProps {
  navigate: (route: string) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ navigate }) => {
  const { siteSettings } = usePublicContent();
  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      {/* Hero of About */}
      <div className="relative py-16 sm:py-24 bg-[#002141] text-[#FAF9F7] overflow-hidden mb-16">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'url(/assets/trame-a-propos.svg)',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D6BB8F] block mb-4">
            MAISON DE COMMERCE DE LUXE &middot; ABIDJAN
          </span>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6">
            La Maison HERITAGE
          </h1>
          <p className="text-base sm:text-lg text-[#FAF9F7]/90 leading-relaxed font-cormorant italic max-w-2xl mx-auto">
            « Il y a des objets que l'on choisit pour aujourd'hui et d'autres que l'on imagine déjà
            transmettre. »
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Origin story */}
        <section className="premium-section-card bg-white border border-[#002141]/10 p-8 sm:p-12 space-y-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block">
            NOTRE HISTOIRE
          </span>
          <h2 className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141]">
            Une exigence née au cœur d'Abidjan
          </h2>
          <div className="space-y-4 text-sm text-[#3A3A3A] leading-relaxed">
            <p>
              Établie à {siteSettings?.address || 'Abidjan, Côte d’Ivoire'}, la Maison <strong>HERITAGE</strong> s'est construite
              autour d'une vocation claire : offrir aux passionnés et connaisseurs de Côte d'Ivoire un
              accès rigoureux, sécurisé et transparent aux plus beaux calibres de l'horlogerie
              suisse et internationale.
            </p>
            <p>
              Dans un marché souvent opaque, HERITAGE fait le choix de la clarté absolue : chaque
              pièce présentée en ligne est réellement disponible dans nos stocks physiques,
              accompagnée de son coffret d'origine, de son certificat d'authenticité et d'une
              garantie de manufacture.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="premium-section-card bg-white border border-[#002141]/10 p-6 space-y-3">
            <Compass className="w-6 h-6 text-[#AC854B]" />
            <h3 className="font-playfair text-base font-bold text-[#002141]">
              Sélection rigoureuse
            </h3>
            <p className="text-xs text-[#3A3A3A] leading-relaxed">
              Nous ne suivons pas les modes passagères. Chaque référence est retenue pour sa tenue
              mécanique, la noblesse de ses matériaux et sa valeur pérenne.
            </p>
          </div>

          <div className="premium-section-card bg-white border border-[#002141]/10 p-6 space-y-3">
            <ShieldCheck className="w-6 h-6 text-[#AC854B]" />
            <h3 className="font-playfair text-base font-bold text-[#002141]">
              Authenticité sans compromis
            </h3>
            <p className="text-xs text-[#3A3A3A] leading-relaxed">
              Numéro de série vérifié, calibre contrôlé, verre saphir inrayable. La conformité de
              chaque montre est scellée avant toute expédition ou remise en main propre.
            </p>
          </div>

          <div className="premium-section-card bg-white border border-[#002141]/10 p-6 space-y-3">
            <HeartHandshake className="w-6 h-6 text-[#AC854B]" />
            <h3 className="font-playfair text-base font-bold text-[#002141]">
              Proximité & Conseil
            </h3>
            <p className="text-xs text-[#3A3A3A] leading-relaxed">
              Nos conseillers basés à Abidjan vous accompagnent avec discernement, en boutique sur
              rendez-vous ou directement par WhatsApp et téléphone.
            </p>
          </div>
        </div>

        {/* CTA to Watches */}
        <div className="premium-section-card bg-[#002141] text-[#FAF9F7] p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-playfair text-xl font-bold mb-2">
              Explorez nos pièces d'exception
            </h3>
            <p className="text-xs sm:text-sm text-[#FAF9F7]/80">
              Découvrez la collection de montres suisses actuellement disponibles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/montres')}
            className="premium-cta px-8 py-3.5 bg-[#AC854B] hover:bg-[#96723c] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] flex items-center gap-3 flex-shrink-0 cursor-pointer"
          >
            <span>DÉCOUVRIR LES MONTRES</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

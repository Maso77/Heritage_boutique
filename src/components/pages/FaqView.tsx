import React, { useState } from 'react';
import { ChevronDown, MessageCircle, ShieldCheck } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';

interface FaqViewProps {
  navigate: (route: string) => void;
}

type FaqItem = {
  id: string;
  question: string;
  answer_html: string;
};

const DEFAULT_FAQS: FaqItem[] = [
  {
    id: 'choisir-piece',
    question: 'Comment choisir une montre HERITAGE ?',
    answer_html: '<p>Commencez par votre usage, votre style et le type de mouvement qui vous convient. Chaque fiche indique la référence, les caractéristiques et le prix. Pour un conseil avant votre choix, utilisez le formulaire de contact ou WhatsApp.</p>'
  },
  {
    id: 'disponibilite',
    question: 'La disponibilité affichée est-elle confirmée ?',
    answer_html: '<p>La disponibilité présentée en ligne est mise à jour à partir du catalogue. Avant toute finalisation, HERITAGE confirme avec vous la référence, le prix et les modalités de remise de la pièce demandée.</p>'
  },
  {
    id: 'authenticite',
    question: 'Comment vérifier l’authenticité d’une pièce ?',
    answer_html: '<p>Les informations de provenance, les documents éventuellement remis et les conditions de garantie applicables sont précisés pour chaque référence. Vous pouvez demander les éléments disponibles avant de confirmer votre choix.</p>'
  },
  {
    id: 'livraison',
    question: 'Comment se passent la livraison ou la remise ?',
    answer_html: '<p>Les modalités sont convenues avec vous selon la référence et votre zone à Abidjan. Les conditions confirmées avant la commande prévalent sur toute information générale affichée sur le site.</p>'
  },
  {
    id: 'garantie',
    question: 'Quelle garantie accompagne ma montre ?',
    answer_html: '<p>La garantie applicable dépend de la référence et des documents du fabricant ou du vendeur remis avec la pièce. Consultez la page Garantie &amp; Entretien ou échangez avec HERITAGE avant votre achat.</p>'
  },
  {
    id: 'contact',
    question: 'Comment obtenir un conseil personnalisé ?',
    answer_html: '<p>Vous pouvez écrire à HERITAGE depuis la page Contact, appeler le numéro indiqué dans le pied de page ou ouvrir la conversation WhatsApp. Votre demande sera examinée avec les informations que vous aurez communiquées.</p>'
  }
];

export const FaqView: React.FC<FaqViewProps> = ({ navigate }) => {
  const { faqs } = usePublicContent();
  const items = faqs.length > 0 ? faqs : DEFAULT_FAQS;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button type="button" onClick={() => navigate('/')} className="hover:text-[#002141] transition-colors">
            Accueil
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Foire aux questions</span>
        </nav>

        <div className="max-w-2xl mb-10 sm:mb-12">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-3">
            CONSEIL HERITAGE
          </span>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-[#002141] leading-tight mb-4">
            Les réponses avant votre choix
          </h1>
          <p className="text-sm sm:text-base text-[#3A3A3A] leading-relaxed">
            Retrouvez les informations essentielles sur nos pièces, leur disponibilité, la remise et l’accompagnement HERITAGE.
          </p>
        </div>

        <section className="bg-white border border-[#002141]/10" aria-label="Questions fréquentes">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.id} className="border-b border-[#002141]/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="w-full px-5 sm:px-7 py-5 flex items-center justify-between gap-5 text-left text-[#002141] hover:bg-[#FAF9F7] transition-colors"
                >
                  <span className="font-playfair text-base sm:text-lg font-bold">{item.question}</span>
                  <ChevronDown className={`w-5 h-5 text-[#AC854B] shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div
                    className="px-5 sm:px-7 pb-6 text-xs sm:text-sm text-[#3A3A3A] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: item.answer_html }}
                  />
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-10 bg-[#002141] text-[#FAF9F7] p-7 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex gap-4">
            <ShieldCheck className="w-6 h-6 text-[#D6BB8F] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-playfair text-xl font-bold mb-2">Votre question est plus précise ?</h2>
              <p className="text-xs sm:text-sm text-[#FAF9F7]/80 leading-relaxed">
                Une référence, un détail technique ou une demande de disponibilité mérite une réponse adaptée.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/contact')}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 bg-[#AC854B] hover:bg-[#96723c] text-[#FAF9F7] text-[11px] font-bold uppercase tracking-[0.14em] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Nous contacter
          </button>
        </section>
      </div>
    </main>
  );
};

import React from 'react';
import { ShieldCheck, Award, FileText, CheckCircle2, MessageCircle } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';
import { whatsappHref } from '../../lib/site-contact';

interface AuthenticityViewProps {
  navigate: (route: string) => void;
}

export const AuthenticityView: React.FC<AuthenticityViewProps> = ({ navigate }) => {
  const { siteSettings } = usePublicContent();
  const whatsappUrl = whatsappHref(siteSettings, 'Bonjour HERITAGE, je souhaite en savoir plus sur l’authenticité d’une pièce.');

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#002141] transition-colors"
          >
            Accueil
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Authenticité & Provenance</span>
        </nav>

        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
          CHARTE DE CONFORMITÉ HERITAGE
        </span>
        <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-[#002141] leading-tight mb-4">
          Authenticité & Provenance
        </h1>
        <p className="text-sm sm:text-base text-[#3A3A3A] leading-relaxed">
          Chez HERITAGE, la traçabilité n'est pas une option. Chaque garde-temps est certifié
          authentique, d'origine contrôlée, et remis avec l'intégralité de ses justificatifs officiels.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Verification steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#002141]/10 p-6 space-y-3">
            <Award className="w-6 h-6 text-[#AC854B]" />
            <h3 className="font-playfair text-base font-bold text-[#002141]">
              Label Swiss Made
            </h3>
            <p className="text-xs text-[#3A3A3A] leading-relaxed">
              Toutes nos montres Tissot répondent aux exigences légales de la Confédération suisse
              (mouvement suisse, emboîtage et contrôle final réalisés en Suisse).
            </p>
          </div>

          <div className="bg-white border border-[#002141]/10 p-6 space-y-3">
            <FileText className="w-6 h-6 text-[#AC854B]" />
            <h3 className="font-playfair text-base font-bold text-[#002141]">
              Boîte & Papiers
            </h3>
            <p className="text-xs text-[#3A3A3A] leading-relaxed">
              Chaque montre est livrée dans son coffret officiel d'origine, accompagnée de son manuel
              et de sa carte de garantie internationale numérotée.
            </p>
          </div>

          <div className="bg-white border border-[#002141]/10 p-6 space-y-3">
            <ShieldCheck className="w-6 h-6 text-[#AC854B]" />
            <h3 className="font-playfair text-base font-bold text-[#002141]">
              Garantie 2 ans
            </h3>
            <p className="text-xs text-[#3A3A3A] leading-relaxed">
              Couverture intégrale de deux ans sur tout défaut de mécanisme, relayée localement par
              notre service horloger à Abidjan.
            </p>
          </div>
        </div>

        {/* The 5 inspections */}
        <section className="bg-white border border-[#002141]/10 p-8 sm:p-12 space-y-6">
          <h2 className="font-playfair text-2xl font-bold text-[#002141]">
            Le protocole d'inspection HERITAGE
          </h2>
          <p className="text-xs sm:text-sm text-[#3A3A3A] leading-relaxed">
            Avant de rejoindre notre inventaire et d'être mise à disposition sur la boutique en ligne,
            chaque pièce fait l'objet d'un contrôle rigoureux :
          </p>

          <div className="space-y-4 pt-2">
            {[
              {
                title: 'Contrôle du numéro de série univoque',
                desc: 'Vérification de la concordance absolue entre le boîtier gravé, le fond de boîte et la carte de garantie fabricant.'
              },
              {
                title: 'Test de précision chronométrique',
                desc: 'Vérification de la dérive quotidienne et de l\'amplitude du balancier selon les normes de tolérance horlogères.'
              },
              {
                title: 'Vérification de la réserve de marche',
                desc: 'Contrôle de l\'autonomie du ressort de barillet (jusqu\'à 80 heures pour les calibres Powermatic 80).'
              },
              {
                title: 'Inspection du verre saphir inrayable',
                desc: 'Examen de surface sous lumière rasante pour garantir l\'absence totale de micro-rayure ou défaut optique.'
              },
              {
                title: 'Test d\'étanchéité sous pression',
                desc: 'Contrôle des joints toriques de couronne et de fond pour assurer l\'étanchéité annoncée (30 m à 300 m selon le modèle).'
              }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3.5 p-3.5 bg-[#FAF9F7] border border-[#002141]/5">
                <CheckCircle2 className="w-4 h-4 text-[#AC854B] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-[#002141] mb-0.5">{item.title}</h4>
                  <p className="text-xs text-[#3A3A3A]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reassurance Banner */}
        <div className="bg-[#002141] text-[#FAF9F7] p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-playfair text-xl font-bold mb-2">
              Une question sur une pièce spécifique ?
            </h3>
            <p className="text-xs sm:text-sm text-[#FAF9F7]/80">
              Nos conseillers sont à votre disposition pour vous renseigner.
            </p>
          </div>
          {whatsappUrl && <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 bg-[#AC854B] hover:bg-[#96723c] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] transition-colors flex items-center gap-2.5 flex-shrink-0 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>ÉCHANGER AVEC UN CONSEILLER</span>
          </a>}
        </div>
      </div>
    </div>
  );
};

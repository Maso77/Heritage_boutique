import React, { useEffect, useState } from 'react';
import { publicRequest } from '../../lib/public-content';

interface LegalViewProps {
  type: 'mentions-legales' | 'cgv' | 'confidentialite' | 'livraison-retours' | 'garantie-service' | 'authenticite-provenance' | 'cookies';
  navigate: (route: string) => void;
}

type LegalPage = { title: string; content_html: string; updated_at: string; published_at: string | null };

export const LegalView: React.FC<LegalViewProps> = ({ type, navigate }) => {
  const [page, setPage] = useState<LegalPage | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void publicRequest<LegalPage>(`/legal/${type}`)
      .then((data) => { if (active) setPage(data); })
      .catch(() => { if (active) setPage(null); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [type]);

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button type="button" onClick={() => navigate('/')} className="hover:text-[#002141] transition-colors">Accueil</button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Informations légales</span>
        </nav>
        {!loaded ? <div className="bg-white border border-[#002141]/10 p-8 sm:p-12 text-sm text-[#3A3A3A]">Chargement…</div> : page ? (
          <article className="bg-white border border-[#002141]/10 p-8 sm:p-12 space-y-8 text-xs sm:text-sm text-[#3A3A3A] leading-relaxed">
            <h1 className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141]">{page.title}</h1>
            <div className="[&_h2]:font-playfair [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-[#002141] [&_h2]:mt-7 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: page.content_html }} />
            <p className="border-t border-[#002141]/10 pt-5 text-[11px] text-[#3A3A3A]/70">Dernière mise à jour : {new Date(page.updated_at).toLocaleDateString('fr-FR')}</p>
          </article>
        ) : (
          <div className="bg-white border border-[#002141]/10 p-8 sm:p-12 text-sm text-[#3A3A3A]">Cette page n’est pas encore publiée.</div>
        )}
      </div>
    </div>
  );
};

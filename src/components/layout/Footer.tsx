import React from 'react';
import { Phone, Mail, MapPin, ShieldCheck, Clock, Award, Facebook, Instagram, Youtube } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';
import { phoneHref } from '../../lib/site-contact';

interface FooterProps {
  navigate: (route: string) => void;
}

const TikTokIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </svg>
);

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  const { siteSettings, products } = usePublicContent();
  const watches = products.filter((product) => product.category === 'montres').slice(0, 4);
  const footerNotices = Array.isArray(siteSettings?.footer_notices) ? siteSettings.footer_notices.slice(0, 3) : [];
  const noticeIcons = [ShieldCheck, Clock, Award];

  // Order required: Facebook, Instagram, TikTok, YouTube, X
  const rawSocials = (siteSettings?.social_links || {}) as Record<string, string>;
  const socialConfig = [
    { key: 'facebook', label: 'HERITAGE sur Facebook', icon: Facebook, url: rawSocials.facebook },
    { key: 'instagram', label: 'HERITAGE sur Instagram', icon: Instagram, url: rawSocials.instagram },
    { key: 'tiktok', label: 'HERITAGE sur TikTok', icon: TikTokIcon, url: rawSocials.tiktok },
    { key: 'youtube', label: 'HERITAGE sur YouTube', icon: Youtube, url: rawSocials.youtube },
    { key: 'x', label: 'HERITAGE sur X', icon: XIcon, url: rawSocials.x || rawSocials.twitter }
  ].filter((item) => Boolean(item.url && typeof item.url === 'string' && item.url.trim().length > 0));

  return (
    <footer className="bg-[#002141] text-[#FAF9F7] pt-16 pb-12 border-t border-[#D6BB8F]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Value badges strip */}
        {footerNotices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 mb-12 border-b border-[#FAF9F7]/10">
            {footerNotices.map((notice, index) => {
              const Icon = noticeIcons[index] || ShieldCheck;
              return (
                <div key={`${notice.title}-${index}`} className="flex items-start gap-4">
                  <Icon className="w-6 h-6 text-[#D6BB8F] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#D6BB8F] mb-1">
                      {notice.title}
                    </h4>
                    <p className="text-xs text-[#FAF9F7]/80 leading-relaxed">{notice.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Main 4-column footer layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">
          {/* Brand Info */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-block text-left cursor-pointer"
              aria-label="Accueil HERITAGE"
            >
              <img
                src="/assets/logo-white.svg"
                alt="HERITAGE Montres et Accessoires"
                className="w-48 h-auto object-contain -ml-2"
              />
            </button>
            <p className="text-xs text-[#FAF9F7]/80 leading-relaxed pt-2">
              HERITAGE réunit à Abidjan des montres, des parfums, des lunettes et des accessoires
              choisis pour leur capacité à durer et à se transmettre.
            </p>
            <div className="pt-2 space-y-2 text-xs text-[#FAF9F7]/90">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#D6BB8F]" />
                <span>{siteSettings?.address || ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#D6BB8F]" />
                <a
                  href={phoneHref(siteSettings?.phone)}
                  className="hover:text-[#D6BB8F] transition-colors"
                >
                  {siteSettings?.phone || ''}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#D6BB8F]" />
                <a
                  href={siteSettings?.email ? `mailto:${siteSettings.email}` : undefined}
                  className="hover:text-[#D6BB8F] transition-colors"
                >
                  {siteSettings?.email || ''}
                </a>
              </div>
            </div>

            {/* Social Media Linear Icons */}
            {socialConfig.length > 0 && (
              <div className="pt-4 flex items-center gap-4">
                {socialConfig.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.key}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.label}
                      className="text-[#D6BB8F] hover:text-[#FAF9F7] transition-colors p-1"
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nav Column 1: Collection */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#D6BB8F] mb-4">
              Collection Montres
            </h3>
            <ul className="space-y-2.5 text-xs text-[#FAF9F7]/80">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/montres')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Toutes les montres suisses
                </button>
              </li>
              {watches.map((watch) => (
                <li key={watch.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/montres/${watch.slug}`)}
                    className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                  >
                    {watch.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Nav Column 2: Conseil & Guide */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#D6BB8F] mb-4">
              Conseil &amp; Exigence
            </h3>
            <ul className="space-y-2.5 text-xs text-[#FAF9F7]/80">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/blogs')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Articles &amp; Guides du Blog
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/a-propos')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  La Maison HERITAGE
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/authenticite-provenance')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Authenticité &amp; Traçabilité
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/livraison-retours')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Livraison sécurisée &amp; Retours
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/garantie-service')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Garantie 2 ans &amp; Entretien
                </button>
              </li>
            </ul>
          </div>

          {/* Nav Column 3: Contact & Légal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#D6BB8F] mb-4">
              Informations &amp; Suivi
            </h3>
            <ul className="space-y-2.5 text-xs text-[#FAF9F7]/80">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/contact')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Échanger avec un conseiller
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/compte')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Suivre ma commande
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/liste-envies')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Ma liste d'envies (Favoris)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/faq')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Foire aux questions (FAQ)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/cgv')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Conditions Générales de Vente
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/confidentialite')}
                  className="hover:text-[#FAF9F7] transition-colors cursor-pointer text-left"
                >
                  Données personnelles (ARTCI)
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom line with currency note and copyright */}
        <div className="pt-8 border-t border-[#FAF9F7]/10 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#FAF9F7]/60">
          <p>
            Tous nos prix sont affichés en Francs CFA (FCFA / XOF). Commandes validées et remises en main propre à Abidjan.
          </p>
          <p>&copy; {new Date().getFullYear()} {siteSettings?.business_name || 'HERITAGE'}. Tous droits réservés. {siteSettings?.address || 'Abidjan, Côte d’Ivoire'}.</p>
        </div>
      </div>
    </footer>
  );
};

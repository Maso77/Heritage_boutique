import React, { useState } from 'react';
import { usePublicContent } from '../../lib/public-content';
import { Star, ChevronDown, CheckCircle2 } from 'lucide-react';

interface PublicFeedbackProps {
  placement: 'home' | 'catalog' | 'contact';
}

export const PublicFeedbackSections: React.FC<PublicFeedbackProps> = ({ placement }) => {
  const { faqs, reviews } = usePublicContent();
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  // Filter FAQs by placement
  const visibleFaqs = faqs.filter((faq) => {
    const placements = Array.isArray(faq.placements) ? faq.placements : [];
    if (placement === 'home') {
      return placements.includes('home') || faq.placement === 'home' || faq.placement === 'all';
    }
    if (placement === 'catalog') {
      return (
        placements.includes('catalog') ||
        placements.includes('boutique-catalogue') ||
        faq.placement === 'catalog' ||
        faq.placement === 'all'
      );
    }
    if (placement === 'contact') {
      return placements.includes('contact') || faq.placement === 'contact' || faq.placement === 'all';
    }
    return false;
  });

  // Filter approved Reviews only
  const approvedReviews = reviews.filter((r) => r && String((r as any).status || 'approved') === 'approved');

  let visibleReviews = approvedReviews;
  if (placement === 'home') {
    const featured = approvedReviews.filter((r) => r.is_featured_home);
    visibleReviews = featured.length > 0 ? featured.slice(0, 6) : approvedReviews.slice(0, 6);
  } else if (placement === 'contact') {
    const featured = approvedReviews.filter((r) => r.is_featured_contact);
    visibleReviews = featured.length > 0 ? featured.slice(0, 6) : approvedReviews.slice(0, 6);
  } else {
    visibleReviews = approvedReviews.slice(0, 6);
  }

  const hasFaqs = visibleFaqs.length > 0;
  const hasReviews = visibleReviews.length > 0;

  if (!hasFaqs && !hasReviews) return null;

  return (
    <div className="bg-[#FAF9F7] py-16 sm:py-24 border-t border-[#002141]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Avis Clients */}
        {hasReviews && (
          <section aria-labelledby={`reviews-heading-${placement}`}>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
                EXPÉRIENCE & TÉMOIGNAGES
              </span>
              <h2
                id={`reviews-heading-${placement}`}
                className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141]"
              >
                Avis Vérifiés de nos Clients
              </h2>
              <div className="w-12 h-0.5 bg-[#AC854B] mx-auto mt-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleReviews.map((review) => (
                <article
                  key={review.id}
                  className="bg-white border border-[#002141]/10 p-6 sm:p-7 flex flex-col justify-between shadow-xs hover:border-[#AC854B]/50 transition-colors"
                >
                  <div>
                    {/* Étoiles */}
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= (review.rating || 5)
                              ? 'fill-[#AC854B] text-[#AC854B]'
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Titre */}
                    {review.title && (
                      <h3 className="font-playfair text-base font-bold text-[#002141] mb-2">
                        {review.title}
                      </h3>
                    )}

                    {/* Texte de l'avis */}
                    <p className="text-xs sm:text-sm text-[#3A3A3A] leading-relaxed mb-4">
                      "{review.body}"
                    </p>

                    {/* Réponse de la Maison */}
                    {review.merchant_response && (
                      <div className="mt-4 pt-3 border-t border-[#002141]/10 bg-[#FAF9F7] p-3 text-xs text-[#3A3A3A] border-l-2 border-l-[#AC854B]">
                        <span className="font-bold text-[#002141] block mb-1">
                          Réponse de la Maison HERITAGE :
                        </span>
                        <span>{review.merchant_response}</span>
                      </div>
                    )}
                  </div>

                  {/* Auteur & Produit */}
                  <div className="mt-6 pt-4 border-t border-[#002141]/10 flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-[#002141] block font-semibold">
                        {review.author_name}
                      </strong>
                      {review.product && (
                        <span className="text-[#AC854B] text-[11px] block mt-0.5 font-medium">
                          Modèle : {review.product.name}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Approuvé
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Section FAQ Générale */}
        {hasFaqs && (
          <section aria-labelledby={`faq-heading-${placement}`}>
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
                INFORMATIONS PRATIQUES
              </span>
              <h2
                id={`faq-heading-${placement}`}
                className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141]"
              >
                Foire Aux Questions
              </h2>
              <div className="w-12 h-0.5 bg-[#AC854B] mx-auto mt-4" />
            </div>

            <div className="max-w-4xl mx-auto space-y-3">
              {visibleFaqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="bg-white border border-[#002141]/10 transition-colors overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      className="w-full text-left p-5 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[#002141] hover:text-[#AC854B] transition-colors cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#AC854B] shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-[#3A3A3A] leading-relaxed border-t border-[#002141]/10 pt-4 bg-[#FAF9F7]/60">
                        <div dangerouslySetInnerHTML={{ __html: faq.answer_html }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

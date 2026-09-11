import React from 'react';
import { usePublicContent } from '../../lib/public-content';

export const PublicFeedbackSections: React.FC<{ placement: 'home' | 'catalog' }> = ({ placement }) => {
  const { faqs, reviews } = usePublicContent();
  const visibleFaqs = faqs.filter((faq) => faq.placements.includes(placement));
  const visibleReviews = placement === 'home'
    ? reviews.filter((review) => review.is_featured_home)
    : reviews.filter((review) => review.product_id);
  if (!visibleFaqs.length && !visibleReviews.length) return null;

  return (
    <section className="py-20 md:py-28 bg-[#FAF9F7] border-b border-[#002141]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-2">
        {visibleReviews.length > 0 && <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B]">Avis vérifiés</p>
          <h2 className="font-playfair mt-2 text-2xl font-bold text-[#002141]">Ce que disent nos clients</h2>
          <div className="mt-6 space-y-5">
            {visibleReviews.slice(0, 3).map((review) => <article key={review.id} className="border-t border-[#002141]/10 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#AC854B]">{review.rating}/5 · {review.author_name}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#3A3A3A]">{review.body}</p>
              {review.product && <p className="mt-2 text-xs text-[#3A3A3A]/70">À propos de {review.product.name}</p>}
              {review.merchant_response && <p className="mt-3 border-l-2 border-[#AC854B] pl-3 text-xs leading-relaxed text-[#3A3A3A]">HERITAGE : {review.merchant_response}</p>}
            </article>)}
          </div>
        </div>}
        {visibleFaqs.length > 0 && <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B]">Informations utiles</p>
          <h2 className="font-playfair mt-2 text-2xl font-bold text-[#002141]">Questions fréquentes</h2>
          <div className="mt-6 divide-y divide-[#002141]/10">
            {visibleFaqs.map((faq) => <details key={faq.id} className="py-4"><summary className="cursor-pointer pr-5 text-sm font-semibold text-[#002141]">{faq.question}</summary><div className="mt-3 text-sm leading-relaxed text-[#3A3A3A]" dangerouslySetInnerHTML={{ __html: faq.answer_html }} /></details>)}
          </div>
        </div>}
      </div>
    </section>
  );
};

import React from 'react';
import { usePublicContent } from '../../lib/public-content';
import { ArrowRight, BookOpen } from 'lucide-react';

interface BlogSectionProps {
  navigate: (route: string) => void;
}

export const BlogSection: React.FC<BlogSectionProps> = ({ navigate }) => {
  const { blogs } = usePublicContent();
  const article = blogs[0];
  if (!article) return null;

  return (
    <section className="py-20 md:py-28 bg-[#FAF9F7] border-b border-[#002141]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 md:mb-16">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
            LE BLOG HERITAGE
          </span>
          <h2 className="font-playfair text-2xl sm:text-3xl md:text-4xl font-bold text-[#002141] leading-tight mb-4">
            Guides, Savoir-faire & Inspirations
          </h2>
          <p className="text-sm md:text-base text-[#3A3A3A] leading-relaxed">
            Nos articles et chroniques pour approfondir l'artisanat d'art, choisir vos garde-temps, lunettes de créateur et parfums d'exception.
          </p>
        </div>

        {/* Featured Editorial Card */}
        <div className="premium-section-card bg-white border border-[#002141]/10 overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 relative aspect-16/10 lg:aspect-auto overflow-hidden bg-[#002141]">
            {article.cover && <img
              src={article.cover?.public_url || ''}
              alt={article.cover?.alt_text || article.title}
              className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"
            />}
          </div>

          <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 text-xs text-[#3A3A3A]/70 mb-4">
                <span className="font-bold uppercase tracking-wider text-[#AC854B]">
                  {article.category || 'Journal HERITAGE'}
                </span>
                <span>&middot;</span>
                <span>{Math.max(1, Math.ceil(article.content_html.replace(/<[^>]+>/g, '').trim().length / 900))} min de lecture</span>
              </div>

              <h3 className="font-playfair text-2xl sm:text-3xl font-bold text-[#002141] mb-3">
                {article.title}
              </h3>

              <p className="font-medium text-sm text-[#002141] mb-4">
                {article.excerpt}
              </p>

              <p className="text-xs sm:text-sm text-[#3A3A3A] leading-relaxed line-clamp-3">
                {article.excerpt}
              </p>
            </div>

            <div className="pt-8 mt-6 border-t border-[#002141]/10 flex items-center justify-between">
              <button
                type="button"
                id="blog-read-guide"
                onClick={() => navigate('/blogs')}
                className="premium-cta inline-flex items-center gap-3 px-6 py-3 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] cursor-pointer group"
              >
                <span>LIRE L'ARTICLE DU BLOG</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs text-[#3A3A3A]/60">
                <BookOpen className="w-4 h-4 text-[#AC854B]" />
                <span>Article de référence</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

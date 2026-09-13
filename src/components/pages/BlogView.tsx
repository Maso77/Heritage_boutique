import React, { useEffect, useMemo, useState } from 'react';
import { PublicBlogPost, usePublicContent } from '../../lib/public-content';
import { ArrowRight, Clock, Tag } from 'lucide-react';

interface BlogViewProps {
  navigate: (route: string) => void;
}

export const BlogView: React.FC<BlogViewProps> = ({ navigate }) => {
  const { blogs, products } = usePublicContent();
  const [selectedArticle, setSelectedArticle] = useState<PublicBlogPost | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');

  const categories = useMemo(() => ['Tous', ...Array.from(new Set(blogs.map((article) => article.category).filter(Boolean) as string[]))], [blogs]);

  const filteredArticles =
    selectedCategory === 'Tous'
      ? blogs
      : blogs.filter((art) => art.category === selectedCategory);
  const relatedProducts = useMemo(
    () => selectedArticle
      ? products.filter((product) => selectedArticle.related_product_ids.map(String).includes(String(product.id)))
      : [],
    [products, selectedArticle],
  );

  // An article can be switched to draft while it is open in another tab. Do
  // not keep rendering that stale article after the public catalogue refreshes.
  useEffect(() => {
    if (selectedArticle && !blogs.some((article) => article.id === selectedArticle.id)) {
      setSelectedArticle(null);
    }
  }, [blogs, selectedArticle]);

  useEffect(() => {
    if (!selectedArticle) return undefined;
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') || '';
    document.title = selectedArticle.seo_title || selectedArticle.title;
    if (description) description.setAttribute('content', selectedArticle.seo_description || selectedArticle.excerpt || '');

    return () => {
      document.title = previousTitle;
      if (description) description.setAttribute('content', previousDescription);
    };
  }, [selectedArticle]);

  if (selectedArticle) {
    return (
      <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="hover:text-[#002141] transition-colors cursor-pointer"
            >
              Accueil
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => setSelectedArticle(null)}
              className="hover:text-[#002141] transition-colors cursor-pointer"
            >
              Blogs
            </button>
            <span>/</span>
            <span className="text-[#002141] font-semibold truncate max-w-xs">{selectedArticle.title}</span>
          </nav>

          <article className="bg-white border border-[#002141]/10 p-8 sm:p-12 space-y-8 shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-[#3A3A3A]/70">
                <span className="font-bold uppercase tracking-wider text-[#AC854B]">
                  {selectedArticle.category || 'Journal HERITAGE'}
                </span>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.max(1, Math.ceil(selectedArticle.content_html.replace(/<[^>]+>/g, '').trim().length / 900))} min de lecture
                </span>
                <span>&middot;</span>
                <span>{selectedArticle.published_at ? new Date(selectedArticle.published_at).toLocaleDateString('fr-FR') : ''}</span>
              </div>

              <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[#002141] leading-tight">
                {selectedArticle.title}
              </h1>

              <p className="font-playfair italic text-lg sm:text-xl text-[#002141]">
                {selectedArticle.excerpt}
              </p>
            </div>

            {selectedArticle.cover && <div className="aspect-16/9 bg-[#002141] overflow-hidden">
              <img
                src={selectedArticle.cover.public_url}
                alt={selectedArticle.cover.alt_text || selectedArticle.title}
                className="w-full h-full object-cover"
              />
            </div>}

            <div className="space-y-8 text-[#3A3A3A] leading-relaxed text-sm sm:text-base [&_h2]:font-playfair [&_h2]:text-xl [&_h2]:sm:text-2xl [&_h2]:font-bold [&_h2]:text-[#002141] [&_h3]:font-playfair [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#002141] [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#AC854B] [&_blockquote]:pl-4 [&_blockquote]:font-playfair [&_blockquote]:italic [&_a]:font-semibold [&_a]:text-[#002141] [&_a]:underline [&_a]:decoration-[#AC854B] [&_a]:underline-offset-4 [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:border [&_img]:border-[#002141]/10 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:border [&_th]:border-[#002141]/15 [&_th]:bg-[#FAF9F7] [&_th]:p-3 [&_th]:font-semibold [&_td]:border [&_td]:border-[#002141]/15 [&_td]:p-3" dangerouslySetInnerHTML={{ __html: selectedArticle.content_html }} />

            {relatedProducts.length > 0 && <section className="border-t border-[#002141]/10 pt-8" aria-labelledby="related-products-heading">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AC854B]">Sélection associée</p>
              <h2 id="related-products-heading" className="font-playfair mt-2 text-2xl font-bold text-[#002141]">Pièces liées à cet article</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {relatedProducts.map((product) => <button key={product.id} type="button" onClick={() => navigate(`/montres/${product.slug}`)} className="group flex items-center gap-4 border border-[#002141]/15 bg-[#FAF9F7] p-3 text-left transition-colors hover:border-[#AC854B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#AC854B]">
                  {product.primaryImage && <img src={product.primaryImage} alt="" className="h-16 w-16 shrink-0 object-cover" />}
                  <span className="min-w-0"><span className="block truncate font-semibold text-[#002141] group-hover:text-[#AC854B]">{product.name}</span><span className="mt-1 block text-xs text-[#3A3A3A]">Voir la fiche produit</span></span>
                </button>)}
              </div>
            </section>}

            <div className="pt-8 border-t border-[#002141]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                id="blog-back-to-list-btn"
                onClick={() => setSelectedArticle(null)}
                className="text-xs font-bold uppercase tracking-wider text-[#002141] hover:text-[#AC854B] transition-colors cursor-pointer"
              >
                &larr; RETOUR AUX ARTICLES DU BLOG
              </button>

              <button
                type="button"
                id="blog-go-to-boutique-btn"
                onClick={() => navigate('/boutique')}
                className="px-6 py-3 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] transition-colors cursor-pointer"
              >
                DÉCOUVRIR LA BOUTIQUE
              </button>
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#002141] transition-colors cursor-pointer"
          >
            Accueil
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Blogs</span>
        </nav>

        <div className="max-w-3xl mb-10">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
            ARTICLES &amp; SAVOIR-FAIRE
          </span>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-[#002141] leading-tight mb-4">
            Le Blog HERITAGE
          </h1>
          <p className="text-sm sm:text-base text-[#3A3A3A] leading-relaxed">
            Conseils d'experts, repères de style et guides d'achat de la boutique : montres de manufacture, lunettes solaires de créateur, haute parfumerie et accessoires d'exception à Abidjan.
          </p>
        </div>

        {/* Categories filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-10 pb-4 border-b border-[#002141]/10">
          <span className="text-xs font-semibold text-[#002141] mr-2 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#AC854B]" />
            Thématiques :
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#002141] text-[#FAF9F7] shadow-xs'
                  : 'bg-white border border-[#002141]/15 text-[#3A3A3A] hover:border-[#002141]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArticles.map((art) => (
            <div
              key={art.slug}
              className="premium-section-card bg-white border border-[#002141]/10 flex flex-col justify-between overflow-hidden group hover:border-[#AC854B] cursor-pointer"
              onClick={() => setSelectedArticle(art)}
            >
              <div className="aspect-16/10 bg-[#002141] overflow-hidden relative">
                {art.cover && <img
                  src={art.cover?.public_url || ''}
                  alt={art.cover?.alt_text || art.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />}
                <div className="absolute top-4 left-4 bg-[#002141]/90 text-[#FAF9F7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  {art.category || 'Journal HERITAGE'}
                </div>
              </div>

              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#AC854B] mb-2">
                    <span>{art.published_at ? new Date(art.published_at).toLocaleDateString('fr-FR') : ''}</span>
                    <span>&middot;</span>
                    <span>{Math.max(1, Math.ceil(art.content_html.replace(/<[^>]+>/g, '').trim().length / 900))} min</span>
                  </div>
                  <h2 className="font-playfair text-lg sm:text-xl font-bold text-[#002141] group-hover:text-[#AC854B] transition-colors mb-2 leading-snug">
                    {art.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#3A3A3A] leading-relaxed line-clamp-3 mb-4">
                    {art.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#002141]/10 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#002141] group-hover:text-[#AC854B] inline-flex items-center gap-2">
                    <span>LIRE L'ARTICLE</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

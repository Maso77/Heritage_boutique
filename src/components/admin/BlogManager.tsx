import React, { FormEvent, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { adminRequest, AdminSession } from '../../lib/admin-api';
import { RichTextEditor } from './RichTextEditor';

type AnyRecord = Record<string, any>;
type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';

type BlogForm = {
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  cover_media_id: string;
  cover_image: string;
  category: string;
  tags_text: string;
  related_product_ids: string[];
  status: ArticleStatus;
  published_at: string;
  seo_title: string;
  seo_description: string;
};

interface BlogManagerProps {
  articles: AnyRecord[];
  products: AnyRecord[];
  media: AnyRecord[];
  admin: AdminSession | null;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
}

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  published: 'Publié',
  archived: 'Archivé',
};

const STATUS_CLASSES: Record<ArticleStatus, string> = {
  draft: 'border-[#002141]/20 bg-[#F5F3EF] text-[#002141]',
  scheduled: 'border-[#AC854B]/45 bg-[#FFF7E8] text-[#76531D]',
  published: 'border-emerald-700/30 bg-emerald-50 text-emerald-800',
  archived: 'border-[#3A3A3A]/20 bg-[#3A3A3A]/8 text-[#3A3A3A]',
};

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 120);

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const toLocalDateTime = (value: unknown) => {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const toText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const emptyForm = (): BlogForm => ({
  title: '',
  slug: '',
  excerpt: '',
  content_html: '',
  cover_media_id: '',
  cover_image: '',
  category: '',
  tags_text: '',
  related_product_ids: [],
  status: 'draft',
  published_at: '',
  seo_title: '',
  seo_description: '',
});

const formFromArticle = (article: AnyRecord): BlogForm => ({
  title: String(article.title || ''),
  slug: String(article.slug || ''),
  excerpt: String(article.excerpt || ''),
  content_html: String(article.content_html || ''),
  cover_media_id: String(article.cover_media_id || ''),
  cover_image: String(article.cover_image || ''),
  category: String(article.category || ''),
  tags_text: asStringArray(article.tags).join(', '),
  related_product_ids: asStringArray(article.related_product_ids),
  status: (['draft', 'scheduled', 'published', 'archived'].includes(article.status) ? article.status : 'draft') as ArticleStatus,
  published_at: toLocalDateTime(article.published_at),
  seo_title: String(article.seo_title || ''),
  seo_description: String(article.seo_description || ''),
});

const readableDate = (value: unknown) => {
  if (!value) return 'Non définie';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Non définie' : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

export const BlogManager: React.FC<BlogManagerProps> = ({ articles, products, media, admin, onRefresh, onNotify }) => {
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<BlogForm>(emptyForm);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ArticleStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const usableMedia = useMemo(
    () => media.filter((asset) => asset?.id && asset?.public_url),
    [media],
  );
  const categories = useMemo<string[]>(
    () => Array.from(new Set<string>(articles.map((article) => String(article.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr-FR')),
    [articles],
  );
  const visibleArticles = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('fr-FR');
    return articles.filter((article) => {
      const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;
      const searchable = [article.title, article.slug, article.excerpt, article.category, ...asStringArray(article.tags)].join(' ').toLocaleLowerCase('fr-FR');
      return matchesStatus && matchesCategory && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [articles, categoryFilter, search, statusFilter]);

  const selectedCover = usableMedia.find((asset) => String(asset.id) === form.cover_media_id) || null;
  const currentAuthor = admin?.full_name || admin?.email || 'Administrateur HERITAGE';
  const editingAuthor = editing?.id
    ? String(editing.author?.full_name || editing.author?.email || currentAuthor)
    : currentAuthor;

  const startCreate = () => {
    setEditing({});
    setForm(emptyForm());
    setSlugManuallyEdited(false);
    setFormError('');
  };

  const startEdit = (article: AnyRecord) => {
    setEditing(article);
    setForm(formFromArticle(article));
    setSlugManuallyEdited(true);
    setFormError('');
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
  };

  const updateForm = <K extends keyof BlogForm>(key: K, value: BlogForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onTitleChange = (title: string) => {
    setForm((current) => ({
      ...current,
      title,
      slug: slugManuallyEdited ? current.slug : slugify(title),
    }));
  };

  const toggleRelatedProduct = (productId: string) => {
    setForm((current) => ({
      ...current,
      related_product_ids: current.related_product_ids.includes(productId)
        ? current.related_product_ids.filter((id) => id !== productId)
        : [...current.related_product_ids, productId],
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = form.title.trim();
    const cleanContent = toText(form.content_html);
    const cleanTags = form.tags_text.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
    const shouldBeVisible = form.status === 'published' || form.status === 'scheduled';

    if (!cleanTitle || !cleanContent) {
      setFormError('Le titre et le contenu de l’article sont obligatoires.');
      return;
    }
    if (shouldBeVisible && !form.excerpt.trim()) {
      setFormError('Un article publié ou programmé doit comporter un extrait.');
      return;
    }
    if (shouldBeVisible && !form.cover_media_id && !form.cover_image.trim()) {
      setFormError('Choisissez une image à la une avant de publier ou programmer l’article.');
      return;
    }
    if (form.status === 'scheduled' && !form.published_at) {
      setFormError('Indiquez une date et une heure de publication pour programmer cet article.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        title: cleanTitle,
        slug: slugify(form.slug || cleanTitle),
        excerpt: form.excerpt.trim(),
        content_html: form.content_html,
        cover_media_id: form.cover_media_id || null,
        cover_image: form.cover_image.trim() || null,
        category: form.category.trim() || null,
        tags: cleanTags,
        related_product_ids: form.related_product_ids,
        status: form.status,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
      };
      if (editing?.id) await adminRequest(`/resources/blogs/${editing.id}`, { method: 'PATCH', body: payload });
      else await adminRequest('/resources/blogs', { method: 'POST', body: payload });
      await onRefresh();
      onNotify(editing?.id ? 'Article mis à jour.' : 'Article créé.');
      closeEditor();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'L’enregistrement de l’article a échoué.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (article: AnyRecord) => {
    if (!window.confirm(`Supprimer définitivement l’article « ${article.title || 'sans titre'} » ?`)) return;
    try {
      await adminRequest(`/resources/blogs/${article.id}`, { method: 'DELETE' });
      await onRefresh();
      onNotify('Article supprimé.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'La suppression de l’article a échoué.');
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 border-b border-[#002141]/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AC854B]">Gestion éditoriale</p>
          <h1 className="admin-page-title font-playfair mt-2 font-semibold text-[#002141]">Articles du blog</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#3A3A3A]">Rédigez, programmez et publiez les articles visibles dans le journal HERITAGE.</p>
        </div>
        <button type="button" onClick={startCreate} className="admin-primary-button"><Plus className="h-4 w-4" aria-hidden="true" /> Nouvel article</button>
      </div>

      {editing !== null && (
        <form onSubmit={submit} className="mb-8 border border-[#002141]/15 bg-white p-5 shadow-sm sm:p-7" noValidate>
          <div className="mb-6 flex flex-col gap-4 border-b border-[#002141]/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AC854B]">{editing.id ? 'Édition' : 'Nouvel article'}</p>
              <h2 className="font-playfair mt-1 text-2xl font-semibold text-[#002141]">{editing.id ? 'Modifier l’article' : 'Rédiger un article'}</h2>
              <p className="mt-1 text-sm text-[#3A3A3A]">Auteur enregistré : <strong className="text-[#002141]">{editingAuthor}</strong></p>
            </div>
            <button type="button" onClick={closeEditor} className="admin-icon-button self-start" aria-label="Fermer l’éditeur"><X className="h-4 w-4" /></button>
          </div>

          {formError && <div role="alert" className="mb-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>}

          <fieldset className="border border-[#002141]/15 p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold text-[#002141]">Informations de l’article</legend>
            <div className="mt-2 grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-[#002141] md:col-span-2">Titre de l’article *
                <input value={form.title} onChange={(event) => onTitleChange(event.target.value)} className="admin-input mt-2" maxLength={180} required />
              </label>
              <label className="block text-sm font-semibold text-[#002141]">Slug URL *
                <div className="mt-2 flex gap-2"><input value={form.slug} onChange={(event) => { setSlugManuallyEdited(true); updateForm('slug', event.target.value); }} className="admin-input min-w-0" maxLength={140} required /><button type="button" onClick={() => { setSlugManuallyEdited(true); updateForm('slug', slugify(form.title)); }} className="admin-secondary-button whitespace-nowrap">Régénérer</button></div>
              </label>
              <label className="block text-sm font-semibold text-[#002141]">Catégorie
                <input value={form.category} onChange={(event) => updateForm('category', event.target.value)} className="admin-input mt-2" placeholder="ex. Horlogerie" maxLength={100} list="blog-categories" />
                <datalist id="blog-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
              </label>
              <label className="block text-sm font-semibold text-[#002141] md:col-span-2">Extrait *
                <textarea value={form.excerpt} onChange={(event) => updateForm('excerpt', event.target.value)} className="admin-input mt-2 min-h-24 resize-y" maxLength={600} placeholder="Résumé affiché dans les cartes du journal." />
                <span className="mt-1 block text-right text-xs font-normal text-[#3A3A3A]">{form.excerpt.length}/600</span>
              </label>
              <label className="block text-sm font-semibold text-[#002141] md:col-span-2">Tags
                <div className="relative mt-2"><Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AC854B]" aria-hidden="true" /><input value={form.tags_text} onChange={(event) => updateForm('tags_text', event.target.value)} className="admin-input pl-10" placeholder="horlogerie, guide, entretien" /></div>
                <span className="mt-1 block text-xs font-normal text-[#3A3A3A]">Séparez les tags par une virgule.</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-6 border border-[#002141]/15 p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold text-[#002141]">Image à la une</legend>
            <div className="mt-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_13rem]">
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-[#002141]">Image provenant de la Galerie média
                  <select value={form.cover_media_id} onChange={(event) => { updateForm('cover_media_id', event.target.value); if (event.target.value) updateForm('cover_image', ''); }} className="admin-input mt-2">
                    <option value="">Choisir une image existante</option>
                    {usableMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.file_name || asset.alt_text || `Média ${String(asset.id).slice(0, 8)}`}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-[#002141]">Ou URL d’image existante
                  <input value={form.cover_image} onChange={(event) => { updateForm('cover_image', event.target.value); if (event.target.value) updateForm('cover_media_id', ''); }} className="admin-input mt-2" placeholder="https://…" inputMode="url" />
                </label>
                <p className="text-xs leading-relaxed text-[#3A3A3A]">Pour une image gérée, importez-la d’abord dans « Galerie média », avec son texte alternatif. Une image à la une est requise pour publier ou programmer.</p>
              </div>
              <div className="aspect-4/3 overflow-hidden border border-dashed border-[#002141]/20 bg-[#FAF9F7]">
                {selectedCover || form.cover_image ? <img src={selectedCover?.public_url || form.cover_image} alt={selectedCover?.alt_text || form.title || 'Aperçu de l’image à la une'} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[#3A3A3A]"><ImageIcon className="h-6 w-6 text-[#AC854B]" aria-hidden="true" />Aperçu de la couverture</div>}
              </div>
            </div>
          </fieldset>

          <div className="mt-6">
            <RichTextEditor id="blog-content-html" label="Contenu de l’article *" value={form.content_html} onChange={(value) => updateForm('content_html', value)} imageAssets={usableMedia.map((asset) => ({ id: String(asset.id), public_url: String(asset.public_url), alt_text: asset.alt_text ? String(asset.alt_text) : null, label: asset.file_name || asset.alt_text || `Média ${String(asset.id).slice(0, 8)}` }))} hint="Titres, gras, italique, listes, citations, liens, images, tableaux, alignement, annulation/rétablissement et plein écran sont disponibles." />
          </div>

          <fieldset className="mt-6 border border-[#002141]/15 p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold text-[#002141]">Produits liés <span className="font-normal text-[#3A3A3A]">(facultatif)</span></legend>
            {products.length === 0 ? <p className="mt-2 text-sm text-[#3A3A3A]">Aucun produit n’est actuellement disponible pour cette liaison.</p> : <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{products.map((product) => <label key={product.id} className="flex min-h-11 items-center gap-3 border border-[#002141]/15 px-3 text-sm text-[#002141]"><input type="checkbox" checked={form.related_product_ids.includes(String(product.id))} onChange={() => toggleRelatedProduct(String(product.id))} className="h-4 w-4 accent-[#AC854B]" /><span className="min-w-0"><span className="block truncate font-semibold">{product.name || 'Produit sans nom'}</span><span className="block truncate text-xs text-[#3A3A3A]">{product.reference || product.sku || String(product.id)}</span></span></label>)}</div>}
          </fieldset>

          <fieldset className="mt-6 border border-[#002141]/15 p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold text-[#002141]">Publication et SEO</legend>
            <div className="mt-2 grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-[#002141]">Statut
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value as ArticleStatus)} className="admin-input mt-2">{(Object.keys(STATUS_LABELS) as ArticleStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
              </label>
              <label className="block text-sm font-semibold text-[#002141]">Date et heure de publication
                <div className="relative mt-2"><Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AC854B]" aria-hidden="true" /><input type="datetime-local" value={form.published_at} onChange={(event) => updateForm('published_at', event.target.value)} className="admin-input pl-10" /></div>
              </label>
              <label className="block text-sm font-semibold text-[#002141]">Titre SEO
                <input value={form.seo_title} onChange={(event) => updateForm('seo_title', event.target.value)} className="admin-input mt-2" maxLength={180} placeholder="Titre affiché dans les moteurs de recherche" />
                <span className={`mt-1 block text-right text-xs font-normal ${form.seo_title.length > 60 ? 'text-red-800' : 'text-[#3A3A3A]'}`}>{form.seo_title.length}/60 conseillé</span>
              </label>
              <label className="block text-sm font-semibold text-[#002141]">Méta description
                <textarea value={form.seo_description} onChange={(event) => updateForm('seo_description', event.target.value)} className="admin-input mt-2 min-h-24 resize-y" maxLength={320} placeholder="Description affichée dans les moteurs de recherche" />
                <span className={`mt-1 block text-right text-xs font-normal ${form.seo_description.length > 160 ? 'text-red-800' : 'text-[#3A3A3A]'}`}>{form.seo_description.length}/160 conseillé</span>
              </label>
            </div>
            <p className="mt-4 border-l-2 border-[#AC854B] bg-[#FFF9EF] px-3 py-2 text-xs leading-relaxed text-[#3A3A3A]">Un article « Programmé » reste invisible jusqu’à la date indiquée. Si une date future est saisie pour un article « Publié », elle est automatiquement programmée côté serveur.</p>
          </fieldset>

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="submit" disabled={submitting} className="admin-primary-button">{submitting ? 'Enregistrement…' : editing.id ? 'Enregistrer les modifications' : 'Créer l’article'}</button>
            <button type="button" onClick={closeEditor} className="admin-secondary-button">Annuler</button>
          </div>
        </form>
      )}

      <div className="mb-5 grid gap-3 border border-[#002141]/15 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_12rem_14rem_auto] lg:items-end">
        <label className="block text-xs font-semibold text-[#002141]">Rechercher
          <div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AC854B]" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="admin-input pl-10" placeholder="Titre, slug, extrait ou tag" /></div>
        </label>
        <label className="block text-xs font-semibold text-[#002141]">Statut
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ArticleStatus)} className="admin-input mt-2"><option value="all">Tous les statuts</option>{(Object.keys(STATUS_LABELS) as ArticleStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
        </label>
        <label className="block text-xs font-semibold text-[#002141]">Catégorie
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="admin-input mt-2"><option value="all">Toutes les catégories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
        </label>
        <p className="pb-3 text-xs text-[#3A3A3A]">{visibleArticles.length} article(s)</p>
      </div>

      {visibleArticles.length === 0 ? (
        <div className="border border-dashed border-[#002141]/20 bg-white px-5 py-10 text-center"><BookOpen className="mx-auto h-7 w-7 text-[#AC854B]" aria-hidden="true" /><p className="font-playfair mt-3 text-lg font-semibold text-[#002141]">Aucun article à afficher</p><p className="mt-2 text-sm text-[#3A3A3A]">{articles.length ? 'Modifiez la recherche ou les filtres.' : 'Créez le premier article depuis le bouton « Nouvel article ».'}</p></div>
      ) : (
        <div className="divide-y divide-[#002141]/10 border border-[#002141]/15 bg-white">
          {visibleArticles.map((article) => {
            const status = (['draft', 'scheduled', 'published', 'archived'].includes(article.status) ? article.status : 'draft') as ArticleStatus;
            const cover = usableMedia.find((asset) => String(asset.id) === String(article.cover_media_id));
            const articleTags = asStringArray(article.tags);
            return <article key={article.id} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 gap-4">
                <div className="h-20 w-24 shrink-0 overflow-hidden bg-[#F5F3EF]">{cover || article.cover_image ? <img src={cover?.public_url || article.cover_image} alt={cover?.alt_text || article.title || ''} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-5 w-5 text-[#AC854B]" aria-hidden="true" /></div>}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-playfair text-lg font-semibold text-[#002141]">{article.title || 'Article sans titre'}</h2><span className={`inline-flex shrink-0 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span></div>
                  <p className="mt-1 truncate text-xs text-[#3A3A3A]">/{article.slug || 'sans-slug'} · {article.category || 'Sans catégorie'} · {readableDate(article.published_at || article.updated_at)} · {article.author?.full_name || article.author?.email || 'Administrateur HERITAGE'}</p>
                  {article.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#3A3A3A]">{article.excerpt}</p>}
                  {articleTags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{articleTags.map((tag) => <span key={tag} className="border border-[#AC854B]/30 bg-[#FFF9EF] px-2 py-0.5 text-[10px] font-semibold text-[#76531D]">{tag}</span>)}</div>}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 lg:self-start"><button type="button" onClick={() => startEdit(article)} className="admin-secondary-button"><Pencil className="h-4 w-4" aria-hidden="true" /> Modifier</button><button type="button" onClick={() => void remove(article)} className="admin-icon-button text-red-800 hover:border-red-300 hover:bg-red-50" aria-label={`Supprimer l’article ${article.title || ''}`}><Trash2 className="h-4 w-4" /></button></div>
            </article>;
          })}
        </div>
      )}
    </>
  );
};

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  GalleryVerticalEnd,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  UsersRound,
  X
} from 'lucide-react';
import { adminRequest, AdminSession, downloadAdminCsv, getAdminSession, signOutAdministrator } from '../../lib/admin-api';
import { RichTextEditor } from './RichTextEditor';

interface AdminPortalViewProps {
  navigate: (route: string) => void;
}

type AdminTab =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'administrators'
  | 'users'
  | 'media'
  | 'messages'
  | 'reviews'
  | 'blogs'
  | 'faqs'
  | 'legal'
  | 'meta'
  | 'coordinates'
  | 'pixels';

type AnyRecord = Record<string, any>;

const NAVIGATION: Array<{ id: AdminTab; label: string; icon: React.ElementType; section?: string }> = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, section: 'Pilotage' },
  { id: 'products', label: 'Produits / Stocks', icon: Boxes, section: 'Commerce' },
  { id: 'orders', label: 'Commandes', icon: ClipboardList },
  { id: 'administrators', label: 'Administrateurs', icon: ShieldCheck, section: 'Accès' },
  { id: 'users', label: 'Utilisateurs', icon: UsersRound },
  { id: 'media', label: 'Galerie média', icon: GalleryVerticalEnd, section: 'Contenus' },
  { id: 'messages', label: 'Messages reçus', icon: Mail },
  { id: 'reviews', label: 'Avis', icon: Star },
  { id: 'blogs', label: 'Blogs', icon: BookOpen },
  { id: 'faqs', label: 'F.A.Q', icon: MessageSquareText },
  { id: 'legal', label: 'Pages légales', icon: FileText },
  { id: 'meta', label: 'Méta description', icon: SlidersHorizontal },
  { id: 'coordinates', label: 'Coordonnées', icon: Settings2 },
  { id: 'pixels', label: 'Pixels', icon: BarChart3 }
];

const emptyProduct = (): AnyRecord => ({
  name: '',
  slug: '',
  sku: '',
  reference: '',
  brand: '',
  category: 'montres',
  short_description: '',
  description_html: '',
  purchase_price_xof: 0,
  regular_price_xof: 0,
  sale_price_xof: '',
  stock_quantity: 0,
  low_stock_threshold: 2,
  status: 'draft',
  primary_media_id: '',
  colors: '[]',
  attributes: '{}',
  faq: '[]',
  variants: '[]',
  media_ids: [],
  seo_title: '',
  seo_description: ''
});

const formatXOF = (value: number) => new Intl.NumberFormat('fr-FR').format(Number(value || 0)) + ' FCFA';

const toJsonText = (value: unknown, fallback = '[]') => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
};

const toProductForm = (product: AnyRecord): AnyRecord => ({
  ...emptyProduct(),
  ...product,
  colors: toJsonText(product.colors),
  attributes: toJsonText(product.attributes, '{}'),
  faq: toJsonText(product.faq),
  variants: toJsonText(product.product_variants || product.variants),
  media_ids: (product.media_assets || []).map((asset: AnyRecord) => asset.id)
});

const statusLabel: Record<string, string> = {
  pending_payment: 'Commande reçue',
  payment_pending: 'Commande à valider',
  paid: 'Commande validée',
  processing: 'En préparation',
  shipped_or_ready: 'Expédiée / prête',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Annulée / Remboursée',
  payment_failed: 'Commande non aboutie'
};

interface ResourceField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select' | 'checkbox' | 'rich' | 'datetime-local' | 'multi';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
}

interface ResourceConfig {
  key: 'reviews' | 'blogs' | 'faqs' | 'legal' | 'meta' | 'pixels';
  title: string;
  description: string;
  fields: ResourceField[];
  summary: (item: AnyRecord) => string;
}

const RESOURCE_CONFIGS: Record<'reviews' | 'blogs' | 'faqs' | 'legal' | 'meta' | 'pixels', ResourceConfig> = {
  reviews: {
    key: 'reviews',
    title: 'Avis clients',
    description: 'Approuvez, refusez ou supprimez les avis avant leur diffusion.',
    fields: [
      { name: 'author_name', label: 'Nom affiché', required: true },
      { name: 'author_email', label: 'E-mail', type: 'text' },
      { name: 'product_id', label: 'Identifiant du produit', placeholder: 'UUID du produit concerné' },
      { name: 'rating', label: 'Note', type: 'select', options: [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} / 5` })) },
      { name: 'title', label: 'Titre de l’avis' },
      { name: 'body', label: 'Contenu', type: 'textarea', required: true },
      { name: 'status', label: 'Statut', type: 'select', options: ['pending', 'approved', 'rejected'].map((value) => ({ value, label: value === 'pending' ? 'En attente' : value === 'approved' ? 'Approuvé' : 'Refusé' })) },
      { name: 'verified_purchase', label: 'Commande vérifiée', type: 'checkbox' },
      { name: 'manually_validated', label: 'Validation manuelle', type: 'checkbox' },
      { name: 'is_featured_home', label: 'Mettre en avant sur l’accueil', type: 'checkbox' },
      { name: 'is_featured_contact', label: 'Mettre en avant sur Contact', type: 'checkbox' },
      { name: 'merchant_response', label: 'Réponse de la boutique', type: 'textarea' }
    ],
    summary: (item) => `${item.rating || 0}/5 · ${item.author_name || 'Client'} · ${item.status || 'pending'}`
  },
  blogs: {
    key: 'blogs',
    title: 'Articles du blog',
    description: 'Rédigez, optimisez et publiez les articles éditoriaux de HERITAGE.',
    fields: [
      { name: 'title', label: 'Titre', required: true },
      { name: 'slug', label: 'Lien', placeholder: 'guide-choisir-sa-montre' },
      { name: 'excerpt', label: 'Extrait', type: 'textarea' },
      { name: 'content_html', label: 'Article', type: 'rich', required: true },
      { name: 'cover_media_id', label: 'Identifiant du média de couverture' },
      { name: 'cover_image', label: 'URL de couverture existante (optionnel)' },
      { name: 'category', label: 'Catégorie éditoriale' },
      { name: 'tags', label: 'Tags (JSON)', type: 'textarea', placeholder: '["horlogerie", "guide"]' },
      { name: 'related_product_ids', label: 'Produits liés (JSON)', type: 'textarea', placeholder: '["id-produit"]' },
      { name: 'status', label: 'Publication', type: 'select', options: ['draft', 'scheduled', 'published', 'archived'].map((value) => ({ value, label: value === 'draft' ? 'Brouillon' : value === 'scheduled' ? 'Programmé' : value === 'published' ? 'Publié' : 'Archivé' })) },
      { name: 'published_at', label: 'Date de publication / programmation', type: 'datetime-local' },
      { name: 'seo_title', label: 'Titre SEO' },
      { name: 'seo_description', label: 'Description SEO', type: 'textarea' }
    ],
    summary: (item) => `${item.status === 'published' ? 'Publié' : 'Brouillon'} · ${item.updated_at ? new Date(item.updated_at).toLocaleDateString('fr-FR') : 'À rédiger'}`
  },
  faqs: {
    key: 'faqs',
    title: 'Foire aux questions',
    description: 'Organisez les réponses visibles sur l’accueil, le catalogue et la page contact.',
    fields: [
      { name: 'placements', label: 'Emplacements', type: 'multi', options: [{ value: 'home', label: 'Accueil' }, { value: 'catalog', label: 'Boutique / catalogue' }, { value: 'contact', label: 'Contact' }] },
      { name: 'category', label: 'Catégorie' },
      { name: 'question', label: 'Question', required: true },
      { name: 'answer_html', label: 'Réponse', type: 'rich', required: true },
      { name: 'sort_order', label: 'Ordre', type: 'text' },
      { name: 'is_active', label: 'Visible', type: 'checkbox' }
    ],
    summary: (item) => `${item.placement || 'all'} · ${item.is_active ? 'Visible' : 'Masquée'}`
  },
  legal: {
    key: 'legal',
    title: 'Pages légales',
    description: 'Modifiez les pages légales avec un éditeur riche complet.',
    fields: [
      { name: 'page_key', label: 'Page', type: 'select', options: [{ value: 'mentions-legales', label: 'Mentions légales' }, { value: 'cgv', label: 'Conditions générales de vente' }, { value: 'confidentialite', label: 'Confidentialité' }, { value: 'livraison-retours', label: 'Livraison et retours' }, { value: 'garantie-service', label: 'Garantie et service' }, { value: 'authenticite-provenance', label: 'Authenticité et provenance' }, { value: 'cookies', label: 'Cookies' }] },
      { name: 'title', label: 'Titre', required: true },
      { name: 'content_html', label: 'Contenu', type: 'rich', required: true },
      { name: 'status', label: 'Statut', type: 'select', options: [{ value: 'draft', label: 'Brouillon — non visible' }, { value: 'published', label: 'Publié' }] }
    ],
    summary: (item) => item.page_key || 'Page légale'
  },
  meta: {
    key: 'meta',
    title: 'Méta description',
    description: 'Gérez les balises de chaque page éditoriale, hors fiches produit.',
    fields: [
      { name: 'page_key', label: 'Page', type: 'select', required: true, options: [{ value: 'accueil', label: 'Accueil' }, { value: 'montres', label: 'Montres' }, { value: 'parfums', label: 'Parfums' }, { value: 'lunettes', label: 'Lunettes' }, { value: 'a-propos', label: 'À propos' }, { value: 'contact', label: 'Contact' }, { value: 'blog', label: 'Journal / Blog' }, { value: 'authenticite-provenance', label: 'Authenticité / provenance' }, { value: 'livraison-retours', label: 'Livraison / retours' }, { value: 'garantie-service', label: 'Garantie / service' }, { value: 'mentions-legales', label: 'Mentions légales' }, { value: 'cgv', label: 'CGV' }, { value: 'confidentialite', label: 'Confidentialité' }, { value: 'cookies', label: 'Cookies' }] },
      { name: 'title', label: 'Titre de la page', required: true },
      { name: 'description', label: 'Description, 160 caractères conseillés', type: 'textarea', required: true },
      { name: 'og_title', label: 'Titre de partage' },
      { name: 'og_description', label: 'Description de partage', type: 'textarea' },
      { name: 'og_media_id', label: 'Identifiant de l’image OG' },
      { name: 'no_index', label: 'Empêcher l’indexation', type: 'checkbox' }
    ],
    summary: (item) => item.page_key || 'Page'
  },
  pixels: {
    key: 'pixels',
    title: 'Pixels et tracking',
    description: 'Centralisez les identifiants Meta, Google Ads et Analytics. Aucun script arbitraire ne peut être injecté auprès des visiteurs.',
    fields: [
      { name: 'provider', label: 'Plateforme', type: 'select', options: [{ value: 'meta', label: 'Meta Pixel' }, { value: 'google_ads', label: 'Google Ads' }, { value: 'google_analytics', label: 'Google Analytics' }] },
      { name: 'label', label: 'Nom interne', required: true },
      { name: 'pixel_id', label: 'Identifiant du pixel' },
      { name: 'requires_consent', label: 'Exiger le consentement', type: 'checkbox' },
      { name: 'is_test', label: 'Mode test (non injecté en production)', type: 'checkbox' },
      { name: 'is_active', label: 'Actif', type: 'checkbox' }
    ],
    summary: (item) => `${item.provider || 'custom'} · ${item.is_active ? 'Actif' : 'Inactif'}`
  }
};

function PanelHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-[#002141]/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AC854B]">{eyebrow}</p>
        <h1 className="admin-page-title font-playfair mt-2 font-semibold text-[#002141]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#3A3A3A]">{description}</p>
      </div>
      {action && <div className="shrink-0 self-start">{action}</div>}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="admin-empty-state border border-dashed border-[#002141]/20 bg-white px-5 py-8 text-center">
      <p className="font-playfair text-lg font-semibold text-[#002141]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#3A3A3A]">{body}</p>
    </div>
  );
}

function DataUnavailable({ message }: { message: string }) {
  return (
    <div role="alert" className="admin-empty-state border border-[#AC854B]/45 bg-[#fffaf0] px-5 py-8 text-center">
      <p className="font-playfair text-lg font-semibold text-[#002141]">Les données du portail sont indisponibles</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#3A3A3A]">{message}</p>
      <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-[#3A3A3A]">Aucun produit n’a été supprimé. Vérifiez la migration CMS dans Supabase, puis actualisez cette page.</p>
    </div>
  );
}

const readArray = (value: unknown): AnyRecord[] => {
  try { const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

const readObject = (value: unknown): Record<string, string> => {
  try { const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item ?? '')])) : {}; } catch { return {}; }
};

function ProductStructuredFields({ form, onChange }: { form: AnyRecord; onChange: (field: string, value: string) => void }) {
  const colors = readArray(form.colors).map(String);
  const attributes = Object.entries(readObject(form.attributes));
  const variants = readArray(form.variants);
  const faqs = readArray(form.faq);
  const saveAttributes = (entries: Array<[string, string]>) => onChange('attributes', JSON.stringify(Object.fromEntries(entries.filter(([key]) => key.trim()))));

  return <div className="md:col-span-2 xl:col-span-3 space-y-6">
    <fieldset className="border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">Couleurs</legend><input value={colors.join(', ')} onChange={(event) => onChange('colors', JSON.stringify(event.target.value.split(',').map((value) => value.trim()).filter(Boolean)))} className="admin-input mt-2" placeholder="Acier, Bleu, Or…" /></fieldset>
    <fieldset className="border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">Caractéristiques techniques</legend><p className="mt-1 text-xs text-[#3A3A3A]">Exemples : diamètre, boîtier, verre, mouvement, réserve de marche, bracelet, étanchéité, fond de boîte.</p><div className="mt-3 space-y-2">{attributes.map(([key, value], index) => <div key={`${key}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input value={key} onChange={(event) => { const next = [...attributes]; next[index] = [event.target.value, value]; saveAttributes(next); }} className="admin-input" placeholder="Caractéristique" /><input value={value} onChange={(event) => { const next = [...attributes]; next[index] = [key, event.target.value]; saveAttributes(next); }} className="admin-input" placeholder="Valeur" /><button type="button" onClick={() => saveAttributes(attributes.filter((_, current) => current !== index))} className="admin-icon-button text-red-800" aria-label="Supprimer la caractéristique"><Trash2 className="h-4 w-4" /></button></div>)}</div><button type="button" onClick={() => saveAttributes([...attributes, ['', '']])} className="admin-secondary-button mt-3">Ajouter une caractéristique</button></fieldset>
    <fieldset className="border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">Variantes</legend><div className="mt-3 space-y-3">{variants.map((variant, index) => <div key={index} className="grid gap-2 border border-[#002141]/10 p-3 sm:grid-cols-4"><input value={variant.name || ''} onChange={(event) => { const next = [...variants]; next[index] = { ...variant, name: event.target.value }; onChange('variants', JSON.stringify(next)); }} className="admin-input" placeholder="Nom (ex. 40 mm)" /><input value={variant.sku || ''} onChange={(event) => { const next = [...variants]; next[index] = { ...variant, sku: event.target.value }; onChange('variants', JSON.stringify(next)); }} className="admin-input" placeholder="SKU" /><input type="number" value={variant.stock_quantity ?? 0} onChange={(event) => { const next = [...variants]; next[index] = { ...variant, stock_quantity: Number(event.target.value) }; onChange('variants', JSON.stringify(next)); }} className="admin-input" placeholder="Stock" /><div className="flex gap-2"><input type="number" value={variant.sale_price_xof ?? ''} onChange={(event) => { const next = [...variants]; next[index] = { ...variant, sale_price_xof: event.target.value }; onChange('variants', JSON.stringify(next)); }} className="admin-input" placeholder="Prix FCFA" /><button type="button" onClick={() => onChange('variants', JSON.stringify(variants.filter((_, current) => current !== index)))} className="admin-icon-button text-red-800" aria-label="Supprimer la variante"><Trash2 className="h-4 w-4" /></button></div></div>)}</div><button type="button" onClick={() => onChange('variants', JSON.stringify([...variants, { name: '', sku: '', stock_quantity: 0, sale_price_xof: '', options: {}, is_active: true }]))} className="admin-secondary-button mt-3">Ajouter une variante</button></fieldset>
    <fieldset className="border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">F.A.Q. de ce produit uniquement</legend><div className="mt-3 space-y-3">{faqs.map((faq, index) => <div key={index} className="space-y-2 border border-[#002141]/10 p-3"><input value={faq.question || ''} onChange={(event) => { const next = [...faqs]; next[index] = { ...faq, question: event.target.value }; onChange('faq', JSON.stringify(next)); }} className="admin-input" placeholder="Question" /><textarea value={faq.answer || ''} onChange={(event) => { const next = [...faqs]; next[index] = { ...faq, answer: event.target.value }; onChange('faq', JSON.stringify(next)); }} className="admin-input min-h-20" placeholder="Réponse" /><button type="button" onClick={() => onChange('faq', JSON.stringify(faqs.filter((_, current) => current !== index)))} className="text-xs font-semibold text-red-800">Supprimer</button></div>)}</div><button type="button" onClick={() => onChange('faq', JSON.stringify([...faqs, { question: '', answer: '' }]))} className="admin-secondary-button mt-3">Ajouter une question</button></fieldset>
  </div>;
}

function ResourceManager({
  config,
  items,
  onRefresh,
  onNotify
}: {
  config: ResourceConfig;
  items: AnyRecord[];
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<AnyRecord>({});
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [draggedFaqId, setDraggedFaqId] = useState<string | null>(null);
  const pageSize = 12;
  const filteredItems = useMemo(() => items.filter((item) => JSON.stringify(item).toLocaleLowerCase('fr-FR').includes(search.toLocaleLowerCase('fr-FR'))), [items, search]);
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const startCreate = () => {
    const initial: AnyRecord = {};
    config.fields.forEach((field) => {
      initial[field.name] = field.type === 'checkbox' ? false : field.type === 'multi' ? [] : field.name === 'rating' ? '5' : field.name === 'status' ? 'draft' : '';
    });
    if (config.key === 'reviews') initial.status = 'pending';
    if (config.key === 'faqs') {
      initial.placement = 'all';
      initial.is_active = true;
    }
    if (config.key === 'pixels') {
      initial.provider = 'meta';
      initial.is_active = true;
      initial.requires_consent = true;
    }
    setEditing({});
    setForm(initial);
  };

  const startEdit = (item: AnyRecord) => {
    setEditing(item);
    const next = { ...item };
    config.fields.forEach((field) => {
      if (next[field.name] === null || next[field.name] === undefined) next[field.name] = field.type === 'checkbox' ? false : '';
      if (field.type === 'multi' && !Array.isArray(next[field.name])) {
        try { next[field.name] = JSON.parse(next[field.name] || '[]'); } catch { next[field.name] = []; }
      }
      if (field.type === 'datetime-local' && next[field.name]) next[field.name] = String(next[field.name]).slice(0, 16);
    });
    setForm(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editing?.id) await adminRequest(`/resources/${config.key}/${editing.id}`, { method: 'PATCH', body: form });
      else await adminRequest(`/resources/${config.key}`, { method: 'POST', body: form });
      setEditing(null);
      setForm({});
      await onRefresh();
      onNotify(editing?.id ? 'Modification enregistrée.' : 'Élément créé.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (item: AnyRecord) => {
    if (!window.confirm('Supprimer définitivement cet élément ?')) return;
    try {
      await adminRequest(`/resources/${config.key}/${item.id}`, { method: 'DELETE' });
      await onRefresh();
      onNotify('Élément supprimé.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const reorderFaq = async (targetId: string) => {
    if (config.key !== 'faqs' || !draggedFaqId || draggedFaqId === targetId) return;
    const ordered = [...items];
    const fromIndex = ordered.findIndex((item) => item.id === draggedFaqId);
    const targetIndex = ordered.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    try {
      await adminRequest('/faqs/reorder', { method: 'PUT', body: { ids: ordered.map((item) => item.id) } });
      await onRefresh();
      onNotify('Ordre des questions enregistré.');
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Réorganisation impossible.'); }
    finally { setDraggedFaqId(null); }
  };

  return (
    <>
      <PanelHeader
        eyebrow="Gestion de contenu"
        title={config.title}
        description={config.description}
        action={<button type="button" onClick={startCreate} className="admin-primary-button"><Plus className="h-4 w-4" aria-hidden="true" /> Ajouter</button>}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="sr-only" htmlFor={`${config.key}-search`}>Rechercher</label>
        <input id={`${config.key}-search`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher…" className="admin-input max-w-sm" />
        <p className="text-xs text-[#3A3A3A]">{filteredItems.length} élément(s)</p>
      </div>

      {editing !== null && (
        <form onSubmit={submit} className="mb-8 border border-[#002141]/15 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-playfair text-2xl font-semibold text-[#002141]">{editing.id ? 'Modifier' : 'Ajouter'}</h2>
              <p className="mt-1 text-sm text-[#3A3A3A]">Les champs marqués par le navigateur comme obligatoires doivent être renseignés.</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} className="admin-icon-button" aria-label="Fermer le formulaire"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {config.fields.map((field) => (
              <div key={field.name} className={field.type === 'textarea' || field.type === 'rich' ? 'md:col-span-2' : ''}>
                {field.type === 'rich' ? (
                  <RichTextEditor id={`${config.key}-${field.name}`} label={field.label} value={String(form[field.name] || '')} onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))} />
                ) : field.type === 'checkbox' ? (
                  <label className="flex min-h-12 items-center gap-3 border border-[#002141]/15 px-4 text-sm font-semibold text-[#002141]">
                    <input type="checkbox" checked={Boolean(form[field.name])} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))} className="h-4 w-4 accent-[#AC854B]" />
                    {field.label}
                  </label>
                ) : field.type === 'multi' ? (
                  <fieldset className="border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">{field.label}</legend><div className="mt-2 flex flex-wrap gap-4">{field.options?.map((option) => <label key={option.value} className="flex items-center gap-2 text-sm text-[#002141]"><input type="checkbox" checked={(Array.isArray(form[field.name]) ? form[field.name] : []).includes(option.value)} onChange={(event) => setForm((current) => { const selected = Array.isArray(current[field.name]) ? current[field.name] : []; return { ...current, [field.name]: event.target.checked ? [...selected, option.value] : selected.filter((value: string) => value !== option.value) }; })} className="h-4 w-4 accent-[#AC854B]" />{option.label}</label>)}</div></fieldset>
                ) : (
                  <label className="block text-sm font-semibold text-[#002141]">
                    {field.label}
                    {field.type === 'select' ? (
                      <select value={String(form[field.name] || '')} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} className="admin-input mt-2" required={field.required}>
                        {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea value={String(form[field.name] || '')} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} className="admin-input mt-2 min-h-28 resize-y" required={field.required} placeholder={field.placeholder} />
                    ) : (
                      <input type={field.type === 'datetime-local' ? 'datetime-local' : 'text'} value={String(form[field.name] || '')} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} className="admin-input mt-2" required={field.required} placeholder={field.placeholder} />
                    )}
                  </label>
                )}
              </div>
            ))}
          </div>
          {config.key === 'meta' && <div className="mt-6 border border-[#002141]/15 bg-[#FAF9F7] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#AC854B]">Aperçu Google</p><p className="mt-3 truncate text-lg text-[#1a0dab]">{form.title || 'Titre de la page'}</p><p className="mt-1 text-xs text-emerald-800">heritage.ci/{form.page_key || 'page'}</p><p className="mt-1 text-sm text-[#3A3A3A]">{form.description || 'La description apparaîtra ici.'}</p><p className={`mt-3 text-xs ${String(form.title || '').length > 60 || String(form.description || '').length > 160 ? 'text-red-800' : 'text-[#3A3A3A]'}`}>Titre : {String(form.title || '').length}/60 · Description : {String(form.description || '').length}/160</p></div>}
          {config.key === 'blogs' && <div className="mt-6 border border-[#002141]/15 bg-[#FAF9F7] p-4 text-xs text-[#3A3A3A]">Le statut “Programmé” ne sera visible publiquement qu’à la date et l’heure sélectionnées. Les articles brouillon et archivés restent invisibles.</div>}
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="submit" disabled={submitting} className="admin-primary-button">{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
            <button type="button" onClick={() => setEditing(null)} className="admin-secondary-button">Annuler</button>
          </div>
        </form>
      )}

      {filteredItems.length === 0 ? <EmptyState title={items.length ? 'Aucun résultat' : 'Aucun élément'} body={items.length ? 'Modifiez votre recherche.' : 'Créez le premier élément avec le bouton Ajouter.'} /> : (
        <div className="divide-y divide-[#002141]/10 border border-[#002141]/15 bg-white">
          {paginatedItems.map((item) => (
            <article key={item.id} draggable={config.key === 'faqs'} onDragStart={() => setDraggedFaqId(item.id)} onDragOver={(event) => { if (config.key === 'faqs') event.preventDefault(); }} onDrop={() => void reorderFaq(item.id)} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${config.key === 'faqs' ? 'cursor-grab' : ''}`}>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-[#002141]">{item.title || item.question || item.label || item.author_name || item.page_key || 'Élément sans titre'}</h2>
                <p className="mt-1 text-sm text-[#3A3A3A]">{config.summary(item)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => startEdit(item)} className="admin-icon-button" aria-label="Modifier"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(item)} className="admin-icon-button text-red-800 hover:border-red-300 hover:bg-red-50" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      {filteredItems.length > pageSize && <div className="mt-4 flex items-center justify-between"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="admin-secondary-button disabled:opacity-40">Précédent</button><span className="text-xs text-[#3A3A3A]">Page {page} / {totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="admin-secondary-button disabled:opacity-40">Suivant</button></div>}
    </>
  );
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({ navigate }) => {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('heritage-admin-sidebar-collapsed') === 'true');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [dashboard, setDashboard] = useState<AnyRecord | null>(null);
  const [products, setProducts] = useState<AnyRecord[]>([]);
  const [orders, setOrders] = useState<AnyRecord[]>([]);
  const [administrators, setAdministrators] = useState<AnyRecord[]>([]);
  const [invitations, setInvitations] = useState<AnyRecord[]>([]);
  const [users, setUsers] = useState<AnyRecord[]>([]);
  const [media, setMedia] = useState<AnyRecord[]>([]);
  const [contactMessages, setContactMessages] = useState<AnyRecord[]>([]);
  const [resources, setResources] = useState<Record<string, AnyRecord[]>>({});
  const [siteSettings, setSiteSettings] = useState<AnyRecord | null>(null);
  const [editingProduct, setEditingProduct] = useState<AnyRecord | null>(null);
  const [productForm, setProductForm] = useState<AnyRecord>(emptyProduct());
  const [generatedCode, setGeneratedCode] = useState('');
  const [auditLogs, setAuditLogs] = useState<AnyRecord[]>([]);
  const [dashboardPeriod, setDashboardPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('month');
  const [dashboardCustomFrom, setDashboardCustomFrom] = useState('');
  const [dashboardCustomTo, setDashboardCustomTo] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');

  const dashboardUrl = () => {
    const now = new Date();
    const from = new Date(now);
    if (dashboardPeriod === 'day') from.setHours(0, 0, 0, 0);
    if (dashboardPeriod === 'week') from.setDate(now.getDate() - 6);
    if (dashboardPeriod === 'month') from.setDate(now.getDate() - 29);
    const start = dashboardPeriod === 'custom' && dashboardCustomFrom ? new Date(dashboardCustomFrom) : from;
    const end = dashboardPeriod === 'custom' && dashboardCustomTo ? new Date(`${dashboardCustomTo}T23:59:59`) : now;
    return `/dashboard?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`;
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem('heritage-admin-sidebar-collapsed', String(next));
      return next;
    });
  };

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 5500);
  };

  const loadTab = async (tab: AdminTab) => {
    setLoading(true);
    setLoadError('');
    try {
      if (tab === 'dashboard') setDashboard(await adminRequest(dashboardUrl()));
      if (tab === 'products') {
        const [catalog, gallery, reviews] = await Promise.all([adminRequest<AnyRecord[]>('/products'), adminRequest<AnyRecord[]>('/media'), adminRequest<AnyRecord[]>('/resources/reviews')]);
        setProducts(catalog);
        setMedia(gallery);
        setResources((current) => ({ ...current, reviews }));
      }
      if (tab === 'orders') setOrders(await adminRequest('/orders'));
      if (tab === 'administrators') {
        const response = await adminRequest<{ administrators: AnyRecord[]; invitations: AnyRecord[]; auditLogs: AnyRecord[] }>('/administrators');
        setAdministrators(response.administrators);
        setInvitations(response.invitations);
        setAuditLogs(response.auditLogs || []);
      }
      if (tab === 'users') setUsers(await adminRequest('/users'));
      if (tab === 'media') setMedia(await adminRequest('/media'));
      if (tab === 'messages') setContactMessages(await adminRequest('/contact-messages'));
      if (tab === 'coordinates') setSiteSettings(await adminRequest('/site-settings'));
      if (['reviews', 'blogs', 'faqs', 'legal', 'meta', 'pixels'].includes(tab)) {
        const records = await adminRequest<AnyRecord[]>(`/resources/${tab}`);
        setResources((current) => ({ ...current, [tab]: records }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Les données ne sont pas disponibles.';
      setLoadError(message);
      notify(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAdminSession().then((session) => {
      if (!session) {
        navigate('/admin/login');
        return;
      }
      setAdmin(session);
      void loadTab('dashboard');
    });
  }, []);

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    void loadTab(tab);
  };

  const dashboardTotals = dashboard?.totals || {};
  const lowStockProducts = useMemo(() => products.filter((product) => Number(product.stock_quantity) <= Number(product.low_stock_threshold)), [products]);
  const visibleProducts = useMemo(() => products.filter((product) => {
    const query = productSearch.trim().toLocaleLowerCase('fr-FR');
    const matchesSearch = !query || [product.name, product.reference, product.sku, product.brand].some((value) => String(value || '').toLocaleLowerCase('fr-FR').includes(query));
    return matchesSearch && (!productStatusFilter || product.status === productStatusFilter) && (!productCategoryFilter || product.category === productCategoryFilter);
  }), [products, productSearch, productStatusFilter, productCategoryFilter]);
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const query = orderSearch.trim().toLocaleLowerCase('fr-FR');
    return (!query || [order.order_number, order.customer_name, order.customer_email, order.payment_reference].some((value) => String(value || '').toLocaleLowerCase('fr-FR').includes(query))) && (!orderStatusFilter || order.status === orderStatusFilter);
  }), [orders, orderSearch, orderStatusFilter]);
  const visibleUsers = useMemo(() => users.filter((user) => {
    const query = userSearch.trim().toLocaleLowerCase('fr-FR');
    return !query || [user.full_name, user.email, user.phone].some((value) => String(value || '').toLocaleLowerCase('fr-FR').includes(query));
  }), [users, userSearch]);

  const logout = async () => {
    await signOutAdministrator();
    navigate('/admin/login');
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      let product: AnyRecord;
      if (editingProduct?.id) product = await adminRequest(`/products/${editingProduct.id}`, { method: 'PATCH', body: productForm });
      else product = await adminRequest('/products', { method: 'POST', body: productForm });

      const variants = JSON.parse(productForm.variants || '[]');
      if (Array.isArray(variants)) await adminRequest(`/products/${product.id}/variants`, { method: 'PUT', body: { variants } });
      const mediaIds = Array.isArray(productForm.media_ids) ? productForm.media_ids : [];
      if (mediaIds.length || productForm.primary_media_id) await adminRequest(`/products/${product.id}/media`, { method: 'PUT', body: { media_ids: mediaIds, primary_media_id: productForm.primary_media_id || null } });
      setEditingProduct(null);
      setProductForm(emptyProduct());
      await loadTab('products');
      notify('Produit enregistré.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Le produit n’a pas pu être enregistré. Vérifiez les champs JSON.');
    }
  };

  const deleteProduct = async (product: AnyRecord) => {
    if (!window.confirm(`Supprimer « ${product.name} » ?`)) return;
    try {
      await adminRequest(`/products/${product.id}`, { method: 'DELETE' });
      await loadTab('products');
      notify('Produit supprimé.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const runBulkProductAction = async (action: 'publish' | 'unpublish' | 'archive' | 'delete') => {
    if (!selectedProductIds.length) return notify('Sélectionnez au moins un produit.');
    const label = action === 'publish' ? 'publier' : action === 'unpublish' ? 'dépublier' : action === 'archive' ? 'archiver' : 'supprimer définitivement';
    if (!window.confirm(`Confirmer : ${label} ${selectedProductIds.length} produit(s) ?`)) return;
    try {
      await adminRequest('/products/bulk', { method: 'POST', body: { ids: selectedProductIds, action } });
      setSelectedProductIds([]);
      await loadTab('products');
      notify(`Action groupée effectuée : ${label}.`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Action groupée impossible.'); }
  };

  const updateOrder = async (order: AnyRecord, status: string) => {
    try {
      let delivery_reference = order.delivery_reference || '';
      let delivery_proof_url = order.delivery_proof_url || '';
      if (status === 'delivered' && !delivery_reference && !delivery_proof_url) {
        delivery_reference = window.prompt('Référence ou preuve de livraison obligatoire :') || '';
        if (!delivery_reference) return notify('La commande reste inchangée : une preuve ou référence est obligatoire.');
      }
      const note = window.prompt('Note interne pour l’historique (facultative) :') || '';
      await adminRequest(`/orders/${order.id}`, { method: 'PATCH', body: { status, delivery_reference, delivery_proof_url, note } });
      await loadTab('orders');
      notify('Statut de commande mis à jour.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Mise à jour impossible.');
    }
  };

  const generateInvitation = async () => {
    try {
      const response = await adminRequest<{ code: string }>('/invitations', { method: 'POST' });
      setGeneratedCode(response.code);
      await loadTab('administrators');
      notify('Code créé. Copiez-le maintenant, il ne sera plus affiché après fermeture.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Création du code impossible.');
    }
  };

  const uploadMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(event.target.files || []) as File[];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { notify(`« ${file.name} » dépasse 10 Mo.`); continue; }
      const altText = window.prompt(`Texte alternatif obligatoire pour « ${file.name} » :`);
      if (!altText?.trim()) { notify(`« ${file.name} » n’a pas été ajouté : le texte alternatif est obligatoire.`); continue; }
      const folder = window.prompt(`Dossier pour « ${file.name} » (facultatif) :`, 'general') || 'general';
      try {
        const contentBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        });
        await adminRequest('/media/upload', { method: 'POST', body: { fileName: file.name, mimeType: file.type, contentBase64, altText: altText.trim(), folder } });
      } catch (error) { notify(error instanceof Error ? error.message : `Envoi de « ${file.name} » impossible.`); }
    }
    event.target.value = '';
    await loadTab('media');
    if (files.length) notify('Les images valides ont été ajoutées à la galerie.');
  };

  if (!admin) {
    return <div className="flex min-h-screen items-center justify-center bg-[#002141] text-sm text-[#FAF9F7]"><LoaderCircle className="mr-3 h-5 w-5 animate-spin" /> Vérification de l’accès…</div>;
  }

  const renderDashboard = () => {
    const chart = dashboard?.chart || [];
    const maxRevenue = Math.max(...chart.map((point: AnyRecord) => Number(point.revenueXOF || 0)), 1);
    const statuses = dashboardTotals.statuses || {};
    return <>
      <PanelHeader eyebrow="Pilotage" title="Tableau de bord" description="Une vue d’ensemble calculée depuis Supabase : activité commerciale, commandes, stock et contenus à traiter." action={<button type="button" onClick={() => void loadTab('dashboard')} className="admin-secondary-button"><RefreshCw className="h-4 w-4" /> Actualiser</button>} />
      <div className="mb-6 flex flex-wrap items-end gap-3 border border-[#002141]/12 bg-white p-4">
        <label className="text-xs font-semibold text-[#002141]">Période<select value={dashboardPeriod} onChange={(event) => setDashboardPeriod(event.target.value as typeof dashboardPeriod)} className="admin-input mt-1 min-w-40"><option value="day">Aujourd’hui</option><option value="week">7 derniers jours</option><option value="month">30 derniers jours</option><option value="custom">Personnalisée</option></select></label>
        {dashboardPeriod === 'custom' && <><label className="text-xs font-semibold text-[#002141]">Du<input type="date" value={dashboardCustomFrom} onChange={(event) => setDashboardCustomFrom(event.target.value)} className="admin-input mt-1" /></label><label className="text-xs font-semibold text-[#002141]">Au<input type="date" value={dashboardCustomTo} onChange={(event) => setDashboardCustomTo(event.target.value)} className="admin-input mt-1" /></label></>}
        <button type="button" onClick={() => void loadTab('dashboard')} className="admin-primary-button">Appliquer</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Chiffre d’affaires', formatXOF(dashboardTotals.revenueXOF), 'Commandes encaissées sur la période'],
          ['Commandes', String(dashboardTotals.orders || 0), `${Object.values(statuses).reduce((sum: number, count: any) => sum + Number(count || 0), 0)} enregistrée(s)`],
          ['Panier moyen', formatXOF(dashboardTotals.averageCartXOF), 'Sur les commandes encaissées'],
          ['Stock à surveiller', String(dashboardTotals.lowStock || 0), 'Produits au seuil ou épuisés']
        ].map(([label, value, note]) => <article key={label} className="border border-[#002141]/12 bg-white p-5 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3A3A3A]">{label}</p><p className="font-playfair mt-4 text-3xl font-semibold text-[#002141]">{value}</p><p className="mt-3 text-sm text-[#3A3A3A]">{note}</p></article>)}
      </div>
      {Object.keys(statuses).length > 0 && <section className="mt-6 border border-[#002141]/12 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3A3A3A]">Répartition des commandes par statut</p><div className="mt-4 flex flex-wrap gap-3">{Object.entries(statuses).map(([status, count]) => <button type="button" key={status} onClick={() => { setOrderStatusFilter(status); selectTab('orders'); }} className="border border-[#002141]/15 px-3 py-2 text-left text-xs hover:border-[#AC854B]"><strong className="text-[#AC854B]">{Number(count)}</strong> <span className="ml-1 text-[#002141]">{statusLabel[status] || status}</span></button>)}</div></section>}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="border border-[#002141]/12 bg-white p-6"><h2 className="font-playfair text-2xl font-semibold">Évolution de l’activité</h2>{chart.length === 0 ? <p className="mt-8 text-sm text-[#3A3A3A]">Aucune commande sur cette période.</p> : <div className="mt-6 flex h-48 items-end gap-2">{chart.map((point: AnyRecord) => <div key={point.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="hidden rounded bg-[#002141] px-2 py-1 text-[10px] text-white group-hover:block">{formatXOF(point.revenueXOF)} · {point.orders} cmd.</span><div className="w-full bg-[#AC854B]/85 transition hover:bg-[#002141]" style={{ height: `${Math.max(5, Math.round((Number(point.revenueXOF || 0) / maxRevenue) * 100))}%` }} /><span className="text-[9px] text-[#3A3A3A]">{String(point.date).slice(5)}</span></div>)}</div>}</section>
        <section className="border border-[#002141]/12 bg-[#002141] p-6 text-[#FAF9F7]"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D6BB8F]">Contenu à traiter</p><div className="mt-6 space-y-4"><button type="button" onClick={() => selectTab('reviews')} className="block text-left hover:text-[#D6BB8F]"><strong className="font-playfair text-3xl text-[#D6BB8F]">{dashboardTotals.pendingReviews || 0}</strong><span className="ml-3 text-sm">avis en attente</span></button><button type="button" onClick={() => selectTab('users')} className="block text-left hover:text-[#D6BB8F]"><strong className="font-playfair text-3xl text-[#D6BB8F]">{dashboardTotals.newCustomers || 0}</strong><span className="ml-3 text-sm">nouveaux utilisateurs</span></button><button type="button" onClick={() => selectTab('messages')} className="block text-left hover:text-[#D6BB8F]"><strong className="font-playfair text-3xl text-[#D6BB8F]">{dashboardTotals.unreadMessages || 0}</strong><span className="ml-3 text-sm">messages non lus</span></button></div></section>
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-2"><section className="border border-[#002141]/12 bg-white p-6"><h2 className="font-playfair text-2xl font-semibold">Dernières commandes</h2>{(dashboard?.recentOrders || []).length === 0 ? <p className="mt-8 text-sm text-[#3A3A3A]">Aucune commande enregistrée pour le moment.</p> : <div className="mt-5 divide-y divide-[#002141]/10">{dashboard.recentOrders.map((order: AnyRecord) => <button key={order.id} type="button" onClick={() => selectTab('orders')} className="flex w-full justify-between gap-4 py-4 text-left text-sm hover:text-[#AC854B]"><span>{order.order_number || order.id}</span><span>{formatXOF(order.total_xof)}</span><span>{statusLabel[order.status] || order.status}</span></button>)}</div>}</section><section className="border border-[#002141]/12 bg-white p-6"><h2 className="font-playfair text-2xl font-semibold">Stock faible ou épuisé</h2>{(dashboard?.lowStockProducts || []).length === 0 ? <p className="mt-8 text-sm text-[#3A3A3A]">Aucun produit à surveiller.</p> : <div className="mt-5 divide-y divide-[#002141]/10">{dashboard.lowStockProducts.map((product: AnyRecord) => <button key={product.id} type="button" onClick={() => selectTab('products')} className="flex w-full justify-between gap-4 py-4 text-left text-sm hover:text-[#AC854B]"><span>{product.name}</span><span>{product.stock_quantity} · {product.stock_status}</span></button>)}</div>}</section></div>
    </>;
  };

  const renderProducts = () => (
    <>
      <PanelHeader eyebrow="Commerce" title="Produits et stocks" description="Créez les fiches produit complètes, pilotez les prix, les marges, les variantes, les caractéristiques et le stock." action={<button type="button" onClick={() => { setEditingProduct({}); setProductForm(emptyProduct()); }} className="admin-primary-button"><PackagePlus className="h-4 w-4" /> Nouveau produit</button>} />
      {editingProduct !== null && <form onSubmit={saveProduct} className="mb-8 border border-[#002141]/15 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6 flex justify-between gap-4"><div><h2 className="font-playfair text-2xl font-semibold">{editingProduct.id ? 'Modifier le produit' : 'Créer un produit'}</h2><p className="mt-1 text-sm text-[#3A3A3A]">Les données structurées permettent de générer une fiche produit exhaustive.</p></div><button type="button" onClick={() => setEditingProduct(null)} className="admin-icon-button" aria-label="Fermer"><X className="h-4 w-4" /></button></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['name', 'Nom du produit', true], ['brand', 'Marque'], ['sku', 'SKU'], ['reference', 'Référence'], ['slug', 'Lien produit'], ['purchase_price_xof', 'Prix d’achat FCFA'], ['regular_price_xof', 'Prix normal FCFA'], ['sale_price_xof', 'Prix actuel / réduit FCFA'], ['stock_quantity', 'Stock disponible'], ['low_stock_threshold', 'Seuil d’alerte'], ['seo_title', 'Titre SEO']
        ].map(([name, label, required]) => <label key={name} className="text-sm font-semibold text-[#002141]">{label}<input required={Boolean(required)} type={String(name).includes('price') || String(name).includes('stock') ? 'number' : 'text'} value={String(productForm[String(name)] ?? '')} onChange={(event) => setProductForm((current) => ({ ...current, [String(name)]: event.target.value }))} className="admin-input mt-2" /></label>)}
        <label className="text-sm font-semibold text-[#002141]">Catégorie<select value={productForm.category || 'montres'} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} className="admin-input mt-2"><option value="montres">Montres</option><option value="parfums">Parfums — masqués tant qu’aucun produit publié</option><option value="lunettes">Lunettes — masquées tant qu’aucun produit publié</option></select></label>
        <label className="text-sm font-semibold text-[#002141]">Statut<select value={productForm.status} onChange={(event) => setProductForm((current) => ({ ...current, status: event.target.value }))} className="admin-input mt-2"><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option></select></label>
        <label className="text-sm font-semibold text-[#002141]">Politique de stock<select value={productForm.stock_policy || 'standard'} onChange={(event) => setProductForm((current) => ({ ...current, stock_policy: event.target.value }))} className="admin-input mt-2"><option value="standard">Stock géré</option><option value="on_order">Sur commande</option></select></label>
        <label className="text-sm font-semibold text-[#002141]">Image principale<select value={productForm.primary_media_id || ''} onChange={(event) => setProductForm((current) => ({ ...current, primary_media_id: event.target.value }))} className="admin-input mt-2"><option value="">Choisir dans la galerie</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.file_name}</option>)}</select></label>
        <fieldset className="md:col-span-2 xl:col-span-3 border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">Galerie produit — cochez les images, puis choisissez l’image principale</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{media.map((asset) => <label key={asset.id} className="flex items-center gap-2 border border-[#002141]/10 p-2 text-xs text-[#002141]"><input type="checkbox" checked={(productForm.media_ids || []).includes(asset.id)} onChange={(event) => setProductForm((current) => { const ids = Array.isArray(current.media_ids) ? current.media_ids : []; return { ...current, media_ids: event.target.checked ? [...ids, asset.id] : ids.filter((id: string) => id !== asset.id) }; })} className="h-4 w-4 accent-[#AC854B]" /><img src={asset.public_url} alt={asset.alt_text || asset.file_name} className="h-10 w-10 object-cover" /><span className="truncate">{asset.file_name}</span></label>)}</div></fieldset>
        <label className="md:col-span-2 xl:col-span-3 text-sm font-semibold text-[#002141]">Description courte<textarea value={productForm.short_description || ''} onChange={(event) => setProductForm((current) => ({ ...current, short_description: event.target.value }))} className="admin-input mt-2 min-h-24" /></label>
        <div className="md:col-span-2 xl:col-span-3"><RichTextEditor id="product-description" label="Description détaillée" value={productForm.description_html || ''} onChange={(value) => setProductForm((current) => ({ ...current, description_html: value }))} hint="Utilisez les titres, listes et liens pour une fiche de vente structurée." /></div>
        {[['value_story_title', 'Titre de l’histoire produit'], ['value_story_text', 'Texte de l’histoire produit'], ['provenance_summary', 'Provenance — à renseigner uniquement si validée'], ['warranty_summary', 'Garantie / service — à renseigner uniquement si validée'], ['delivery_summary', 'Livraison — à renseigner uniquement si validée']].map(([name, label]) => <label key={name} className="md:col-span-2 xl:col-span-3 text-sm font-semibold text-[#002141]">{label}<textarea value={productForm[name] || ''} onChange={(event) => setProductForm((current) => ({ ...current, [name]: event.target.value }))} className="admin-input mt-2 min-h-20" /></label>)}
        <ProductStructuredFields form={productForm} onChange={(field, value) => setProductForm((current) => ({ ...current, [field]: value }))} />
        <label className="md:col-span-2 xl:col-span-3 text-sm font-semibold text-[#002141]">Description SEO<textarea value={productForm.seo_description || ''} onChange={(event) => setProductForm((current) => ({ ...current, seo_description: event.target.value }))} className="admin-input mt-2 min-h-20" /></label>
      </div><div className="mt-7 flex flex-wrap gap-3"><button type="submit" className="admin-primary-button">Enregistrer le produit</button><button type="button" onClick={() => setEditingProduct(null)} className="admin-secondary-button">Annuler</button></div></form>}
      {products.length > 0 && <div className="mb-5 flex flex-wrap items-end gap-3 border border-[#002141]/12 bg-white p-4"><label className="text-xs font-semibold">Rechercher<input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nom, référence, marque…" className="admin-input mt-1 min-w-56" /></label><label className="text-xs font-semibold">Statut<select value={productStatusFilter} onChange={(event) => setProductStatusFilter(event.target.value)} className="admin-input mt-1"><option value="">Tous</option><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option></select></label><label className="text-xs font-semibold">Catégorie<select value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)} className="admin-input mt-1"><option value="">Toutes</option><option value="montres">Montres</option><option value="parfums">Parfums</option><option value="lunettes">Lunettes</option></select></label><button type="button" onClick={() => void downloadAdminCsv('/products/export.csv', 'heritage-produits.csv').catch((error) => notify(error.message))} className="admin-secondary-button">Exporter CSV</button>{selectedProductIds.length > 0 && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void runBulkProductAction('publish')} className="admin-secondary-button">Publier ({selectedProductIds.length})</button><button type="button" onClick={() => void runBulkProductAction('unpublish')} className="admin-secondary-button">Dépublier</button><button type="button" onClick={() => void runBulkProductAction('archive')} className="admin-secondary-button">Archiver</button><button type="button" onClick={() => void runBulkProductAction('delete')} className="admin-secondary-button text-red-800">Supprimer</button></div>}</div>}
      {products.length === 0 ? <EmptyState title="Le catalogue Supabase est vide" body="Les produits historiques doivent être repris dans Supabase avant de pouvoir être gérés ici." /> : <div className="overflow-x-auto border border-[#002141]/15 bg-white"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-[#002141] text-[#FAF9F7]"><tr><th className="p-4"><input type="checkbox" checked={visibleProducts.length > 0 && visibleProducts.every((product) => selectedProductIds.includes(product.id))} onChange={(event) => setSelectedProductIds(event.target.checked ? visibleProducts.map((product) => product.id) : [])} aria-label="Sélectionner les produits affichés" className="accent-[#AC854B]" /></th><th className="p-4">Produit</th><th className="p-4">Prix actuel</th><th className="p-4">Marge brute</th><th className="p-4">Stock</th><th className="p-4">État</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>{visibleProducts.map((product) => { const currentPrice = Number(product.sale_price_xof ?? product.regular_price_xof ?? 0); const margin = currentPrice - Number(product.purchase_price_xof || 0); const marginRate = currentPrice > 0 ? Math.round((margin / currentPrice) * 100) : 0; return <tr key={product.id} className="border-t border-[#002141]/10"><td className="p-4"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))} aria-label={`Sélectionner ${product.name}`} className="accent-[#AC854B]" /></td><td className="p-4"><p className="font-semibold text-[#002141]">{product.name}</p><p className="mt-1 text-xs text-[#3A3A3A]">{product.reference || product.sku || 'Sans référence'}</p></td><td className="p-4">{formatXOF(currentPrice)}</td><td className="p-4 text-emerald-800">{formatXOF(margin)} <span className="text-xs">({marginRate} %)</span></td><td className="p-4"><span className={Number(product.stock_quantity) <= Number(product.low_stock_threshold) ? 'font-bold text-red-800' : ''}>{product.stock_quantity}</span></td><td className="p-4"><span className="admin-pill">{product.status}</span></td><td className="p-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingProduct(product); setProductForm(toProductForm(product)); }} className="admin-icon-button" aria-label="Modifier"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void deleteProduct(product)} className="admin-icon-button text-red-800" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button></div></td></tr>})}</tbody></table>{visibleProducts.length === 0 && <p className="p-6 text-sm text-[#3A3A3A]">Aucun produit ne correspond aux filtres.</p>}</div>}
      {lowStockProducts.length > 0 && <p className="mt-4 text-sm text-red-800">{lowStockProducts.length} produit(s) ont atteint leur seuil de stock.</p>}
    </>
  );

  const renderOrders = () => <>
    <PanelHeader eyebrow="Commerce" title="Commandes" description="Recherchez, imprimez ou exportez les commandes. Chaque changement est journalisé ; une preuve est requise avant “Livrée”." action={<button type="button" onClick={() => void downloadAdminCsv('/orders/export.csv', 'heritage-commandes.csv').catch((error) => notify(error.message))} className="admin-secondary-button">Exporter CSV</button>} />
    {orders.length === 0 ? <EmptyState title="Aucune commande" body="Les nouvelles commandes synchronisées depuis le site apparaîtront ici." /> : <><div className="mb-5 flex flex-wrap gap-3 border border-[#002141]/12 bg-white p-4"><label className="text-xs font-semibold">Rechercher<input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="N° commande, client, référence…" className="admin-input mt-1 min-w-64" /></label><label className="text-xs font-semibold">Statut<select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)} className="admin-input mt-1"><option value="">Tous</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="space-y-4">{visibleOrders.map((order) => <article key={order.id} className="border border-[#002141]/15 bg-white p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-semibold text-[#002141]">{order.order_number || order.id}</p><p className="mt-1 text-sm text-[#3A3A3A]">{order.customer_name} · {order.customer_email} · {formatXOF(order.total_xof)}</p><p className="mt-1 text-xs text-[#3A3A3A]">Transmission : {order.payment_method || 'Directe / WhatsApp'} {order.payment_reference ? `· ${order.payment_reference}` : ''}</p></div><div className="flex items-end gap-2"><label className="text-sm font-semibold text-[#002141]">État<select value={order.status} onChange={(event) => void updateOrder(order, event.target.value)} className="admin-input mt-2 min-w-52">{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={() => window.print()} className="admin-secondary-button">Imprimer</button></div></div>{Array.isArray(order.order_items) && <div className="mt-4 border-t border-[#002141]/10 pt-4 text-sm text-[#3A3A3A]"><p className="font-semibold text-[#002141]">Articles</p><p className="mt-1">{order.order_items.map((item: AnyRecord) => `${item.quantity} × ${item.product_name || item.name}`).join(' · ')}</p></div>}<div className="mt-4 grid gap-3 border-t border-[#002141]/10 pt-4 text-xs text-[#3A3A3A] sm:grid-cols-2"><p>Livraison : {order.delivery_reference || order.delivery_proof_url || 'Aucune preuve / référence renseignée'}</p><p>Adresse : {order.shipping_address || order.delivery_address || 'Non renseignée'}</p></div>{Array.isArray(order.status_history) && order.status_history.length > 0 && <details className="mt-4 border-t border-[#002141]/10 pt-4"><summary className="cursor-pointer text-sm font-semibold text-[#002141]">Historique des statuts</summary><ul className="mt-3 space-y-2 text-xs text-[#3A3A3A]">{order.status_history.slice().reverse().map((entry: AnyRecord, index: number) => <li key={`${entry.timestamp}-${index}`}>{new Date(entry.timestamp).toLocaleString('fr-FR')} · {statusLabel[entry.status] || entry.status}{entry.note ? ` — ${entry.note}` : ''}</li>)}</ul></details>}</article>)}</div>{visibleOrders.length === 0 && <EmptyState title="Aucune commande trouvée" body="Modifiez la recherche ou le filtre." />}</>}
  </>;

  const renderAdministrators = () => <><PanelHeader eyebrow="Accès sécurisé" title="Administrateurs" description="Gérez les comptes actifs et créez des codes à usage unique, valides pendant une heure." action={<button type="button" onClick={() => void generateInvitation()} className="admin-primary-button"><KeyRound className="h-4 w-4" /> Générer un code</button>} />{generatedCode && <div className="mb-6 border border-[#AC854B] bg-[#fffaf0] p-5"><p className="text-sm font-semibold text-[#002141]">Code d’invitation à transmettre une seule fois</p><code className="mt-3 block select-all break-all bg-[#002141] p-4 text-lg font-bold tracking-[0.12em] text-[#D6BB8F]">{generatedCode}</code><p className="mt-3 text-xs text-[#3A3A3A]">Il expirera dans une heure. Conservez-le hors des canaux publics.</p></div>}<div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><section className="border border-[#002141]/15 bg-white"><h2 className="border-b border-[#002141]/10 p-5 font-playfair text-2xl font-semibold">Comptes administrateur</h2>{administrators.map((account) => <article key={account.id} className="flex items-center justify-between gap-4 border-b border-[#002141]/10 p-5"><div><p className="font-semibold">{account.full_name || 'Administrateur'} · {account.is_active ? 'Actif' : 'Révoqué'}</p><p className="text-sm text-[#3A3A3A]">{account.email}</p><p className="mt-1 text-xs text-[#3A3A3A]">Créé le {account.created_at ? new Date(account.created_at).toLocaleDateString('fr-FR') : '—'} · Dernière connexion : {account.last_signed_in_at ? new Date(account.last_signed_in_at).toLocaleString('fr-FR') : 'Jamais'}</p></div><button type="button" onClick={async () => { try { await adminRequest(`/administrators/${account.id}`, { method: 'PATCH', body: { is_active: !account.is_active } }); await loadTab('administrators'); notify(account.is_active ? 'Compte désactivé.' : 'Compte réactivé.'); } catch (error) { notify(error instanceof Error ? error.message : 'Action impossible.'); } }} className={account.is_active ? 'admin-secondary-button' : 'admin-primary-button'}>{account.is_active ? 'Désactiver' : 'Réactiver'}</button></article>)}</section><section className="border border-[#002141]/15 bg-white"><h2 className="border-b border-[#002141]/10 p-5 font-playfair text-2xl font-semibold">Codes récents</h2>{invitations.length === 0 ? <p className="p-5 text-sm text-[#3A3A3A]">Aucun code créé.</p> : invitations.map((invitation) => <article key={invitation.id} className="flex items-center justify-between gap-3 border-b border-[#002141]/10 p-5"><div><p className="text-sm font-semibold">{invitation.used_at ? 'Utilisé' : invitation.revoked_at ? 'Révoqué' : new Date(invitation.expires_at) > new Date() ? 'Valide' : 'Expiré'}</p><p className="mt-1 text-xs text-[#3A3A3A]">Expire le {new Date(invitation.expires_at).toLocaleString('fr-FR')}</p></div>{!invitation.used_at && !invitation.revoked_at && new Date(invitation.expires_at) > new Date() && <button type="button" onClick={async () => { await adminRequest(`/invitations/${invitation.id}/revoke`, { method: 'PATCH' }); await loadTab('administrators'); notify('Code révoqué.'); }} className="admin-icon-button text-red-800" aria-label="Révoquer"><Trash2 className="h-4 w-4" /></button>}</article>)}</section></div>{auditLogs.length > 0 && <section className="mt-6 border border-[#002141]/15 bg-white"><h2 className="border-b border-[#002141]/10 p-5 font-playfair text-2xl font-semibold">Journal d’activité récent</h2><div className="divide-y divide-[#002141]/10">{auditLogs.map((entry) => <p key={entry.id} className="p-4 text-sm text-[#3A3A3A]">{entry.created_at ? new Date(entry.created_at).toLocaleString('fr-FR') : '—'} · {entry.action} · {entry.entity_type}</p>)}</div></section>}</>;

  const renderUsers = () => <>
    <PanelHeader eyebrow="Comptes clients" title="Utilisateurs" description="Consultez uniquement les coordonnées et l’historique commercial nécessaires à la relation client ; aucune donnée bancaire n’est exposée." action={<button type="button" onClick={() => void downloadAdminCsv('/users/export.csv', 'heritage-utilisateurs.csv').catch((error) => notify(error.message))} className="admin-secondary-button">Exporter CSV</button>} />
    {users.length === 0 ? <EmptyState title="Aucun utilisateur enregistré" body="Les comptes visiteurs apparaîtront ici après leur inscription." /> : <><label className="mb-5 block max-w-sm text-xs font-semibold">Rechercher<input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Nom, e-mail ou téléphone…" className="admin-input mt-1" /></label><div className="divide-y divide-[#002141]/10 border border-[#002141]/15 bg-white">{visibleUsers.map((user) => <article key={user.id} className="flex flex-col gap-4 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#002141]">{user.full_name || 'Client HERITAGE'}</p><p className="mt-1 text-sm text-[#3A3A3A]">{user.email} {user.phone ? `· ${user.phone}` : ''}</p><p className="mt-1 text-xs text-[#3A3A3A]">Inscrit le {user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '—'} · {user.order_count || 0} commande(s) · {formatXOF(user.total_spent_xof)}</p></div><button type="button" onClick={async () => { try { await adminRequest(`/users/${user.id}`, { method: 'PATCH', body: { is_active: !user.is_active } }); await loadTab('users'); notify(user.is_active ? 'Compte client désactivé.' : 'Compte client réactivé.'); } catch (error) { notify(error instanceof Error ? error.message : 'Action impossible.'); } }} className={user.is_active ? 'admin-secondary-button' : 'admin-primary-button'}>{user.is_active ? 'Désactiver' : 'Réactiver'}</button></div><details className="border-t border-[#002141]/10 pt-3"><summary className="cursor-pointer text-sm font-semibold text-[#002141]">Coordonnées et commandes</summary><div className="mt-3 grid gap-3 text-xs text-[#3A3A3A] sm:grid-cols-2"><p>Adresse : {user.delivery_address || user.commune || 'Non renseignée'}</p><p>Statut du compte : {user.is_active ? 'Actif' : 'Désactivé'}</p>{(user.orders || []).map((order: AnyRecord) => <button type="button" key={order.id} onClick={() => selectTab('orders')} className="text-left hover:text-[#AC854B]">{order.order_number || order.id} · {formatXOF(order.total_xof)} · {statusLabel[order.status] || order.status}</button>)}</div></details></article>)}</div>{visibleUsers.length === 0 && <EmptyState title="Aucun utilisateur trouvé" body="Modifiez votre recherche." />}</>}
  </>;

  const renderMedia = () => <><PanelHeader eyebrow="Fichiers de la boutique" title="Galerie média" description="Ajoutez plusieurs images, renseignez leur texte alternatif, puis organisez-les par dossier ou tag. Les images générées par IA sont refusées." action={<label className="admin-primary-button cursor-pointer"><Plus className="h-4 w-4" /> Ajouter des images<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={uploadMedia} /></label>} />{media.length === 0 ? <EmptyState title="La galerie est vide" body="Ajoutez la première image produit depuis votre appareil." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{media.map((asset) => <article key={asset.id} className="overflow-hidden border border-[#002141]/15 bg-white"><img src={asset.public_url} alt={asset.alt_text || asset.file_name} className="h-44 w-full object-cover" /><div className="space-y-3 p-4"><div><p className="truncate text-sm font-semibold text-[#002141]">{asset.file_name}</p><p className="mt-1 truncate text-xs text-[#3A3A3A]">{asset.folder || 'general'} · {asset.alt_text}</p>{asset.usage?.length > 0 && <p className="mt-1 text-[11px] text-[#AC854B]">Utilisée : {asset.usage.map((usage: AnyRecord) => `${usage.type} ${usage.label}`).join(', ')}</p>}</div><div className="flex justify-end gap-2"><button type="button" onClick={async () => { const alt_text = window.prompt('Texte alternatif :', asset.alt_text || ''); if (!alt_text?.trim()) return; const folder = window.prompt('Dossier :', asset.folder || 'general') || 'general'; const tags = window.prompt('Tags séparés par des virgules :', Array.isArray(asset.tags) ? asset.tags.join(', ') : ''); try { await adminRequest(`/media/${asset.id}`, { method: 'PATCH', body: { alt_text: alt_text.trim(), folder, tags: JSON.stringify((tags || '').split(',').map((tag) => tag.trim()).filter(Boolean)), product_id: asset.product_id || null, sort_order: asset.sort_order || 0 } }); await loadTab('media'); notify('Média mis à jour.'); } catch (error) { notify(error instanceof Error ? error.message : 'Mise à jour impossible.'); } }} className="admin-icon-button" aria-label="Modifier le média"><Pencil className="h-4 w-4" /></button><button type="button" onClick={async () => { if (!window.confirm(asset.usage?.length ? 'Cette image est utilisée. La suppression sera refusée tant qu’elle est liée à un contenu. Continuer ?' : 'Supprimer cette image définitivement ?')) return; try { await adminRequest(`/media/${asset.id}`, { method: 'DELETE' }); await loadTab('media'); notify('Image supprimée.'); } catch (error) { notify(error instanceof Error ? error.message : 'Suppression impossible.'); } }} className="admin-icon-button text-red-800" aria-label="Supprimer l’image"><Trash2 className="h-4 w-4" /></button></div></div></article>)}</div>}</>;

  const renderCoordinates = () => {
    const settings = siteSettings || { business_name: 'HERITAGE', social_links: {}, footer_notices: [] };
    const socials = typeof settings.social_links === 'string' ? (() => { try { return JSON.parse(settings.social_links); } catch { return {}; } })() : (settings.social_links || {});
    const notices = typeof settings.footer_notices === 'string' ? (() => { try { return JSON.parse(settings.footer_notices); } catch { return []; } })() : (settings.footer_notices || []);
    const setSocial = (network: string, value: string) => setSiteSettings((current) => ({ ...(current || {}), social_links: { ...(typeof current?.social_links === 'object' ? current.social_links : {}), [network]: value } }));
    return <>
      <PanelHeader eyebrow="Informations de la maison" title="Coordonnées" description="Une seule source Supabase pour le footer, Contact, WhatsApp et les réseaux sociaux." />
      <form onSubmit={async (event) => {
        event.preventDefault();
        try {
          await adminRequest('/site-settings', { method: 'PATCH', body: { ...settings, social_links: JSON.stringify(socials), footer_notices: JSON.stringify(notices) } });
          await loadTab('coordinates');
          notify('Coordonnées enregistrées.');
        } catch (error) { notify(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
      }} className="max-w-4xl border border-[#002141]/15 bg-white p-5 sm:p-7">
        <div className="grid gap-5 md:grid-cols-2">
          {[['business_name','Nom de la boutique'],['email','E-mail'],['phone','Téléphone'],['whatsapp_phone','Numéro WhatsApp'],['address','Adresse'],['hours','Horaires']].map(([name,label]) => <label key={name} className="text-sm font-semibold text-[#002141]">{label}<input type={name === 'email' ? 'email' : name.includes('phone') ? 'tel' : 'text'} value={settings[name] || ''} onChange={(event) => setSiteSettings((current) => ({ ...(current || {}), [name]: event.target.value }))} className="admin-input mt-2" /></label>)}
          <fieldset className="md:col-span-2 border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">Réseaux sociaux</legend><div className="mt-2 grid gap-4 sm:grid-cols-2">{[['facebook','Facebook'],['instagram','Instagram'],['tiktok','TikTok'],['x','X'],['youtube','YouTube']].map(([network,label]) => <label key={network} className="text-sm font-semibold text-[#002141]">{label}<input type="url" value={socials[network] || ''} onChange={(event) => setSocial(network, event.target.value)} placeholder="https://…" className="admin-input mt-2" /></label>)}</div></fieldset>
          <fieldset className="md:col-span-2 border border-[#002141]/15 p-4"><legend className="px-1 text-sm font-semibold text-[#002141]">Informations mises en avant dans le footer</legend><p className="mb-3 text-xs leading-relaxed text-[#3A3A3A]">Laissez vide tant que l’information (authenticité, livraison ou garantie) n’est pas validée par la Maison.</p>{[0, 1, 2].map((index) => <div key={index} className="mb-3 grid gap-3 sm:grid-cols-[1fr_2fr]"><input value={notices[index]?.title || ''} onChange={(event) => setSiteSettings((current) => { const next = Array.isArray(current?.footer_notices) ? [...current.footer_notices] : []; next[index] = { ...(next[index] || {}), title: event.target.value, body: next[index]?.body || '' }; return { ...(current || {}), footer_notices: next }; })} placeholder={`Titre ${index + 1}`} className="admin-input" /><input value={notices[index]?.body || ''} onChange={(event) => setSiteSettings((current) => { const next = Array.isArray(current?.footer_notices) ? [...current.footer_notices] : []; next[index] = { ...(next[index] || {}), title: next[index]?.title || '', body: event.target.value }; return { ...(current || {}), footer_notices: next }; })} placeholder="Texte validé" className="admin-input" /></div>)}</fieldset>
          <label className="md:col-span-2 flex min-h-12 items-center gap-3 border border-[#002141]/15 px-4 text-sm font-semibold text-[#002141]"><input type="checkbox" checked={Boolean(settings.structured_data_enabled)} onChange={(event) => setSiteSettings((current) => ({ ...(current || {}), structured_data_enabled: event.target.checked }))} className="h-4 w-4 accent-[#AC854B]" /> Activer les données structurées de la Maison une fois les coordonnées validées</label>
        </div>
        <button type="submit" className="admin-primary-button mt-7">Enregistrer les coordonnées</button>
      </form>
    </>;
  };

  const renderMessages = () => <>
    <PanelHeader eyebrow="Relation client" title="Messages reçus" description="Consultez les messages envoyés depuis le formulaire de contact du site." />
    {contactMessages.length === 0 ? <EmptyState title="Aucun message" body="Les messages envoyés par les visiteurs de la boutique apparaîtront ici." /> : <div className="space-y-4">{contactMessages.map((msg) => <article key={msg.id} className="border border-[#002141]/15 bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold text-[#002141]">{msg.full_name || 'Anonyme'} <span className="text-xs font-normal text-[#3A3A3A]">({msg.email}{msg.phone ? ` · ${msg.phone}` : ''})</span></p><p className="mt-1 text-xs text-[#3A3A3A]">{msg.created_at ? new Date(msg.created_at).toLocaleString('fr-FR') : '—'} · Statut : <span className="admin-pill">{msg.status === 'unread' ? 'Non lu' : msg.status === 'read' ? 'Lu' : 'Archivé'}</span></p></div><div className="flex gap-2"><button type="button" onClick={async () => { try { await adminRequest(`/contact-messages/${msg.id}`, { method: 'PATCH', body: { status: msg.status === 'unread' ? 'read' : 'unread' } }); await loadTab('messages'); notify('Statut mis à jour.'); } catch (error) { notify(error instanceof Error ? error.message : 'Action impossible.'); } }} className="admin-secondary-button">{msg.status === 'unread' ? 'Marquer comme lu' : 'Marquer non lu'}</button><button type="button" onClick={async () => { try { await adminRequest(`/contact-messages/${msg.id}`, { method: 'PATCH', body: { status: 'archived' } }); await loadTab('messages'); notify('Message archivé.'); } catch (error) { notify(error instanceof Error ? error.message : 'Action impossible.'); } }} className="admin-icon-button text-red-800" aria-label="Archiver"><Trash2 className="h-4 w-4" /></button></div></div>{msg.subject && <p className="mt-3 text-sm font-semibold text-[#002141]">Sujet : {msg.subject}</p>}<div className="mt-3 border-t border-[#002141]/10 pt-3 text-sm leading-relaxed text-[#3A3A3A] whitespace-pre-wrap">{msg.message}</div></article>)}</div>}
  </>;

  let content: React.ReactNode = renderDashboard();
  if (activeTab === 'products') content = renderProducts();
  if (activeTab === 'orders') content = renderOrders();
  if (activeTab === 'administrators') content = renderAdministrators();
  if (activeTab === 'users') content = renderUsers();
  if (activeTab === 'media') content = renderMedia();
  if (activeTab === 'messages') content = renderMessages();
  if (activeTab === 'coordinates') content = renderCoordinates();
  if (['reviews', 'blogs', 'faqs', 'legal', 'meta', 'pixels'].includes(activeTab)) {
    const config = RESOURCE_CONFIGS[activeTab as keyof typeof RESOURCE_CONFIGS];
    content = <ResourceManager config={config} items={resources[activeTab] || []} onRefresh={() => loadTab(activeTab)} onNotify={notify} />;
  }

  return (
    <div className="admin-portal min-h-screen bg-[#F5F3EF] text-[#002141]">
      {sidebarOpen && <button type="button" className="fixed inset-0 z-40 bg-[#002141]/60 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#002141] text-[#FAF9F7] shadow-2xl transition-[width,transform] duration-200 ease-out lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`flex items-center justify-between border-b border-[#FAF9F7]/10 p-4 transition-all duration-200 ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}>
          <button type="button" onClick={() => selectTab('dashboard')} className="flex min-w-0 items-center gap-3 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D6BB8F] group" aria-label="Tableau de bord administrateur">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
              <img src="/assets/favicon.svg" alt="Monogramme HERITAGE" className="h-full w-full object-contain" />
            </div>
            <div className={`flex flex-col overflow-hidden whitespace-nowrap transition-all duration-200 ease-out text-left ${sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'lg:w-[130px] lg:opacity-100'}`}>
              <span className="text-[15px] font-bold tracking-widest text-[#FAF9F7] group-hover:text-[#D6BB8F] transition-colors">
                HERITAGE
              </span>
              <span className="mt-0.5 text-[6.5px] font-bold uppercase tracking-[0.2em] text-[#D6BB8F]">
                Portail Admin
              </span>
            </div>
          </button>
          <button type="button" onClick={toggleSidebar} className="admin-sidebar-icon hidden lg:inline-flex" aria-label={sidebarCollapsed ? 'Déplier le menu' : 'Plier le menu'} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? 'Déplier le menu' : 'Plier le menu'}><PanelLeftOpen className={`h-5 w-5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} /></button>
          <button type="button" onClick={() => setSidebarOpen(false)} className="admin-sidebar-icon lg:hidden" aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Navigation administration">
          {NAVIGATION.map((item, index) => {
            const Icon = item.icon;
            const previous = NAVIGATION[index - 1];
            return (
              <React.Fragment key={item.id}>
                {item.section && (
                  <div className={`overflow-hidden transition-all duration-200 ease-out ${sidebarCollapsed ? 'lg:h-0 lg:opacity-0' : 'lg:h-auto lg:opacity-100'}`}>
                    <p className={`px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#D6BB8F]/80 whitespace-nowrap ${previous ? 'pt-5' : 'pt-2'}`}>
                      {item.section}
                    </p>
                  </div>
                )}
                <button type="button" onClick={() => selectTab(item.id)} title={sidebarCollapsed ? item.label : undefined} className={`flex min-h-10 w-full items-center gap-3 px-3 text-left text-[13px] font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D6BB8F] rounded-md ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} ${activeTab === item.id ? 'bg-[#AC854B] text-[#002141] shadow-sm' : 'text-[#FAF9F7]/82 hover:bg-[#FAF9F7]/10 hover:text-[#FAF9F7]'}`}>
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'lg:w-[160px] lg:opacity-100'}`}>
                    {item.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className={`border-t border-[#FAF9F7]/10 p-3 flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'lg:px-2 lg:items-center' : ''}`}>
          <div className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${sidebarCollapsed ? 'lg:w-0 lg:h-0 lg:opacity-0' : 'lg:w-[200px] lg:h-auto lg:opacity-100'}`}>
            <p className="truncate text-[13px] font-semibold">{admin.full_name || 'Administrateur'}</p>
            <p className="mt-1 truncate text-xs text-[#FAF9F7]/60">{admin.email}</p>
          </div>
          <button type="button" onClick={() => void logout()} title={sidebarCollapsed ? 'Déconnexion' : undefined} className={`flex min-h-10 w-full items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[#D6BB8F] transition-colors hover:text-[#FAF9F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D6BB8F] rounded-md ${sidebarCollapsed ? 'lg:justify-center lg:mt-0 lg:px-0' : 'mt-3 px-3 hover:bg-[#FAF9F7]/10'}`}>
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${sidebarCollapsed ? 'lg:w-0 lg:opacity-0' : 'lg:w-[160px] lg:opacity-100'}`}>
              Déconnexion
            </span>
          </button>
        </div>
      </aside>
      <div className={`transition-[padding] duration-200 ease-out ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}><header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-[#002141]/10 bg-[#F5F3EF]/95 px-4 py-2 backdrop-blur sm:px-6"><div className="flex items-center gap-3"><button type="button" onClick={() => setSidebarOpen(true)} className="admin-icon-button lg:hidden" aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button><button type="button" onClick={toggleSidebar} className="admin-icon-button hidden lg:inline-flex" aria-label={sidebarCollapsed ? 'Déplier le menu' : 'Plier le menu'} title={sidebarCollapsed ? 'Déplier le menu' : 'Plier le menu'}><PanelLeftOpen className={`h-5 w-5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} /></button><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#AC854B]">Portail privé</p><p className="text-[13px] font-semibold text-[#002141]">{NAVIGATION.find((item) => item.id === activeTab)?.label}</p></div></div><button type="button" onClick={() => navigate('/')} className="admin-secondary-button hidden sm:inline-flex"><PanelLeftClose className="h-4 w-4" /> Voir la boutique</button></header>
        <main className="px-4 py-5 sm:px-6 lg:px-8">{loading ? <div className="flex min-h-80 items-center justify-center text-sm text-[#3A3A3A]"><LoaderCircle className="mr-3 h-5 w-5 animate-spin text-[#AC854B]" /> Chargement des données sécurisées…</div> : loadError ? <DataUnavailable message={loadError} /> : content}</main>
      </div>
      {notice && <div role="status" className="fixed bottom-5 right-5 z-[60] max-w-sm border border-[#D6BB8F] bg-[#002141] px-4 py-3 text-sm text-[#FAF9F7] shadow-xl"><CheckCircle2 className="mr-2 inline h-4 w-4 text-[#D6BB8F]" />{notice}</div>}
    </div>
  );
};

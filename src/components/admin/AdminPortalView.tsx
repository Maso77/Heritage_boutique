import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  GalleryVerticalEnd,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  Layers,
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
  Sparkles,
  Star,
  Trash2,
  Upload,
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

const slugify = (text: string) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const emptyProduct = (): AnyRecord => ({
  name: '',
  slug: '',
  sku: '',
  reference: '',
  brand: '',
  category: 'montres',
  custom_category: '',
  short_description: '',
  description_html: '',
  purchase_price_xof: '',
  regular_price_xof: '',
  sale_price_xof: '',
  stock_quantity: 0,
  low_stock_threshold: 2,
  stock_policy: 'standard',
  status: 'draft',
  primary_media_id: '',
  colors: '[]',
  attributes: '{}',
  faq: '[]',
  variants: '[]',
  media_ids: [],
  value_story_title: '',
  value_story_text: '',
  provenance_summary: '',
  warranty_summary: '',
  delivery_summary: '',
  seo_title: '',
  seo_description: '',
  slug_manually_edited: false
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

const toProductForm = (product: AnyRecord): AnyRecord => {
  const cat = String(product.category || 'montres');
  const isStandardCat = ['montres', 'parfums', 'lunettes'].includes(cat);
  return {
    ...emptyProduct(),
    ...product,
    category: isStandardCat ? cat : 'autre',
    custom_category: isStandardCat ? '' : cat,
    colors: toJsonText(product.colors),
    attributes: toJsonText(product.attributes, '{}'),
    faq: toJsonText(product.faq),
    variants: toJsonText(product.product_variants || product.variants),
    media_ids: Array.isArray(product.media_assets)
      ? product.media_assets.map((asset: AnyRecord) => asset.id)
      : Array.isArray(product.media_ids)
      ? product.media_ids
      : [],
    slug_manually_edited: Boolean(product.slug)
  };
};

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

  const loadHorlogerieTemplate = () => {
    const template: Array<[string, string]> = [
      ['diamètre', '40 mm'],
      ['boîtier', 'Acier inoxydable 316L'],
      ['verre', 'Saphir inrayable avec traitement anti-reflet'],
      ['mouvement', 'Automatique Powermatic 80'],
      ['réserve de marche', '80 heures'],
      ['bracelet', 'Acier avec fermoir papillon à poussoirs'],
      ['étanchéité', '10 bar (100 m / 330 ft)'],
      ['fond de boîte', 'Transparent en verre saphir']
    ];
    saveAttributes(template);
  };

  const loadParfumsTemplate = () => {
    const template: Array<[string, string]> = [
      ['notes de tête', 'Bergamote, Poivre noir'],
      ['notes de cœur', 'Iris, Jasmin d’Égypte'],
      ['notes de fond', 'Bois de santal, Ambre, Vanille'],
      ['contenance', '100 ml / 3.4 fl. oz.'],
      ['famille olfactive', 'Boisé Épicé Premium']
    ];
    saveAttributes(template);
  };

  const loadLunettesTemplate = () => {
    const template: Array<[string, string]> = [
      ['monture', 'Acétate de cellulose fait main'],
      ['couleur monture', 'Écaille de tortue / Noir profond'],
      ['type de verre', 'Verres minéraux polarisés'],
      ['protection uv', '100 % UV400 Catégorie 3'],
      ['calibre / pont', '50 mm / 21 mm']
    ];
    saveAttributes(template);
  };

  return (
    <div className="md:col-span-2 xl:col-span-3 space-y-6">
      {/* Couleurs */}
      <fieldset className="border border-[#002141]/15 p-4 bg-white">
        <legend className="px-1 text-sm font-semibold text-[#002141]">Variantes de couleurs / finitions</legend>
        <p className="mt-1 text-xs text-[#3A3A3A]">Saisissez les couleurs séparées par des virgules (ex. Acier, Or rose, Cuir noir).</p>
        <input
          value={colors.join(', ')}
          onChange={(event) => onChange('colors', JSON.stringify(event.target.value.split(',').map((value) => value.trim()).filter(Boolean)))}
          className="admin-input mt-2"
          placeholder="Acier, Bleu, Or rose…"
        />
      </fieldset>

      {/* Caractéristiques techniques */}
      <fieldset className="border border-[#002141]/15 p-4 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#002141]/10 pb-3">
          <div>
            <legend className="px-1 text-sm font-semibold text-[#002141]">Caractéristiques techniques dynamiques</legend>
            <p className="text-xs text-[#3A3A3A]">Champs personnalisés enregistrés au format JSON réutilisable.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={loadHorlogerieTemplate}
              className="inline-flex items-center gap-1 rounded border border-[#002141]/20 bg-[#002141]/5 px-2.5 py-1 text-[11px] font-semibold text-[#002141] hover:bg-[#002141] hover:text-white"
            >
              <Sparkles className="h-3 w-3" /> Modèle Horlogerie
            </button>
            <button
              type="button"
              onClick={loadParfumsTemplate}
              className="inline-flex items-center gap-1 rounded border border-[#002141]/20 bg-[#002141]/5 px-2.5 py-1 text-[11px] font-semibold text-[#002141] hover:bg-[#002141] hover:text-white"
            >
              <Sparkles className="h-3 w-3" /> Modèle Parfums
            </button>
            <button
              type="button"
              onClick={loadLunettesTemplate}
              className="inline-flex items-center gap-1 rounded border border-[#002141]/20 bg-[#002141]/5 px-2.5 py-1 text-[11px] font-semibold text-[#002141] hover:bg-[#002141] hover:text-white"
            >
              <Sparkles className="h-3 w-3" /> Modèle Lunettes
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {attributes.map(([key, value], index) => (
            <div key={`${key}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input
                value={key}
                onChange={(event) => {
                  const next = [...attributes];
                  next[index] = [event.target.value, value];
                  saveAttributes(next);
                }}
                className="admin-input"
                placeholder="Ex. diamètre, mouvement, verres..."
              />
              <input
                value={value}
                onChange={(event) => {
                  const next = [...attributes];
                  next[index] = [key, event.target.value];
                  saveAttributes(next);
                }}
                className="admin-input"
                placeholder="Valeur technique"
              />
              <button
                type="button"
                onClick={() => saveAttributes(attributes.filter((_, current) => current !== index))}
                className="admin-icon-button text-red-800"
                aria-label="Supprimer la caractéristique"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => saveAttributes([...attributes, ['', '']])} className="admin-secondary-button mt-3">
          + Ajouter une ligne de caractéristique
        </button>
      </fieldset>

      {/* Variantes */}
      <fieldset className="border border-[#002141]/15 p-4 bg-white">
        <legend className="px-1 text-sm font-semibold text-[#002141]">Variantes produit (Taille, SKU, Stock, Prix)</legend>
        <p className="mt-1 text-xs text-[#3A3A3A]">Définissez chaque déclinaison avec son SKU, stock et prix propre.</p>
        <div className="mt-3 space-y-3">
          {variants.map((variant, index) => (
            <div key={index} className="grid gap-2 border border-[#002141]/10 p-3 sm:grid-cols-4 bg-[#FAF9F7]">
              <input
                value={variant.name || ''}
                onChange={(event) => {
                  const next = [...variants];
                  next[index] = { ...variant, name: event.target.value };
                  onChange('variants', JSON.stringify(next));
                }}
                className="admin-input"
                placeholder="Nom (ex. Cuir Noir 40mm)"
              />
              <input
                value={variant.sku || ''}
                onChange={(event) => {
                  const next = [...variants];
                  next[index] = { ...variant, sku: event.target.value };
                  onChange('variants', JSON.stringify(next));
                }}
                className="admin-input"
                placeholder="SKU variante"
              />
              <input
                type="number"
                value={variant.stock_quantity ?? 0}
                onChange={(event) => {
                  const next = [...variants];
                  next[index] = { ...variant, stock_quantity: Number(event.target.value) };
                  onChange('variants', JSON.stringify(next));
                }}
                className="admin-input"
                placeholder="Stock"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={variant.sale_price_xof ?? ''}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...variant, sale_price_xof: event.target.value };
                    onChange('variants', JSON.stringify(next));
                  }}
                  className="admin-input"
                  placeholder="Prix FCFA (si diff.)"
                />
                <button
                  type="button"
                  onClick={() => onChange('variants', JSON.stringify(variants.filter((_, current) => current !== index)))}
                  className="admin-icon-button text-red-800"
                  aria-label="Supprimer la variante"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange('variants', JSON.stringify([...variants, { name: '', sku: '', stock_quantity: 0, sale_price_xof: '', options: {}, is_active: true }]))}
          className="admin-secondary-button mt-3"
        >
          + Ajouter une variante
        </button>
      </fieldset>

      {/* FAQ produit */}
      <fieldset className="border border-[#002141]/15 p-4 bg-white">
        <legend className="px-1 text-sm font-semibold text-[#002141]">F.A.Q. spécifique à cette pièce</legend>
        <p className="mt-1 text-xs text-[#3A3A3A]">Questions fréquentes clients affichées directement sur la fiche produit.</p>
        <div className="mt-3 space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="space-y-2 border border-[#002141]/10 p-3 bg-[#FAF9F7]">
              <input
                value={faq.question || ''}
                onChange={(event) => {
                  const next = [...faqs];
                  next[index] = { ...faq, question: event.target.value };
                  onChange('faq', JSON.stringify(next));
                }}
                className="admin-input font-medium"
                placeholder="Question (ex. Quelle est la durée de la garantie ?)"
              />
              <textarea
                value={faq.answer || ''}
                onChange={(event) => {
                  const next = [...faqs];
                  next[index] = { ...faq, answer: event.target.value };
                  onChange('faq', JSON.stringify(next));
                }}
                className="admin-input min-h-16"
                placeholder="Réponse détaillée..."
              />
              <button
                type="button"
                onClick={() => onChange('faq', JSON.stringify(faqs.filter((_, current) => current !== index)))}
                className="text-xs font-semibold text-red-800 hover:underline"
              >
                Supprimer la question
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange('faq', JSON.stringify([...faqs, { question: '', answer: '' }]))}
          className="admin-secondary-button mt-3"
        >
          + Ajouter une question FAQ
        </button>
      </fieldset>
    </div>
  );
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
  const [productStockFilter, setProductStockFilter] = useState('');
  const [productSort, setProductSort] = useState<'date_desc' | 'name_asc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc'>('date_desc');
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
  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const query = productSearch.trim().toLocaleLowerCase('fr-FR');
      const matchesSearch = !query || [product.name, product.reference, product.sku, product.brand].some((value) => String(value || '').toLocaleLowerCase('fr-FR').includes(query));
      const matchesCategory = !productCategoryFilter || (productCategoryFilter === 'autre' ? !['montres', 'parfums', 'lunettes'].includes(product.category) : product.category === productCategoryFilter);
      const matchesStatus = !productStatusFilter || product.status === productStatusFilter;

      const stockQty = Number(product.stock_quantity ?? 0);
      const lowThresh = Number(product.low_stock_threshold ?? 2);
      const policy = product.stock_policy;
      let stockState = 'in_stock';
      if (policy === 'on_order') stockState = 'on_order';
      else if (stockQty <= 0) stockState = 'out_of_stock';
      else if (stockQty <= lowThresh) stockState = 'low_stock';

      const matchesStock = !productStockFilter || stockState === productStockFilter;

      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    });

    return filtered.sort((a, b) => {
      if (productSort === 'name_asc') return String(a.name || '').localeCompare(String(b.name || ''));
      if (productSort === 'price_asc') return (Number(a.sale_price_xof || a.regular_price_xof || 0) - Number(b.sale_price_xof || b.regular_price_xof || 0));
      if (productSort === 'price_desc') return (Number(b.sale_price_xof || b.regular_price_xof || 0) - Number(a.sale_price_xof || a.regular_price_xof || 0));
      if (productSort === 'stock_asc') return (Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0));
      if (productSort === 'stock_desc') return (Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0));
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [products, productSearch, productStatusFilter, productCategoryFilter, productStockFilter, productSort]);

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
      const finalCategory = productForm.category === 'autre' ? (productForm.custom_category?.trim() || 'autre') : productForm.category;
      const finalSlug = productForm.slug ? slugify(productForm.slug) : slugify(productForm.name);

      if (productForm.status === 'published') {
        if (!productForm.name?.trim()) throw new Error('Le nom du produit est obligatoire.');
        if (!finalCategory) throw new Error('Veuillez préciser une catégorie.');
        const regularPrice = Number(productForm.regular_price_xof || 0);
        if (regularPrice <= 0) throw new Error('Le prix normal doit être un entier strictement supérieur à 0 FCFA.');
        if (productForm.sale_price_xof !== '' && productForm.sale_price_xof !== null && productForm.sale_price_xof !== undefined) {
          const salePrice = Number(productForm.sale_price_xof);
          if (salePrice >= regularPrice) {
            throw new Error('Le prix promo / réduit doit être strictement inférieur au prix normal. Corrigez le prix ou laissez-le vide.');
          }
        }
        const mediaIds = Array.isArray(productForm.media_ids) ? productForm.media_ids : [];
        if (!mediaIds.length && !productForm.primary_media_id) {
          throw new Error('Au moins une image est obligatoire pour publier un produit.');
        }
      }

      const finalPayload = {
        ...productForm,
        category: finalCategory,
        slug: finalSlug
      };

      let product: AnyRecord;
      if (editingProduct?.id) product = await adminRequest(`/products/${editingProduct.id}`, { method: 'PATCH', body: finalPayload });
      else product = await adminRequest('/products', { method: 'POST', body: finalPayload });

      const variants = JSON.parse(productForm.variants || '[]');
      if (Array.isArray(variants)) await adminRequest(`/products/${product.id}/variants`, { method: 'PUT', body: { variants } });
      const mediaIds = Array.isArray(productForm.media_ids) ? productForm.media_ids : [];
      if (mediaIds.length || productForm.primary_media_id) {
        await adminRequest(`/products/${product.id}/media`, { method: 'PUT', body: { media_ids: mediaIds, primary_media_id: productForm.primary_media_id || null } });
      }

      setEditingProduct(null);
      setProductForm(emptyProduct());
      await loadTab('products');
      notify('Fiche produit enregistrée avec succès.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Le produit n’a pas pu être enregistré.');
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
    const topPages = dashboard?.topPages || [];
    const topProducts = dashboard?.topProducts || [];
    const recentOrders = dashboard?.recentOrders || [];
    const lowStockProds = dashboard?.lowStockProducts || [];

    return <>
      <PanelHeader
        eyebrow="Pilotage analytique Supabase"
        title="Tableau de bord"
        description="Vue synthétique en temps réel de votre activité commerciale, trafic, comportement des visiteurs, état des stocks et éléments à modérer."
        action={
          <button type="button" onClick={() => void loadTab('dashboard')} className="admin-secondary-button">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
        }
      />

      {/* Barre de filtres de période */}
      <div className="mb-6 flex flex-wrap items-end gap-3 border border-[#002141]/12 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold text-[#002141]">
          Période d’analyse
          <select
            value={dashboardPeriod}
            onChange={(event) => setDashboardPeriod(event.target.value as typeof dashboardPeriod)}
            className="admin-input mt-1 min-w-44"
          >
            <option value="day">Aujourd’hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">30 derniers jours</option>
            <option value="custom">Période personnalisée</option>
          </select>
        </label>
        {dashboardPeriod === 'custom' && (
          <>
            <label className="text-xs font-semibold text-[#002141]">
              Du
              <input type="date" value={dashboardCustomFrom} onChange={(event) => setDashboardCustomFrom(event.target.value)} className="admin-input mt-1" />
            </label>
            <label className="text-xs font-semibold text-[#002141]">
              Au
              <input type="date" value={dashboardCustomTo} onChange={(event) => setDashboardCustomTo(event.target.value)} className="admin-input mt-1" />
            </label>
          </>
        )}
        <button type="button" onClick={() => void loadTab('dashboard')} className="admin-primary-button">
          Appliquer
        </button>
      </div>

      {/* Grille de KPIs réels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Chiffre d’affaires', formatXOF(dashboardTotals.revenueXOF), 'Commandes encaissées sur la période'],
          ['Panier moyen', formatXOF(dashboardTotals.averageCartXOF), 'Calculé sur les commandes validées'],
          ['Commandes', String(dashboardTotals.orders || 0), 'Total enregistrées sur la période'],
          ['Visites de la boutique', String(dashboardTotals.totalVisits || 0), 'Pages vues enregistrées par les visiteurs'],
          ['Produits en favoris', String(dashboardTotals.wishlistCount || 0), 'Ajouts à la liste d’envies clients'],
          ['Stock à surveiller', String(dashboardTotals.lowStock || 0), 'Produits au seuil ou épuisés'],
          ['Nouveaux clients', String(dashboardTotals.newCustomers || 0), 'Nouveaux comptes créés'],
          ['Éléments à traiter', String((dashboardTotals.pendingReviews || 0) + (dashboardTotals.unreadMessages || 0)), 'Avis en attente & messages non lus']
        ].map(([label, value, note]) => (
          <article key={label} className="border border-[#002141]/12 bg-white p-5 shadow-sm transition-all hover:border-[#AC854B]/50">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3A3A3A]">{label}</p>
            <p className="font-playfair mt-3 text-3xl font-semibold text-[#002141]">{value}</p>
            <p className="mt-2 text-xs text-[#3A3A3A]">{note}</p>
          </article>
        ))}
      </div>

      {/* Répartition des commandes par statut */}
      {Object.keys(statuses).length > 0 && (
        <section className="mt-6 border border-[#002141]/12 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3A3A3A]">Commandes par statut</p>
            <span className="text-xs text-[#3A3A3A]">Cliquez sur un statut pour afficher les commandes correspondantes</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {Object.entries(statuses).map(([status, count]) => {
              const countNum = Number(count);
              return (
                <button
                  type="button"
                  key={status}
                  onClick={() => { setOrderStatusFilter(status); selectTab('orders'); }}
                  className="flex items-center gap-2 border border-[#002141]/15 bg-[#FAF9F7] px-3.5 py-2 text-left text-xs transition hover:border-[#AC854B] hover:bg-white"
                >
                  <span className="font-bold text-[#AC854B]">{countNum}</span>
                  <span className="text-[#002141]">{statusLabel[status] || status}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Graphique et bloc Contenu à traiter */}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="border border-[#002141]/12 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#002141]/10 pb-4">
            <div>
              <h2 className="font-playfair text-xl font-semibold text-[#002141]">Évolution de l’activité</h2>
              <p className="text-xs text-[#3A3A3A]">Chiffre d’affaires et commandes quotidiennes</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-[#AC854B]" /> CA (FCFA)</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-[#002141]" /> Visites</span>
            </div>
          </div>

          {chart.length === 0 || chart.every((p: AnyRecord) => !p.revenueXOF && !p.orders && !p.visits) ? (
            <div className="my-12 flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#002141]/5 text-[#002141]">
                <BarChart3 className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#002141]">Aucune donnée sur cette période</p>
              <p className="mt-1 max-w-sm text-xs text-[#3A3A3A]">
                Aucune commande ni visite enregistrée sur la période sélectionnée. Modifiez la période ci-dessus ou effectuez un test.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex h-52 items-end gap-2 overflow-x-auto pb-2">
              {chart.map((point: AnyRecord) => {
                const revHeight = maxRevenue > 0 ? Math.max(6, Math.round((Number(point.revenueXOF || 0) / maxRevenue) * 100)) : 0;
                return (
                  <div key={point.date} className="group flex min-w-8 flex-1 flex-col items-center justify-end gap-1.5">
                    <div className="hidden rounded bg-[#002141] px-2 py-1 text-center text-[10px] text-white shadow group-hover:block">
                      <p className="font-semibold">{formatXOF(point.revenueXOF)}</p>
                      <p className="text-[9px] text-[#D6BB8F]">{point.orders} cmd. · {point.visits} visites</p>
                    </div>
                    <div className="flex w-full items-end gap-0.5" style={{ height: '140px' }}>
                      <div
                        className="w-full bg-[#AC854B] transition-all hover:bg-[#8F6A33]"
                        style={{ height: `${revHeight}%` }}
                        title={`${formatXOF(point.revenueXOF)} - ${point.orders} commande(s)`}
                      />
                    </div>
                    <span className="text-[9px] text-[#3A3A3A]">{String(point.date).slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bloc "Contenu à traiter" */}
        <section className="border border-[#002141]/12 bg-[#002141] p-6 text-[#FAF9F7] shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D6BB8F]">Contenu à traiter</p>
          <p className="mt-1 text-xs text-[#FAF9F7]/70">Actions requises en attente dans le portail</p>

          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => selectTab('reviews')}
              className="group flex w-full items-center justify-between rounded border border-[#D6BB8F]/20 bg-white/5 p-4 text-left transition hover:border-[#D6BB8F] hover:bg-white/10"
            >
              <div>
                <strong className="font-playfair text-3xl font-semibold text-[#D6BB8F]">
                  {dashboardTotals.pendingReviews || 0}
                </strong>
                <p className="text-xs font-medium text-[#FAF9F7]">Avis clients en attente de modération</p>
              </div>
              <span className="text-xs text-[#D6BB8F] opacity-0 transition group-hover:opacity-100">Modérer &rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => selectTab('messages')}
              className="group flex w-full items-center justify-between rounded border border-[#D6BB8F]/20 bg-white/5 p-4 text-left transition hover:border-[#D6BB8F] hover:bg-white/10"
            >
              <div>
                <strong className="font-playfair text-3xl font-semibold text-[#D6BB8F]">
                  {dashboardTotals.unreadMessages || 0}
                </strong>
                <p className="text-xs font-medium text-[#FAF9F7]">Messages de contact non lus</p>
              </div>
              <span className="text-xs text-[#D6BB8F] opacity-0 transition group-hover:opacity-100">Consulter &rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => selectTab('users')}
              className="group flex w-full items-center justify-between rounded border border-[#D6BB8F]/20 bg-white/5 p-4 text-left transition hover:border-[#D6BB8F] hover:bg-white/10"
            >
              <div>
                <strong className="font-playfair text-3xl font-semibold text-[#D6BB8F]">
                  {dashboardTotals.newCustomers || 0}
                </strong>
                <p className="text-xs font-medium text-[#FAF9F7]">Nouveaux comptes clients inscrits</p>
              </div>
              <span className="text-xs text-[#D6BB8F] opacity-0 transition group-hover:opacity-100">Voir clients &rarr;</span>
            </button>

            <button
              type="button"
              onClick={() => selectTab('products')}
              className="group flex w-full items-center justify-between rounded border border-[#D6BB8F]/20 bg-white/5 p-4 text-left transition hover:border-[#D6BB8F] hover:bg-white/10"
            >
              <div>
                <strong className="font-playfair text-3xl font-semibold text-[#D6BB8F]">
                  {dashboardTotals.lowStock || 0}
                </strong>
                <p className="text-xs font-medium text-[#FAF9F7]">Produits en stock faible / rupture</p>
              </div>
              <span className="text-xs text-[#D6BB8F] opacity-0 transition group-hover:opacity-100">Réapprovisionner &rarr;</span>
            </button>
          </div>
        </section>
      </div>

      {/* Top Pages & Top Produits */}
      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        {/* Pages les plus visitées */}
        <section className="border border-[#002141]/12 bg-white p-6 shadow-sm">
          <h2 className="font-playfair text-xl font-semibold text-[#002141]">Pages les plus visitées</h2>
          <p className="text-xs text-[#3A3A3A]">Audience par rubrique du site public</p>

          {topPages.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#3A3A3A]">Aucune visite enregistrée sur cette période.</p>
              <p className="mt-1 text-xs text-[#3A3A3A]/70">Naviguez sur le site public pour enregistrer du trafic en direct.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#002141]/10">
              {topPages.map((page: AnyRecord) => (
                <div key={page.path} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-[#002141]">{page.title || page.path}</p>
                    <p className="text-xs text-[#3A3A3A]">{page.path}</p>
                  </div>
                  <span className="rounded bg-[#002141]/5 px-2.5 py-1 text-xs font-bold text-[#002141]">
                    {page.views} visite(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Produits les plus consultés */}
        <section className="border border-[#002141]/12 bg-white p-6 shadow-sm">
          <h2 className="font-playfair text-xl font-semibold text-[#002141]">Produits les plus consultés</h2>
          <p className="text-xs text-[#3A3A3A]">Fiches produit générant le plus d’intérêt</p>

          {topProducts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#3A3A3A]">Aucun produit consulté sur cette période.</p>
              <p className="mt-1 text-xs text-[#3A3A3A]/70">Les consultations de fiches produit s’afficheront ici.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#002141]/10">
              {topProducts.map((item: AnyRecord) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    const prod = products.find((p) => p.id === item.id);
                    if (prod) {
                      setEditingProduct(prod);
                      setProductForm(prod);
                      selectTab('products');
                    }
                  }}
                  className="flex w-full items-center justify-between py-3 text-left hover:text-[#AC854B]"
                >
                  <div className="flex items-center gap-3">
                    {item.primary_image ? (
                      <img src={item.primary_image} alt="" className="h-10 w-10 border border-[#002141]/10 object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center bg-[#002141]/5 text-xs font-bold text-[#002141]">N/A</div>
                    )}
                    <div>
                      <p className="font-medium text-[#002141]">{item.name}</p>
                      <p className="text-xs text-[#AC854B]">{formatXOF(item.price_xof)}</p>
                    </div>
                  </div>
                  <span className="rounded bg-[#002141]/5 px-2.5 py-1 text-xs font-bold text-[#002141]">
                    {item.views} vue(s)
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Dernières commandes & Stock faible */}
      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        {/* Dernières commandes */}
        <section className="border border-[#002141]/12 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#002141]/10 pb-3">
            <h2 className="font-playfair text-xl font-semibold text-[#002141]">Dernières commandes</h2>
            <button
              type="button"
              onClick={() => selectTab('orders')}
              className="text-xs font-medium text-[#AC854B] hover:underline"
            >
              Voir tout &rarr;
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <p className="mt-8 py-6 text-center text-sm text-[#3A3A3A]">Aucune commande enregistrée pour le moment.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#002141]/10">
              {recentOrders.map((order: AnyRecord) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setOrderSearch(order.order_number || order.id);
                    selectTab('orders');
                  }}
                  className="flex w-full items-center justify-between px-2 py-3.5 text-left text-sm transition hover:bg-[#FAF9F7]"
                >
                  <div>
                    <p className="font-semibold text-[#002141]">{order.order_number || order.id}</p>
                    <p className="text-xs text-[#3A3A3A]">{order.customer_name || 'Client'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#002141]">{formatXOF(order.total_xof)}</p>
                    <span className="mt-0.5 inline-block text-xs text-[#AC854B]">
                      {statusLabel[order.status] || order.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Stock faible ou épuisé */}
        <section className="border border-[#002141]/12 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#002141]/10 pb-3">
            <h2 className="font-playfair text-xl font-semibold text-[#002141]">Stock faible ou épuisé</h2>
            <button
              type="button"
              onClick={() => selectTab('products')}
              className="text-xs font-medium text-[#AC854B] hover:underline"
            >
              Gérer le catalogue &rarr;
            </button>
          </div>

          {lowStockProds.length === 0 ? (
            <p className="mt-8 py-6 text-center text-sm text-[#3A3A3A]">
              Tous vos produits disposent d'un niveau de stock suffisant.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-[#002141]/10">
              {lowStockProds.map((product: AnyRecord) => {
                const stock = Number(product.stock_quantity || 0);
                const isOutOfStock = stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setEditingProduct(product);
                      setProductForm(product);
                      selectTab('products');
                    }}
                    className="flex w-full items-center justify-between px-2 py-3.5 text-left text-sm transition hover:bg-[#FAF9F7]"
                  >
                    <div className="flex items-center gap-3">
                      {product.primary_image ? (
                        <img src={product.primary_image} alt="" className="h-9 w-9 border border-[#002141]/10 object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center bg-[#002141]/5 text-xs font-bold text-[#002141]">N/A</div>
                      )}
                      <div>
                        <p className="font-medium text-[#002141]">{product.name}</p>
                        <p className="text-xs text-[#3A3A3A]">Réf: {product.reference || product.slug}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded px-2.5 py-1 text-xs font-bold ${
                        isOutOfStock
                          ? 'border border-red-200 bg-red-100 text-red-800'
                          : 'border border-amber-200 bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isOutOfStock ? 'Épuisé (0)' : `Stock : ${stock}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>;
  };

  const renderProducts = () => {
    const selectedMediaAssets = (Array.isArray(productForm.media_ids) ? productForm.media_ids : [])
      .map((id: string) => media.find((asset) => asset.id === id))
      .filter((asset): asset is AnyRecord => Boolean(asset));

    const currentRegular = Number(productForm.regular_price_xof || 0);
    const currentSale = productForm.sale_price_xof !== '' && productForm.sale_price_xof !== null ? Number(productForm.sale_price_xof) : null;
    const currentPurchase = Number(productForm.purchase_price_xof || 0);

    const effectivePrice = currentSale !== null && currentSale > 0 && currentSale < currentRegular ? currentSale : currentRegular;
    const grossMargin = effectivePrice - currentPurchase;
    const marginPercent = effectivePrice > 0 ? Math.round((grossMargin / effectivePrice) * 100) : 0;

    const currentStock = Number(productForm.stock_quantity ?? 0);
    const currentThreshold = Number(productForm.low_stock_threshold ?? 2);
    const isOnOrder = productForm.stock_policy === 'on_order';

    let autoStockStatus = { label: 'En stock', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (isOnOrder) {
      autoStockStatus = { label: 'Sur commande', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    } else if (currentStock <= 0) {
      autoStockStatus = { label: 'Indisponible (Rupture)', color: 'bg-red-100 text-red-800 border-red-300' };
    } else if (currentStock <= currentThreshold) {
      autoStockStatus = { label: 'Stock limité', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    }

    const productReviews = editingProduct?.id
      ? (resources.reviews || []).filter((r) => r.product_id === editingProduct.id)
      : [];

    return (
      <>
        <PanelHeader
          eyebrow="Commerce & Catalogue"
          title="Produits et gestion des stocks"
          description="Gérez les fiches produit complètes, ajustez les prix, calculez les marges en temps réel, configurez les variantes, caractéristiques et règles de stock."
          action={
            <button
              type="button"
              onClick={() => {
                setEditingProduct({});
                setProductForm(emptyProduct());
              }}
              className="admin-primary-button"
            >
              <PackagePlus className="h-4 w-4" /> Nouveau produit
            </button>
          }
        />

        {editingProduct !== null && (
          <form onSubmit={saveProduct} className="mb-8 border border-[#002141]/15 bg-white p-5 shadow-sm sm:p-7 space-y-8">
            <div className="flex items-center justify-between border-b border-[#002141]/10 pb-4">
              <div>
                <h2 className="font-playfair text-2xl font-semibold text-[#002141]">
                  {editingProduct.id ? `Modifier le produit : ${editingProduct.name}` : 'Création d’un nouveau produit'}
                </h2>
                <p className="mt-1 text-sm text-[#3A3A3A]">Renseignez les détails pour publier ou préparer la fiche produit.</p>
              </div>
              <button type="button" onClick={() => setEditingProduct(null)} className="admin-icon-button" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Informations Générales */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2 border-b border-[#002141]/10 pb-2">
                <Boxes className="h-4 w-4 text-[#AC854B]" /> Informations générales
              </h3>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {/* Nom */}
                <label className="text-sm font-semibold text-[#002141]">
                  Nom du produit <span className="text-red-700">*</span>
                  <input
                    required
                    type="text"
                    value={productForm.name || ''}
                    onChange={(event) => {
                      const name = event.target.value;
                      setProductForm((current) => ({
                        ...current,
                        name,
                        slug: current.slug_manually_edited ? current.slug : slugify(name)
                      }));
                    }}
                    className="admin-input mt-2"
                    placeholder="ex. HERITAGE Master Chronograph 40"
                  />
                </label>

                {/* Slug */}
                <label className="text-sm font-semibold text-[#002141]">
                  Slug URL <span className="text-xs font-normal text-[#3A3A3A]">(auto-généré et éditable)</span>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={productForm.slug || ''}
                      onChange={(event) => {
                        setProductForm((current) => ({
                          ...current,
                          slug: slugify(event.target.value),
                          slug_manually_edited: true
                        }));
                      }}
                      className="admin-input"
                      placeholder="heritage-master-chronograph-40"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setProductForm((current) => ({
                          ...current,
                          slug: slugify(current.name),
                          slug_manually_edited: false
                        }))
                      }
                      className="admin-secondary-button text-xs whitespace-nowrap"
                    >
                      Régénérer
                    </button>
                  </div>
                </label>

                {/* Catégorie */}
                <label className="text-sm font-semibold text-[#002141]">
                  Catégorie <span className="text-red-700">*</span>
                  <select
                    value={productForm.category || 'montres'}
                    onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))}
                    className="admin-input mt-2"
                  >
                    <option value="montres">Montres</option>
                    <option value="parfums">Parfums (masqués si aucun produit publié)</option>
                    <option value="lunettes">Lunettes (masquées si aucun produit publié)</option>
                    <option value="autre">Autre catégorie (à préciser)</option>
                  </select>
                </label>

                {productForm.category === 'autre' && (
                  <label className="text-sm font-semibold text-[#002141]">
                    Préciser la catégorie <span className="text-red-700">*</span>
                    <input
                      required
                      type="text"
                      value={productForm.custom_category || ''}
                      onChange={(event) => setProductForm((current) => ({ ...current, custom_category: event.target.value }))}
                      className="admin-input mt-2"
                      placeholder="ex. Joaillerie, Accessoires..."
                    />
                  </label>
                )}

                {/* Marque */}
                <label className="text-sm font-semibold text-[#002141]">
                  Marque
                  <input
                    type="text"
                    value={productForm.brand || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, brand: event.target.value }))}
                    className="admin-input mt-2"
                    placeholder="ex. HERITAGE Genève, Tissot..."
                  />
                </label>

                {/* Référence */}
                <label className="text-sm font-semibold text-[#002141]">
                  Référence produit
                  <input
                    type="text"
                    value={productForm.reference || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, reference: event.target.value }))}
                    className="admin-input mt-2"
                    placeholder="ex. REF-HER-8041"
                  />
                </label>

                {/* SKU */}
                <label className="text-sm font-semibold text-[#002141]">
                  Code SKU
                  <input
                    type="text"
                    value={productForm.sku || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
                    className="admin-input mt-2"
                    placeholder="ex. SKU-MON-001"
                  />
                </label>

                {/* Statut de publication */}
                <label className="text-sm font-semibold text-[#002141]">
                  Statut de publication
                  <select
                    value={productForm.status || 'draft'}
                    onChange={(event) => setProductForm((current) => ({ ...current, status: event.target.value }))}
                    className="admin-input mt-2 font-medium"
                  >
                    <option value="draft">Brouillon (non visible sur le site)</option>
                    <option value="published">Publié (visible en boutique)</option>
                    <option value="archived">Archivé (masqué)</option>
                  </select>
                </label>
              </div>
            </section>

            {/* Prix & Marge commerciale */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2 border-b border-[#002141]/10 pb-2">
                <BarChart3 className="h-4 w-4 text-[#AC854B]" /> Prix & Marge commerciale (FCFA / XOF)
              </h3>

              <div className="grid gap-5 md:grid-cols-3">
                <label className="text-sm font-semibold text-[#002141]">
                  Prix d'achat FCFA
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.purchase_price_xof ?? ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, purchase_price_xof: event.target.value }))}
                    className="admin-input mt-2"
                    placeholder="ex. 150000"
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Prix normal FCFA <span className="text-red-700">*</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.regular_price_xof ?? ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, regular_price_xof: event.target.value }))}
                    className="admin-input mt-2 font-bold text-[#002141]"
                    placeholder="ex. 250000"
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Prix actuel / Promo FCFA
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.sale_price_xof ?? ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, sale_price_xof: event.target.value }))}
                    className="admin-input mt-2"
                    placeholder="Laissez vide si aucun prix réduit"
                  />
                </label>
              </div>

              {/* Règle et calcul automatique de la marge */}
              <div className="border border-[#002141]/15 bg-[#FAF9F7] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#AC854B]">Calculateur de marge brute</p>
                  <p className="mt-1 text-sm font-semibold text-[#002141]">
                    Prix de vente effectif : <span className="text-[#AC854B]">{formatXOF(effectivePrice)}</span>
                  </p>
                  <p className="text-xs text-[#3A3A3A] mt-0.5">
                    Prix d'achat renseigné : {currentPurchase > 0 ? formatXOF(currentPurchase) : 'Non renseigné'}
                  </p>
                </div>

                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#002141]/15 pt-3 md:pt-0 md:pl-6">
                  <div>
                    <p className="text-xs text-[#3A3A3A]">Marge brute</p>
                    <p className={`text-base font-bold ${grossMargin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatXOF(grossMargin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#3A3A3A]">Taux de marge</p>
                    <p className={`text-base font-bold ${marginPercent >= 20 ? 'text-emerald-700' : marginPercent > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                      {marginPercent} %
                    </p>
                  </div>
                </div>
              </div>

              {/* Vérification du prix promo */}
              {currentSale !== null && currentSale > 0 && currentSale >= currentRegular && (
                <div className="flex items-center gap-2 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <p>
                    <strong>Règle de prix :</strong> Le prix promo ({formatXOF(currentSale)}) est supérieur ou égal au prix normal ({formatXOF(currentRegular)}). Aucun prix barré ne sera affiché côté public.
                  </p>
                </div>
              )}
              {currentSale !== null && currentSale > 0 && currentSale < currentRegular && currentRegular > 0 && (
                <div className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <Check className="h-4 w-4 shrink-0 text-emerald-700" />
                  <p>
                    <strong>Prix barré actif :</strong> Réduction de {Math.round(((currentRegular - currentSale) / currentRegular) * 100)} % sur le prix public ({formatXOF(currentRegular)} → {formatXOF(currentSale)}).
                  </p>
                </div>
              )}
            </section>

            {/* Gestion des Stocks */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2 border-b border-[#002141]/10 pb-2">
                <Boxes className="h-4 w-4 text-[#AC854B]" /> Stock & Politique de disponibilité
              </h3>

              <div className="grid gap-5 md:grid-cols-3">
                <label className="text-sm font-semibold text-[#002141]">
                  Quantité disponible en stock
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock_quantity ?? 0}
                    onChange={(event) => setProductForm((current) => ({ ...current, stock_quantity: Number(event.target.value) }))}
                    className="admin-input mt-2"
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Seuil d'alerte stock faible
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.low_stock_threshold ?? 2}
                    onChange={(event) => setProductForm((current) => ({ ...current, low_stock_threshold: Number(event.target.value) }))}
                    className="admin-input mt-2"
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Politique de stock
                  <select
                    value={productForm.stock_policy || 'standard'}
                    onChange={(event) => setProductForm((current) => ({ ...current, stock_policy: event.target.value }))}
                    className="admin-input mt-2"
                  >
                    <option value="standard">Stock géré (avec décrémentation)</option>
                    <option value="on_order">Sur commande (sans blocage stock)</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#3A3A3A]">Statut calculé automatiquement :</span>
                <span className={`inline-flex items-center px-3 py-1 text-xs font-bold border ${autoStockStatus.color}`}>
                  {autoStockStatus.label}
                </span>
              </div>
            </section>

            {/* Galerie Multi-Images & Ordre & Alt Text */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#002141]/10 pb-2">
                <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#AC854B]" /> Galerie d’images & Image principale
                </h3>
                <label className="admin-secondary-button cursor-pointer text-xs">
                  <Upload className="h-3.5 w-3.5" /> Téléverser de nouvelles images
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    onChange={uploadMedia}
                  />
                </label>
              </div>

              <p className="text-xs text-[#3A3A3A]">
                🔒 <strong>Authenticité :</strong> Seules les vraies photos de produits avec un texte alternatif explicite sont autorisées. Les images générées par IA sont refusées.
              </p>

              {/* Images sélectionnées pour ce produit */}
              {selectedMediaAssets.length > 0 && (
                <div className="space-y-2 border border-[#002141]/15 p-4 bg-[#FAF9F7]">
                  <p className="text-xs font-semibold text-[#002141] uppercase tracking-wider">
                    Images rattachées au produit ({selectedMediaAssets.length})
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedMediaAssets.map((asset, index) => {
                      const isPrimary = productForm.primary_media_id === asset.id || (!productForm.primary_media_id && index === 0);
                      return (
                        <div key={asset.id} className="border border-[#002141]/15 bg-white p-3 flex flex-col justify-between gap-3">
                          <div className="flex gap-3">
                            <img src={asset.public_url} alt={asset.alt_text || ''} className="h-16 w-16 object-cover shrink-0 border" />
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#002141] truncate">{asset.file_name}</p>
                              <input
                                type="text"
                                value={asset.alt_text || ''}
                                placeholder="Texte alternatif (obligatoire)*"
                                onChange={async (e) => {
                                  const newAlt = e.target.value;
                                  setMedia((current) => current.map((m) => (m.id === asset.id ? { ...m, alt_text: newAlt } : m)));
                                  try {
                                    await adminRequest(`/media/${asset.id}`, { method: 'PATCH', body: { alt_text: newAlt } });
                                  } catch {
                                    /* quiet fail */
                                  }
                                }}
                                className="admin-input text-xs py-1"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-[#002141]/10 pt-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setProductForm((current) => ({ ...current, primary_media_id: asset.id }))}
                              className={`px-2 py-0.5 font-semibold text-[11px] ${
                                isPrimary
                                  ? 'bg-[#002141] text-[#FAF9F7]'
                                  : 'border border-[#002141]/20 text-[#002141] hover:bg-[#002141]/5'
                              }`}
                            >
                              {isPrimary ? '★ Principale' : 'Définir principale'}
                            </button>

                            <div className="flex items-center gap-1">
                              {index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextIds = [...productForm.media_ids];
                                    const temp = nextIds[index - 1];
                                    nextIds[index - 1] = nextIds[index];
                                    nextIds[index] = temp;
                                    setProductForm((current) => ({ ...current, media_ids: nextIds }));
                                  }}
                                  className="admin-icon-button"
                                  title="Monter"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {index < selectedMediaAssets.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextIds = [...productForm.media_ids];
                                    const temp = nextIds[index + 1];
                                    nextIds[index + 1] = nextIds[index];
                                    nextIds[index] = temp;
                                    setProductForm((current) => ({ ...current, media_ids: nextIds }));
                                  }}
                                  className="admin-icon-button"
                                  title="Descendre"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setProductForm((current) => {
                                    const ids = current.media_ids.filter((id: string) => id !== asset.id);
                                    return {
                                      ...current,
                                      media_ids: ids,
                                      primary_media_id: current.primary_media_id === asset.id ? (ids[0] || '') : current.primary_media_id
                                    };
                                  })
                                }
                                className="admin-icon-button text-red-800"
                                title="Retirer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sélectionner dans la galerie globale */}
              <fieldset className="border border-[#002141]/15 p-4">
                <legend className="px-1 text-sm font-semibold text-[#002141]">Cocher des visuels dans la galerie globale</legend>
                <div className="mt-2 max-h-48 overflow-y-auto grid gap-2 sm:grid-cols-2 lg:grid-cols-4 p-1">
                  {media.map((asset) => {
                    const isChecked = (productForm.media_ids || []).includes(asset.id);
                    return (
                      <label key={asset.id} className={`flex items-center gap-2 border p-2 text-xs cursor-pointer ${isChecked ? 'border-[#002141] bg-[#002141]/5 font-semibold' : 'border-[#002141]/10 bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setProductForm((current) => {
                              const ids = Array.isArray(current.media_ids) ? current.media_ids : [];
                              const nextIds = e.target.checked ? [...ids, asset.id] : ids.filter((id: string) => id !== asset.id);
                              return {
                                ...current,
                                media_ids: nextIds,
                                primary_media_id: current.primary_media_id || nextIds[0] || ''
                              };
                            });
                          }}
                          className="h-4 w-4 accent-[#AC854B]"
                        />
                        <img src={asset.public_url} alt="" className="h-8 w-8 object-cover shrink-0" />
                        <span className="truncate">{asset.file_name}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </section>

            {/* Descriptions & Histoire */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2 border-b border-[#002141]/10 pb-2">
                <FileText className="h-4 w-4 text-[#AC854B]" /> Descriptions & Contenu de vente
              </h3>

              <label className="block text-sm font-semibold text-[#002141]">
                Description courte (accroche)
                <textarea
                  value={productForm.short_description || ''}
                  onChange={(event) => setProductForm((current) => ({ ...current, short_description: event.target.value }))}
                  className="admin-input mt-2 min-h-20"
                  placeholder="Accroche commerciale résumée pour les aperçus et cartes produit..."
                />
              </label>

              <div>
                <RichTextEditor
                  id="product-description"
                  label="Description détaillée complète"
                  value={productForm.description_html || ''}
                  onChange={(value) => setProductForm((current) => ({ ...current, description_html: value }))}
                  hint="Présentez l'histoire de la pièce, le savoir-faire horloger ou la création olfactive."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#002141]">
                  Titre de l'histoire du produit
                  <input
                    type="text"
                    value={productForm.value_story_title || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, value_story_title: event.target.value }))}
                    className="admin-input mt-2"
                    placeholder="ex. L'héritage d'une pièce d'exception"
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Texte de l'histoire du produit
                  <textarea
                    value={productForm.value_story_text || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, value_story_text: event.target.value }))}
                    className="admin-input mt-2 min-h-16"
                    placeholder="Savoir-faire, histoire de la marque..."
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-semibold text-[#002141]">
                  Résumé Provenance
                  <textarea
                    value={productForm.provenance_summary || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, provenance_summary: event.target.value }))}
                    className="admin-input mt-2 min-h-16"
                    placeholder="ex. Fabriqué en Suisse, certifié d'origine"
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Garantie & Service
                  <textarea
                    value={productForm.warranty_summary || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, warranty_summary: event.target.value }))}
                    className="admin-input mt-2 min-h-16"
                    placeholder="ex. Garantie internationale 2 ans"
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Modalités de Livraison
                  <textarea
                    value={productForm.delivery_summary || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, delivery_summary: event.target.value }))}
                    className="admin-input mt-2 min-h-16"
                    placeholder="ex. Livraison sécurisée sous 24-48h à Abidjan"
                  />
                </label>
              </div>
            </section>

            {/* Variantes, Caractéristiques Techniques & FAQ */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2 border-b border-[#002141]/10 pb-2">
                <SlidersHorizontal className="h-4 w-4 text-[#AC854B]" /> Données techniques & FAQ produit
              </h3>

              <ProductStructuredFields form={productForm} onChange={(field, value) => setProductForm((current) => ({ ...current, [field]: value }))} />
            </section>

            {/* Avis clients modérés rattachés */}
            {editingProduct.id && (
              <section className="space-y-3 border-t border-[#002141]/10 pt-4">
                <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2">
                  <Star className="h-4 w-4 text-[#AC854B]" /> Avis clients associés à ce produit ({productReviews.length})
                </h3>
                {productReviews.length === 0 ? (
                  <p className="text-xs text-[#3A3A3A]">Aucun avis déposé pour le moment sur ce produit.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {productReviews.map((rev) => (
                      <div key={rev.id} className="border border-[#002141]/10 p-3 bg-[#FAF9F7] text-xs flex justify-between items-center gap-3">
                        <div>
                          <p className="font-semibold text-[#002141]">
                            {rev.author_name} — {'★'.repeat(rev.rating)} ({rev.status})
                          </p>
                          <p className="text-[#3A3A3A] mt-1">{rev.comment}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectTab('reviews')}
                          className="admin-secondary-button text-[11px] whitespace-nowrap"
                        >
                          Gérer les avis
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Référencement SEO */}
            <section className="space-y-4 border-t border-[#002141]/10 pt-4">
              <h3 className="text-base font-semibold text-[#002141] flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#AC854B]" /> Métadonnées SEO
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#002141]">
                  Titre SEO (Balise Title)
                  <input
                    type="text"
                    value={productForm.seo_title || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, seo_title: event.target.value }))}
                    className="admin-input mt-2"
                    placeholder="Mettre un titre court et percutant..."
                  />
                </label>

                <label className="text-sm font-semibold text-[#002141]">
                  Méta Description SEO
                  <textarea
                    value={productForm.seo_description || ''}
                    onChange={(event) => setProductForm((current) => ({ ...current, seo_description: event.target.value }))}
                    className="admin-input mt-2 min-h-16"
                    placeholder="Description pour les moteurs de recherche Google..."
                  />
                </label>
              </div>
            </section>

            {/* Actions de validation */}
            <div className="flex flex-wrap gap-3 border-t border-[#002141]/10 pt-6">
              <button type="submit" className="admin-primary-button">
                Enregistrer la fiche produit
              </button>
              <button type="button" onClick={() => setEditingProduct(null)} className="admin-secondary-button">
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* Barre de Recherche & Filtres */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border border-[#002141]/12 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-[#002141]">
              Rechercher
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Nom, réf, SKU, marque..."
                className="admin-input mt-1 min-w-56"
              />
            </label>

            <label className="text-xs font-semibold text-[#002141]">
              Catégorie
              <select
                value={productCategoryFilter}
                onChange={(event) => setProductCategoryFilter(event.target.value)}
                className="admin-input mt-1"
              >
                <option value="">Toutes les catégories</option>
                <option value="montres">Montres</option>
                <option value="parfums">Parfums</option>
                <option value="lunettes">Lunettes</option>
                <option value="autre">Autres catégories</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-[#002141]">
              Statut
              <select
                value={productStatusFilter}
                onChange={(event) => setProductStatusFilter(event.target.value)}
                className="admin-input mt-1"
              >
                <option value="">Tous les statuts</option>
                <option value="published">Publiés</option>
                <option value="draft">Brouillons</option>
                <option value="archived">Archivés</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-[#002141]">
              État du stock
              <select
                value={productStockFilter}
                onChange={(event) => setProductStockFilter(event.target.value)}
                className="admin-input mt-1"
              >
                <option value="">Tous les niveaux</option>
                <option value="in_stock">En stock</option>
                <option value="low_stock">Stock limité</option>
                <option value="out_of_stock">Rupture (0)</option>
                <option value="on_order">Sur commande</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-[#002141]">
              Trier par
              <select
                value={productSort}
                onChange={(event) => setProductSort(event.target.value as any)}
                className="admin-input mt-1"
              >
                <option value="date_desc">Date (plus récents)</option>
                <option value="name_asc">Nom (A-Z)</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="stock_asc">Stock croissant</option>
                <option value="stock_desc">Stock décroissant</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadAdminCsv('/products/export.csv', 'heritage-produits.csv').catch((error) => notify(error.message))}
              className="admin-secondary-button"
            >
              Exporter CSV
            </button>

            {selectedProductIds.length > 0 && (
              <div className="flex flex-wrap gap-2 border-l border-[#002141]/15 pl-3">
                <button type="button" onClick={() => void runBulkProductAction('publish')} className="admin-secondary-button">
                  Publier ({selectedProductIds.length})
                </button>
                <button type="button" onClick={() => void runBulkProductAction('unpublish')} className="admin-secondary-button">
                  Dépublier
                </button>
                <button type="button" onClick={() => void runBulkProductAction('archive')} className="admin-secondary-button">
                  Archiver
                </button>
                <button type="button" onClick={() => void runBulkProductAction('delete')} className="admin-secondary-button text-red-800">
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Liste des Produits */}
        {products.length === 0 ? (
          <EmptyState title="Le catalogue Supabase est vide" body="Créez votre premier produit pour alimenter la boutique." />
        ) : (
          <div className="overflow-x-auto border border-[#002141]/15 bg-white">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-[#002141] text-[#FAF9F7]">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={visibleProducts.length > 0 && visibleProducts.every((product) => selectedProductIds.includes(product.id))}
                      onChange={(event) => setSelectedProductIds(event.target.checked ? visibleProducts.map((product) => product.id) : [])}
                      aria-label="Sélectionner tous les produits affichés"
                      className="accent-[#AC854B]"
                    />
                  </th>
                  <th className="p-4">Produit</th>
                  <th className="p-4">Catégorie</th>
                  <th className="p-4">Prix de vente</th>
                  <th className="p-4">Marge brute</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#002141]/10">
                {visibleProducts.map((product) => {
                  const currentPrice = Number(product.sale_price_xof ?? product.regular_price_xof ?? 0);
                  const isSale = product.sale_price_xof && Number(product.sale_price_xof) > 0 && Number(product.sale_price_xof) < Number(product.regular_price_xof);
                  const purchase = Number(product.purchase_price_xof || 0);
                  const margin = currentPrice - purchase;
                  const marginRate = currentPrice > 0 ? Math.round((margin / currentPrice) * 100) : 0;

                  const stockQty = Number(product.stock_quantity ?? 0);
                  const lowThresh = Number(product.low_stock_threshold ?? 2);
                  const isLow = stockQty > 0 && stockQty <= lowThresh;
                  const isOut = stockQty <= 0 && product.stock_policy !== 'on_order';

                  const primaryAsset = Array.isArray(product.media_assets)
                    ? product.media_assets.find((a: AnyRecord) => a.id === product.primary_media_id) || product.media_assets[0]
                    : null;

                  return (
                    <tr key={product.id} className="hover:bg-[#FAF9F7] transition">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={(event) =>
                            setSelectedProductIds((current) =>
                              event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id)
                            )
                          }
                          aria-label={`Sélectionner ${product.name}`}
                          className="accent-[#AC854B]"
                        />
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {primaryAsset?.public_url ? (
                            <img src={primaryAsset.public_url} alt="" className="h-11 w-11 object-cover border shrink-0" />
                          ) : (
                            <div className="h-11 w-11 bg-[#002141]/5 flex items-center justify-center text-[10px] font-bold text-[#002141] shrink-0 border">
                              SANS IMG
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-[#002141]">{product.name}</p>
                            <p className="text-xs text-[#3A3A3A]">
                              {product.brand ? `${product.brand} · ` : ''}
                              Réf: {product.reference || product.sku || product.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="capitalize text-xs font-semibold px-2 py-0.5 border border-[#002141]/15 bg-[#002141]/5 text-[#002141]">
                          {product.category}
                        </span>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-[#002141]">{formatXOF(currentPrice)}</p>
                        {isSale && (
                          <p className="text-xs text-[#3A3A3A] line-through">
                            {formatXOF(product.regular_price_xof)}
                          </p>
                        )}
                      </td>

                      <td className="p-4">
                        {purchase > 0 ? (
                          <p className={`font-medium ${margin >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                            {formatXOF(margin)} <span className="text-xs">({marginRate}%)</span>
                          </p>
                        ) : (
                          <span className="text-xs text-[#3A3A3A]">P.A. non saisi</span>
                        )}
                      </td>

                      <td className="p-4">
                        {product.stock_policy === 'on_order' ? (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            Sur commande
                          </span>
                        ) : isOut ? (
                          <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                            Rupture (0)
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Limité ({stockQty})
                          </span>
                        ) : (
                          <span className="font-semibold text-[#002141]">{stockQty}</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                            product.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : product.status === 'archived'
                              ? 'bg-gray-100 text-gray-700 border border-gray-300'
                              : 'bg-amber-50 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {product.status === 'published' ? 'Publié' : product.status === 'archived' ? 'Archivé' : 'Brouillon'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setProductForm(toProductForm(product));
                            }}
                            className="admin-icon-button"
                            aria-label="Modifier"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteProduct(product)}
                            className="admin-icon-button text-red-800"
                            aria-label="Supprimer"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {visibleProducts.length === 0 && (
              <p className="p-6 text-sm text-[#3A3A3A] text-center">Aucun produit ne correspond à votre recherche ou à vos filtres.</p>
            )}
          </div>
        )}

        {lowStockProducts.length > 0 && (
          <p className="mt-4 text-sm font-semibold text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {lowStockProducts.length} produit(s) ont atteint ou dépassé leur seuil d'alerte de stock.
          </p>
        )}
      </>
    );
  };

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

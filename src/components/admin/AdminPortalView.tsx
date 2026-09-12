import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Boxes,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  Eye,
  FileCheck,
  FileText,
  FolderOpen,
  GalleryVerticalEnd,
  HardDrive,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Upload,
  UploadCloud,
  User,
  UserCheck,
  UsersRound,
  UserX,
  ExternalLink,
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

const CONTACT_MESSAGE_STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau',
  read: 'Lu',
  processed: 'Traité'
};

const contactMessageExcerpt = (message: unknown, maxLength = 160) => {
  const normalized = String(message || '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}…` : normalized;
};

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
    // Existing legacy categories are moved to the closest supported catalogue
    // entry when the record is next saved.
    category: isStandardCat ? cat : 'montres',
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
  pending_payment: 'Commande reçue (Attente règlement)',
  payment_pending: 'Paiement transmis (À valider)',
  paid: 'Payée (Validée)',
  processing: 'En préparation',
  shipped_or_ready: 'Expédiée / Prête pour retrait',
  delivered: 'Livrée / Remise au client',
  cancelled: 'Annulée',
  refunded: 'Annulée / Remboursée',
  payment_failed: 'Paiement non abouti'
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'delivered':
      return 'bg-green-100 text-green-900 border-green-400';
    case 'processing':
      return 'bg-blue-100 text-blue-900 border-blue-300';
    case 'shipped_or_ready':
      return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    case 'payment_pending':
      return 'bg-yellow-100 text-yellow-900 border-yellow-300';
    case 'pending_payment':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'refunded':
      return 'bg-purple-100 text-purple-900 border-purple-300';
    case 'payment_failed':
      return 'bg-rose-100 text-rose-800 border-rose-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
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
      { name: 'page_key', label: 'Page', type: 'select', required: true, options: [{ value: 'accueil', label: 'Accueil' }, { value: 'montres', label: 'Montres' }, { value: 'parfums', label: 'Parfums' }, { value: 'lunettes', label: 'Lunettes' }, { value: 'a-propos', label: 'À propos' }, { value: 'contact', label: 'Contact' }, { value: 'faq', label: 'Foire aux questions' }, { value: 'blog', label: 'Journal / Blog' }, { value: 'authenticite-provenance', label: 'Authenticité / provenance' }, { value: 'livraison-retours', label: 'Livraison / retours' }, { value: 'garantie-service', label: 'Garantie / service' }, { value: 'mentions-legales', label: 'Mentions légales' }, { value: 'cgv', label: 'CGV' }, { value: 'confidentialite', label: 'Confidentialité' }, { value: 'cookies', label: 'Cookies' }] },
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
  const [contactMessageSearch, setContactMessageSearch] = useState('');
  const [contactMessageStatusFilter, setContactMessageStatusFilter] = useState('');
  const [contactMessageSort, setContactMessageSort] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [selectedContactMessage, setSelectedContactMessage] = useState<AnyRecord | null>(null);
  const [contactMessageDetailLoading, setContactMessageDetailLoading] = useState(false);
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
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userOrderFilter, setUserOrderFilter] = useState('');
  const [userSort, setUserSort] = useState<'date_desc' | 'date_asc' | 'spent_desc' | 'orders_desc' | 'name_asc'>('date_desc');
  const [selectedUserModal, setSelectedUserModal] = useState<AnyRecord | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderDateFromFilter, setOrderDateFromFilter] = useState('');
  const [orderDateToFilter, setOrderDateToFilter] = useState('');
  const [orderAmountMinFilter, setOrderAmountMinFilter] = useState('');
  const [orderAmountMaxFilter, setOrderAmountMaxFilter] = useState('');
  const [orderSort, setOrderSort] = useState<'date_desc' | 'date_asc' | 'total_desc' | 'total_asc' | 'customer_asc' | 'status'>('date_desc');
  const [selectedOrder, setSelectedOrder] = useState<AnyRecord | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [showOrderPrintModal, setShowOrderPrintModal] = useState(false);
  const [orderDeliveryRefForm, setOrderDeliveryRefForm] = useState('');
  const [orderDeliveryProofForm, setOrderDeliveryProofForm] = useState('');
  const [statusChangeTargetStatus, setStatusChangeTargetStatus] = useState('');
  const [statusChangeNote, setStatusChangeNote] = useState('');
  const [statusChangeError, setStatusChangeError] = useState('');
  const [savingOrderStatus, setSavingOrderStatus] = useState(false);

  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaFolderFilter, setMediaFolderFilter] = useState('');
  const [mediaUsageFilter, setMediaUsageFilter] = useState('');
  const [mediaSort, setMediaSort] = useState<'date_desc' | 'date_asc' | 'size_desc' | 'name_asc'>('date_desc');
  const [selectedMediaModal, setSelectedMediaModal] = useState<AnyRecord | null>(null);
  const [mediaDragActive, setMediaDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [batchUploadFolder, setBatchUploadFolder] = useState<string>('produit');
  const [batchUploadAltText, setBatchUploadAltText] = useState('');
  const [batchUploadTags, setBatchUploadTags] = useState('');
  const [deleteWarningMedia, setDeleteWarningMedia] = useState<AnyRecord | null>(null);

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
        setProducts(Array.isArray(catalog) ? catalog : []);
        setMedia(Array.isArray(gallery) ? gallery : []);
        setResources((current) => ({ ...current, reviews: Array.isArray(reviews) ? reviews : [] }));
      }
      if (tab === 'orders') {
        const res = await adminRequest<AnyRecord[]>('/orders');
        setOrders(Array.isArray(res) ? res : []);
      }
      if (tab === 'administrators') {
        const response = await adminRequest<{ administrators: AnyRecord[]; invitations: AnyRecord[]; auditLogs: AnyRecord[] }>('/administrators');
        setAdministrators(Array.isArray(response?.administrators) ? response.administrators : []);
        setInvitations(Array.isArray(response?.invitations) ? response.invitations : []);
        setAuditLogs(Array.isArray(response?.auditLogs) ? response.auditLogs : []);
      }
      if (tab === 'users') {
        const res = await adminRequest<AnyRecord[]>('/users');
        setUsers(Array.isArray(res) ? res : []);
      }
      if (tab === 'media') {
        const res = await adminRequest<AnyRecord[]>('/media');
        setMedia(Array.isArray(res) ? res : []);
      }
      if (tab === 'messages') {
        const res = await adminRequest<AnyRecord[]>('/contact-messages');
        setContactMessages(Array.isArray(res) ? res : []);
      }
      if (tab === 'coordinates') setSiteSettings(await adminRequest('/site-settings'));
      if (['reviews', 'blogs', 'faqs', 'legal', 'meta', 'pixels'].includes(tab)) {
        const records = await adminRequest<AnyRecord[]>(`/resources/${tab}`);
        setResources((current) => ({ ...current, [tab]: Array.isArray(records) ? records : [] }));
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
      const matchesCategory = !productCategoryFilter || product.category === productCategoryFilter;
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

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const query = orderSearch.trim().toLocaleLowerCase('fr-FR');
      const matchesSearch =
        !query ||
        [
          order.order_number,
          order.id,
          order.customer_name,
          order.customer_email,
          order.customer_phone,
          order.payment_reference,
          order.delivery_reference,
          order.shipping_address,
          order.delivery_address
        ].some((value) => String(value || '').toLocaleLowerCase('fr-FR').includes(query)) ||
        (Array.isArray(order.order_items) &&
          order.order_items.some((item: AnyRecord) =>
            String(item.product_name || item.name || '').toLocaleLowerCase('fr-FR').includes(query)
          ));

      const matchesStatus = !orderStatusFilter || order.status === orderStatusFilter;

      const orderTime = order.created_at ? new Date(order.created_at).getTime() : 0;
      const fromTime = orderDateFromFilter ? new Date(orderDateFromFilter).getTime() : 0;
      const toTime = orderDateToFilter ? new Date(`${orderDateToFilter}T23:59:59`).getTime() : Infinity;
      const matchesDate = orderTime >= fromTime && orderTime <= toTime;
      const minAmount = orderAmountMinFilter === '' ? 0 : Number(orderAmountMinFilter);
      const maxAmount = orderAmountMaxFilter === '' ? Infinity : Number(orderAmountMaxFilter);
      const amount = Number(order.total_xof || 0);
      const matchesAmount = amount >= (Number.isFinite(minAmount) ? minAmount : 0) && amount <= (Number.isFinite(maxAmount) ? maxAmount : Infinity);

      return matchesSearch && matchesStatus && matchesDate && matchesAmount;
    });

    return filtered.sort((a, b) => {
      if (orderSort === 'date_asc') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      if (orderSort === 'total_desc') return Number(b.total_xof || 0) - Number(a.total_xof || 0);
      if (orderSort === 'total_asc') return Number(a.total_xof || 0) - Number(b.total_xof || 0);
      if (orderSort === 'customer_asc') return String(a.customer_name || '').localeCompare(String(b.customer_name || ''));
      if (orderSort === 'status') return String(a.status || '').localeCompare(String(b.status || ''));
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [orders, orderSearch, orderStatusFilter, orderDateFromFilter, orderDateToFilter, orderAmountMinFilter, orderAmountMaxFilter, orderSort]);
  const visibleUsers = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    const filtered = safeUsers.filter((user) => {
      const query = userSearch.trim().toLocaleLowerCase('fr-FR');
      const matchesSearch =
        !query ||
        [user.full_name, user.email, user.phone, user.commune, user.delivery_address, user.shipping_address].some((value) =>
          String(value || '').toLocaleLowerCase('fr-FR').includes(query)
        );

      const matchesStatus =
        !userStatusFilter ||
        (userStatusFilter === 'active' && user.is_active !== false) ||
        (userStatusFilter === 'blocked' && user.is_active === false);

      const orderCount = Number(user.order_count || 0);
      const matchesOrderFilter =
        !userOrderFilter ||
        (userOrderFilter === 'with_orders' && orderCount > 0) ||
        (userOrderFilter === 'no_orders' && orderCount === 0);

      return matchesSearch && matchesStatus && matchesOrderFilter;
    });

    return filtered.sort((a, b) => {
      if (userSort === 'date_asc') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      if (userSort === 'spent_desc') return Number(b.total_spent_xof || 0) - Number(a.total_spent_xof || 0);
      if (userSort === 'orders_desc') return Number(b.order_count || 0) - Number(a.order_count || 0);
      if (userSort === 'name_asc') return String(a.full_name || '').localeCompare(String(b.full_name || ''));
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [users, userSearch, userStatusFilter, userOrderFilter, userSort]);

  const visibleMedia = useMemo(() => {
    const safeMedia = Array.isArray(media) ? media : [];
    const filtered = safeMedia.filter((asset) => {
      const query = mediaSearch.trim().toLowerCase();
      const tagsStr = Array.isArray(asset.tags) ? asset.tags.join(' ') : String(asset.tags || '');
      const matchesSearch =
        !query ||
        [asset.file_name, asset.alt_text, asset.folder, tagsStr]
          .some((v) => String(v || '').toLowerCase().includes(query));

      const matchesFolder = !mediaFolderFilter || (asset.folder || 'general') === mediaFolderFilter;

      const hasUsage = Array.isArray(asset.usage) && asset.usage.length > 0;
      const matchesUsage =
        !mediaUsageFilter ||
        (mediaUsageFilter === 'used' && hasUsage) ||
        (mediaUsageFilter === 'unused' && !hasUsage);

      return matchesSearch && matchesFolder && matchesUsage;
    });

    return filtered.sort((a, b) => {
      if (mediaSort === 'date_asc') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      if (mediaSort === 'size_desc') return Number(b.size_bytes || 0) - Number(a.size_bytes || 0);
      if (mediaSort === 'name_asc') return String(a.file_name || '').localeCompare(String(b.file_name || ''));
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [media, mediaSearch, mediaFolderFilter, mediaUsageFilter, mediaSort]);

  const logout = async () => {
    await signOutAdministrator();
    navigate('/admin/login');
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const finalCategory = productForm.category;
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
        slug: finalSlug,
        variants: readArray(productForm.variants)
      };

      if (editingProduct?.id) await adminRequest(`/products/${editingProduct.id}`, { method: 'PATCH', body: finalPayload });
      else await adminRequest('/products', { method: 'POST', body: finalPayload });

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
                  </select>
                </label>

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
                                onChange={(e) => {
                                  const newAlt = e.target.value;
                                  setMedia((current) => current.map((m) => (m.id === asset.id ? { ...m, alt_text: newAlt } : m)));
                                }}
                                onBlur={async (e) => {
                                  const newAlt = e.target.value.trim();
                                  if (!newAlt) {
                                    notify('Le texte alternatif de chaque image est obligatoire.');
                                    return;
                                  }
                                  try {
                                    await adminRequest(`/media/${asset.id}`, { method: 'PATCH', body: { alt_text: newAlt } });
                                  } catch (error) {
                                    notify(error instanceof Error ? error.message : 'Le texte alternatif n’a pas été enregistré.');
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
                      <div key={rev.id} className="border border-[#002141]/10 p-3 bg-[#FAF9F7] text-xs flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-semibold text-[#002141]">
                            {rev.author_name} — {'★'.repeat(rev.rating)} ({rev.status})
                          </p>
                          <p className="text-[#3A3A3A] mt-1">{rev.body}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rev.status !== 'approved' && (
                            <button type="button" onClick={() => void moderateProductReview(rev, 'approved')} className="admin-secondary-button text-[11px] whitespace-nowrap">
                              Approuver
                            </button>
                          )}
                          {rev.status !== 'pending' && (
                            <button type="button" onClick={() => void moderateProductReview(rev, 'pending')} className="admin-secondary-button text-[11px] whitespace-nowrap">
                              Mettre en attente
                            </button>
                          )}
                          {rev.status !== 'rejected' && (
                            <button type="button" onClick={() => void moderateProductReview(rev, 'rejected')} className="admin-secondary-button text-[11px] whitespace-nowrap text-red-800">
                              Refuser
                            </button>
                          )}
                        </div>
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

  const updateOrderStatusFull = async (
    order: AnyRecord,
    targetStatus: string,
    deliveryRef: string,
    deliveryProofUrl: string,
    noteText: string
  ) => {
    setStatusChangeError('');
    if (targetStatus === 'delivered' && !deliveryRef.trim() && !deliveryProofUrl.trim()) {
      const msg = "Une référence ou une preuve de remise (ex: N° de bordereau coursier, code secret, remise en main propre) est obligatoirement requise pour passer au statut 'Livrée'.";
      setStatusChangeError(msg);
      return;
    }

    setSavingOrderStatus(true);
    try {
      const updated = await adminRequest<AnyRecord>(`/orders/${order.id}`, {
        method: 'PATCH',
        body: {
          status: targetStatus,
          delivery_reference: deliveryRef.trim() || null,
          delivery_proof_url: deliveryProofUrl.trim() || null,
          note: noteText.trim() || null
        }
      });

      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
      const detailedOrder = await adminRequest<AnyRecord>(`/orders/${order.id}`);
      if (selectedOrder?.id === order.id) setSelectedOrder(detailedOrder);
      setOrderDeliveryRefForm(detailedOrder.delivery_reference || '');
      setOrderDeliveryProofForm(detailedOrder.delivery_proof_url || '');
      setStatusChangeTargetStatus(detailedOrder.status || targetStatus);
      notify(`Commande ${updated.order_number || updated.id.slice(0, 8)} mise à jour : ${statusLabel[targetStatus] || targetStatus}.`);
      setStatusChangeNote('');
      setStatusChangeError('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'La mise à jour du statut a échoué.';
      setStatusChangeError(msg);
    } finally {
      setSavingOrderStatus(false);
    }
  };

  const openOrderDetail = async (order: AnyRecord, print = false) => {
    setSelectedOrder(order);
    setShowOrderPrintModal(print);
    setOrderDeliveryRefForm(order.delivery_reference || '');
    setOrderDeliveryProofForm(order.delivery_proof_url || '');
    setStatusChangeTargetStatus(order.status || 'pending_payment');
    setStatusChangeNote('');
    setStatusChangeError('');
    setOrderDetailLoading(true);
    try {
      const detailedOrder = await adminRequest<AnyRecord>(`/orders/${order.id}`);
      setSelectedOrder(detailedOrder);
      setOrderDeliveryRefForm(detailedOrder.delivery_reference || '');
      setOrderDeliveryProofForm(detailedOrder.delivery_proof_url || '');
      setStatusChangeTargetStatus(detailedOrder.status || 'pending_payment');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Le détail de la commande ne peut pas être chargé.');
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const renderOrders = () => {
    const totalOrdersCount = orders.length;
    const pendingOrdersCount = orders.filter((o) => ['pending_payment', 'payment_pending'].includes(o.status)).length;
    const processingOrdersCount = orders.filter((o) => ['paid', 'processing', 'shipped_or_ready'].includes(o.status)).length;
    const deliveredOrdersCount = orders.filter((o) => o.status === 'delivered').length;
    const totalRevenueXOF = orders
      .filter((o) => ['paid', 'processing', 'shipped_or_ready', 'delivered'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.total_xof || 0), 0);
    const selectedOrderTimeline = selectedOrder
      ? (Array.isArray(selectedOrder.status_events) && selectedOrder.status_events.length > 0
        ? selectedOrder.status_events
        : (Array.isArray(selectedOrder.status_history) ? selectedOrder.status_history.slice().reverse() : []))
      : [];

    return (
      <>
        <PanelHeader
          eyebrow="Gestion commerciale"
          title="Commandes & Récapitulatifs"
          description="Consultez, filtrez et gérez les commandes Supabase. Mettez à jour les statuts avec journalisation complète de l'historique et référence obligatoire avant remise."
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void downloadAdminCsv('/orders/export.csv', 'heritage-commandes.csv').catch((error) => notify(error.message))}
                className="admin-secondary-button flex items-center gap-2"
              >
                <Upload className="h-4 w-4 rotate-180" /> Exporter CSV
              </button>
            </div>
          }
        />

        {/* Quick KPI Stat Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="border border-[#002141]/12 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#3A3A3A]">Total Commandes</p>
            <p className="mt-2 font-playfair text-2xl font-bold text-[#002141]">{totalOrdersCount}</p>
          </div>
          <div className="border border-[#002141]/12 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#3A3A3A]">À valider / En attente</p>
            <p className="mt-2 font-playfair text-2xl font-bold text-amber-700">{pendingOrdersCount}</p>
          </div>
          <div className="border border-[#002141]/12 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#3A3A3A]">En préparation / Expédiées</p>
            <p className="mt-2 font-playfair text-2xl font-bold text-blue-800">{processingOrdersCount}</p>
          </div>
          <div className="border border-[#002141]/12 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#3A3A3A]">Livrées & Finalisées</p>
            <p className="mt-2 font-playfair text-2xl font-bold text-emerald-800">{deliveredOrdersCount}</p>
          </div>
          <div className="border border-[#002141]/12 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#3A3A3A]">Chiffre d'Affaires Validé</p>
            <p className="mt-2 font-playfair text-xl font-bold text-[#AC854B]">{formatXOF(totalRevenueXOF)}</p>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="mb-6 border border-[#002141]/12 bg-white p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#002141]">Rechercher</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#3A3A3A]/60" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="N° commande, client, téléphone, réf..."
                  className="admin-input pl-9 w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141]">Filtrer par Statut</label>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="admin-input mt-1 w-full"
              >
                <option value="">Tous les statuts ({orders.length})</option>
                {Object.entries(statusLabel).map(([value, label]) => {
                  const count = orders.filter((o) => o.status === value).length;
                  return (
                    <option key={value} value={value}>
                      {label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141]">Date de début</label>
              <input
                type="date"
                value={orderDateFromFilter}
                onChange={(e) => setOrderDateFromFilter(e.target.value)}
                className="admin-input mt-1 w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141]">Date de fin</label>
              <input
                type="date"
                value={orderDateToFilter}
                onChange={(e) => setOrderDateToFilter(e.target.value)}
                className="admin-input mt-1 w-full"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:max-w-[50%]">
            <div>
              <label className="block text-xs font-semibold text-[#002141]">Montant minimum (FCFA)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={orderAmountMinFilter}
                onChange={(e) => setOrderAmountMinFilter(e.target.value)}
                placeholder="Ex. 100 000"
                className="admin-input mt-1 w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#002141]">Montant maximum (FCFA)</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={orderAmountMaxFilter}
                onChange={(e) => setOrderAmountMaxFilter(e.target.value)}
                placeholder="Ex. 500 000"
                className="admin-input mt-1 w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#002141]/10 pt-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-[#002141] flex items-center gap-2">
                <span>Trier par :</span>
                <select
                  value={orderSort}
                  onChange={(e) => setOrderSort(e.target.value as any)}
                  className="admin-input py-1 text-xs"
                >
                  <option value="date_desc">Date (Récente → Ancienne)</option>
                  <option value="date_asc">Date (Ancienne → Récente)</option>
                  <option value="total_desc">Montant (Décroissant)</option>
                  <option value="total_asc">Montant (Croissant)</option>
                  <option value="customer_asc">Client (A-Z)</option>
                  <option value="status">Statut</option>
                </select>
              </label>
            </div>

            {(orderSearch || orderStatusFilter || orderDateFromFilter || orderDateToFilter || orderAmountMinFilter || orderAmountMaxFilter) && (
              <button
                type="button"
                onClick={() => {
                  setOrderSearch('');
                  setOrderStatusFilter('');
                  setOrderDateFromFilter('');
                  setOrderDateToFilter('');
                  setOrderAmountMinFilter('');
                  setOrderAmountMaxFilter('');
                }}
                className="text-xs text-[#AC854B] hover:underline flex items-center gap-1 font-medium"
              >
                <X className="h-3.5 w-3.5" /> Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>

        {/* Orders List Table */}
        {orders.length === 0 ? (
          <EmptyState
            title="Aucune commande enregistrée"
            body="Les commandes confirmées depuis le passage en caisse apparaîtront ici dès leur enregistrement dans Supabase."
          />
        ) : visibleOrders.length === 0 ? (
          <EmptyState title="Aucune commande trouvée" body="Aucune commande ne correspond aux critères de filtre sélectionnés." />
        ) : (
          <div className="overflow-hidden border border-[#002141]/15 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#002141]/12 bg-[#F8F9FA] text-xs uppercase tracking-wider text-[#002141]">
                    <th className="py-3.5 px-4 font-semibold">N° & Date</th>
                    <th className="py-3.5 px-4 font-semibold">Client</th>
                    <th className="py-3.5 px-4 font-semibold">Reglement</th>
                    <th className="py-3.5 px-4 font-semibold">Montant Total</th>
                    <th className="py-3.5 px-4 font-semibold">Statut</th>
                    <th className="py-3.5 px-4 font-semibold">Preuve / Ref Livraison</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#002141]/10">
                  {visibleOrders.map((order) => {
                    const statusBadgeClass = getStatusBadgeClass(order.status);
                    const itemsCount = Array.isArray(order.order_items) ? order.order_items.length : 0;
                    return (
                      <tr key={order.id} className="hover:bg-[#FDFBF7] transition-colors">
                        <td className="py-4 px-4 align-top">
                          <p className="font-mono font-bold text-[#002141]">{order.order_number || order.id.slice(0, 8)}</p>
                          <p className="mt-1 text-xs text-[#3A3A3A] flex items-center gap-1">
                            <Clock className="h-3 w-3 text-[#3A3A3A]/60" />
                            {order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : '—'}
                          </p>
                          <p className="mt-1 text-[11px] text-[#AC854B] font-medium">
                            {itemsCount} article{itemsCount > 1 ? 's' : ''}
                          </p>
                        </td>

                        <td className="py-4 px-4 align-top">
                          <p className="font-semibold text-[#002141]">{order.customer_name || 'Client Anonyme'}</p>
                          <p className="text-xs text-[#3A3A3A]">{order.customer_email || 'Sans e-mail'}</p>
                          {order.customer_phone && <p className="text-xs text-[#3A3A3A]">{order.customer_phone}</p>}
                          {(order.shipping_address || order.delivery_address) && (
                            <p className="mt-1 text-[11px] text-[#3A3A3A]/70 flex items-center gap-1 truncate max-w-xs">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {order.shipping_address || order.delivery_address}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top">
                          <p className="text-xs font-semibold text-[#002141] flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5 text-[#AC854B]" />
                            {order.payment_method || 'Mobile Money / Cash'}
                          </p>
                          {order.payment_reference && (
                            <p className="mt-1 text-xs font-mono text-[#3A3A3A]">Réf: {order.payment_reference}</p>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top">
                          <p className="font-playfair font-bold text-[#002141] text-base">{formatXOF(order.total_xof)}</p>
                        </td>

                        <td className="py-4 px-4 align-top">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border ${statusBadgeClass}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {statusLabel[order.status] || order.status}
                          </span>
                        </td>

                        <td className="py-4 px-4 align-top">
                          {order.delivery_reference ? (
                            <p className="text-xs font-mono font-medium text-[#002141] flex items-center gap-1">
                              <FileCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                              {order.delivery_reference}
                            </p>
                          ) : order.delivery_proof_url ? (
                            <a
                              href={order.delivery_proof_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[#AC854B] hover:underline flex items-center gap-1"
                            >
                              <FileCheck className="h-3.5 w-3.5 shrink-0" /> Preuve de livraison
                            </a>
                          ) : (
                            <span className="text-xs italic text-gray-400">Non renseignée</span>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void openOrderDetail(order)}
                              className="admin-secondary-button py-1 px-3 text-xs flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" /> Détails & Statut
                            </button>
                            <button
                              type="button"
                              onClick={() => void openOrderDetail(order, true)}
                              className="admin-icon-button p-1.5"
                              title="Imprimer le récapitulatif"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDER DETAIL & STATUS CHANGE DRAWER / MODAL */}
        {selectedOrder && !showOrderPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#002141]/60 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="relative my-8 w-full max-w-4xl border border-[#002141]/20 bg-white p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-[#002141]/12 pb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-playfair text-2xl font-bold text-[#002141]">
                      Commande #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}
                    </h2>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold border ${getStatusBadgeClass(selectedOrder.status)}`}>
                      {statusLabel[selectedOrder.status] || selectedOrder.status}
                    </span>
                    {orderDetailLoading && <LoaderCircle className="h-4 w-4 animate-spin text-[#AC854B]" aria-label="Chargement du détail" />}
                  </div>
                  <p className="mt-1 text-xs text-[#3A3A3A]">
                    Passée le {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('fr-FR') : '—'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOrderPrintModal(true)}
                    className="admin-secondary-button text-xs flex items-center gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimer récapitulatif
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 text-[#3A3A3A] hover:text-[#002141]"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Grid Layout for Details */}
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {/* Client Information */}
                <div className="border border-[#002141]/10 p-4 bg-[#F8F9FA]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#002141] flex items-center gap-1.5 mb-3">
                    <User className="h-4 w-4 text-[#AC854B]" /> Informations Client
                  </h3>
                  <div className="space-y-1.5 text-sm text-[#3A3A3A]">
                    <p><strong className="text-[#002141]">Nom :</strong> {selectedOrder.customer_name || 'Non renseigné'}</p>
                    <p><strong className="text-[#002141]">E-mail :</strong> {selectedOrder.customer_email || 'Non renseigné'}</p>
                    <p><strong className="text-[#002141]">Téléphone :</strong> {selectedOrder.customer_phone || 'Non renseigné'}</p>
                    <p><strong className="text-[#002141]">Commune / Zone :</strong> {selectedOrder.customer_commune || selectedOrder.commune || selectedOrder.city || 'Abidjan'}</p>
                    {selectedOrder.customer_notes && <p><strong className="text-[#002141]">Note client :</strong> {selectedOrder.customer_notes}</p>}
                  </div>
                </div>

                {/* Delivery Information */}
                <div className="border border-[#002141]/10 p-4 bg-[#F8F9FA]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#002141] flex items-center gap-1.5 mb-3">
                    <Truck className="h-4 w-4 text-[#AC854B]" /> Livraison & Remise
                  </h3>
                  <div className="space-y-1.5 text-sm text-[#3A3A3A]">
                    <p>
                      <strong className="text-[#002141]">Adresse de livraison :</strong>{' '}
                      {selectedOrder.customer_delivery_address || selectedOrder.shipping_address || selectedOrder.delivery_address || 'À convenir'}
                    </p>
                    <p>
                      <strong className="text-[#002141]">Mode de réception :</strong>{' '}
                      {selectedOrder.delivery_mode === 'retrait_yopougon' ? 'Retrait à Yopougon' : 'Livraison à Abidjan'}
                    </p>
                    <p>
                      <strong className="text-[#002141]">Référence coursier / remise :</strong>{' '}
                      {selectedOrder.delivery_reference ? (
                        <span className="font-mono font-semibold text-emerald-800">{selectedOrder.delivery_reference}</span>
                      ) : (
                        <span className="italic text-gray-400">Non renseignée</span>
                      )}
                    </p>
                    {selectedOrder.delivery_proof_url && (
                      <p>
                        <strong className="text-[#002141]">Preuve de remise :</strong>{' '}
                        <a href={selectedOrder.delivery_proof_url} target="_blank" rel="noreferrer" className="text-[#AC854B] underline">
                          Voir la preuve d'émargement
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment & Financial Summary */}
              <div className="mt-6 border border-[#002141]/10 p-4 bg-[#F8F9FA]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#002141] flex items-center gap-1.5 mb-3">
                  <CreditCard className="h-4 w-4 text-[#AC854B]" /> Paiement & Règlement
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-sm text-[#3A3A3A]">
                  <div>
                    <span className="block text-xs text-[#3A3A3A]/70">Mode de paiement</span>
                    <strong className="text-[#002141]">{selectedOrder.payment_method || 'Mobile Money / Wave / Cash'}</strong>
                  </div>
                  <div>
                    <span className="block text-xs text-[#3A3A3A]/70">Référence transaction</span>
                    <strong className="font-mono text-[#002141]">{selectedOrder.payment_reference || 'Non spécifiée'}</strong>
                  </div>
                  <div>
                    <span className="block text-xs text-[#3A3A3A]/70">Sous-total articles</span>
                    <strong className="text-[#002141]">{formatXOF(selectedOrder.subtotal_xof)}</strong>
                  </div>
                  <div>
                    <span className="block text-xs text-[#3A3A3A]/70">Livraison</span>
                    <strong className="text-[#002141]">{formatXOF(selectedOrder.delivery_cost_xof)}</strong>
                  </div>
                  <div>
                    <span className="block text-xs text-[#3A3A3A]/70">Montant total</span>
                    <strong className="font-playfair text-lg text-[#002141]">{formatXOF(selectedOrder.total_xof)}</strong>
                  </div>
                </div>
              </div>

              {/* Items Snapshot Table */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-[#002141] mb-3">Articles commandés (Snapshot au moment de l'achat)</h3>
                <div className="overflow-x-auto border border-[#002141]/12">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#002141]/10 bg-[#F8F9FA] text-xs font-semibold text-[#002141]">
                        <th className="p-3">Produit</th>
                        <th className="p-3">Référence / SKU</th>
                        <th className="p-3 text-right">Prix unitaire</th>
                        <th className="p-3 text-center">Quantité</th>
                        <th className="p-3 text-right">Sous-total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#002141]/10">
                      {Array.isArray(selectedOrder.order_items) && selectedOrder.order_items.length > 0 ? (
                        selectedOrder.order_items.map((item: AnyRecord, idx: number) => (
                          <tr key={item.id || idx}>
                            <td className="p-3">
                              <p className="font-semibold text-[#002141]">{item.product_name || item.name || 'Article'}</p>
                              {item.variant_label && <p className="text-xs text-[#AC854B]">{item.variant_label}</p>}
                            </td>
                            <td className="p-3 font-mono text-xs text-[#3A3A3A]">{item.product_ref || item.product_reference || item.product_sku || item.sku || '—'}</td>
                            <td className="p-3 text-right text-[#3A3A3A]">{formatXOF(item.unit_price_xof || item.price || 0)}</td>
                            <td className="p-3 text-center font-bold text-[#002141]">{item.quantity || 1}</td>
                            <td className="p-3 text-right font-semibold text-[#002141]">
                              {formatXOF((item.unit_price_xof || item.price || 0) * (item.quantity || 1))}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-xs text-[#3A3A3A]">
                            Aucun détail d'article disponible pour cette commande.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Manual Status Update Section */}
              <div className="mt-6 border-t border-[#002141]/15 pt-6">
                <h3 className="text-sm font-bold text-[#002141] flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[#AC854B]" /> Modifier le statut de la commande
                </h3>

                {statusChangeError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 text-xs text-red-800 font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{statusChangeError}</span>
                  </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#002141]">Sélectionner le nouveau statut</label>
                    <select
                      value={statusChangeTargetStatus}
                      onChange={(e) => {
                        setStatusChangeTargetStatus(e.target.value);
                        setStatusChangeError('');
                      }}
                      className="admin-input mt-1 w-full"
                    >
                      {Object.entries(statusLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#002141]">
                      Référence de remise / livraison{' '}
                      {statusChangeTargetStatus === 'delivered' && <span className="text-red-700 font-bold">* (Obligatoire)</span>}
                    </label>
                    <input
                      type="text"
                      value={orderDeliveryRefForm}
                      onChange={(e) => {
                        setOrderDeliveryRefForm(e.target.value);
                        setStatusChangeError('');
                      }}
                      placeholder="Ex: Bordereau #BL-9481 / Code coursier / Emargement"
                      className="admin-input mt-1 w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#002141]">
                      Lien de preuve de remise{' '}
                      {statusChangeTargetStatus === 'delivered' && <span className="text-[#3A3A3A]/70">(alternative à la référence)</span>}
                    </label>
                    <input
                      type="url"
                      value={orderDeliveryProofForm}
                      onChange={(e) => {
                        setOrderDeliveryProofForm(e.target.value);
                        setStatusChangeError('');
                      }}
                      placeholder="https://… (émargement, bon signé)"
                      className="admin-input mt-1 w-full"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#002141]">Note d'audit interne (Journalisée)</label>
                    <input
                      type="text"
                      value={statusChangeNote}
                      onChange={(e) => setStatusChangeNote(e.target.value)}
                      placeholder="Commentaire explicatif sur ce changement de statut (visible dans l'historique admin)..."
                      className="admin-input mt-1 w-full"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={savingOrderStatus || orderDetailLoading}
                    onClick={() =>
                      void updateOrderStatusFull(
                        selectedOrder,
                        statusChangeTargetStatus,
                        orderDeliveryRefForm,
                        orderDeliveryProofForm,
                        statusChangeNote
                      )
                    }
                    className="admin-primary-button disabled:opacity-50"
                  >
                    {savingOrderStatus ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Enregistrer le nouveau statut
                  </button>
                </div>
              </div>

              {/* Status Change History Audit Timeline */}
              <div className="mt-6 border-t border-[#002141]/12 pt-6">
                <h3 className="text-sm font-bold text-[#002141] mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#AC854B]" /> Historique des changements de statut (Journalisé)
                </h3>
                {selectedOrderTimeline.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOrderTimeline.map((entry: AnyRecord, index: number) => (
                        <div key={`${entry.id || entry.created_at || entry.timestamp}-${index}`} className="border-l-2 border-[#AC854B] pl-3 py-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-[#002141]">
                              {statusLabel[entry.status] || entry.status}
                            </span>
                            <span className="text-[#3A3A3A]/60">•</span>
                            <span className="text-[#3A3A3A]">
                              {entry.created_at || entry.timestamp ? new Date(entry.created_at || entry.timestamp).toLocaleString('fr-FR') : '—'}
                            </span>
                          </div>
                          {entry.note && <p className="mt-1 text-xs text-[#3A3A3A] italic">{entry.note}</p>}
                          {(entry.actor_name || entry.actor_id) && (
                            <p className="mt-1 text-[11px] text-[#3A3A3A]/70">Par : {entry.actor_name || entry.actor_id}</p>
                          )}
                        </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#3A3A3A] italic">Aucun changement enregistré pour l'instant.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRINTABLE ORDER SUMMARY MODAL */}
        {selectedOrder && showOrderPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#002141]/80 p-4 overflow-y-auto">
            <div className="relative my-6 w-full max-w-3xl border border-[#002141] bg-white p-8 shadow-2xl">
              {/* Action Buttons Header (Hidden during print) */}
              <div className="mb-6 flex items-center justify-between border-b pb-4 print:hidden">
                <h3 className="font-playfair text-xl font-bold text-[#002141]">Aperçu de l'Impression</h3>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="admin-primary-button text-xs flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" /> Lancer l'impression
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOrderPrintModal(false)}
                    className="admin-secondary-button text-xs"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              {/* PRINT VOUCHER CONTENT */}
              <div className="printable-order-voucher font-serif text-[#002141]">
                {/* Invoice Header */}
                <div className="flex items-start justify-between border-b-2 border-[#002141] pb-4">
                  <div>
                    <h1 className="font-playfair text-2xl font-bold tracking-widest text-[#002141]">HERITAGE ABIDJAN</h1>
                    <p className="text-xs uppercase tracking-wider text-[#AC854B]">Haute Horlogerie & Parfumerie d'Exception</p>
                    <p className="mt-1 text-xs text-gray-600">Abidjan, Côte d'Ivoire • Contact: +225 07 00 00 00 00</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-lg font-bold text-[#002141]">BON DE COMMANDE</h2>
                    <p className="font-mono text-sm font-bold">N° {selectedOrder.order_number || selectedOrder.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-600">
                      Date: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>
                </div>

                {/* Customer & Delivery Section */}
                <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
                  <div className="border border-gray-300 p-3">
                    <p className="font-bold uppercase tracking-wider text-[#002141] mb-2 border-b pb-1">Client</p>
                    <p className="font-semibold text-sm">{selectedOrder.customer_name || 'Client'}</p>
                    <p>E-mail: {selectedOrder.customer_email || '—'}</p>
                    <p>Téléphone: {selectedOrder.customer_phone || '—'}</p>
                    <p>Commune: {selectedOrder.customer_commune || selectedOrder.commune || '—'}</p>
                  </div>

                  <div className="border border-gray-300 p-3">
                    <p className="font-bold uppercase tracking-wider text-[#002141] mb-2 border-b pb-1">Livraison & Règlement</p>
                    <p><strong>Adresse:</strong> {selectedOrder.customer_delivery_address || selectedOrder.shipping_address || selectedOrder.delivery_address || 'À convenir'}</p>
                    <p><strong>Règlement:</strong> {selectedOrder.payment_method || 'Mobile Money / Cash'}</p>
                    <p><strong>Réf. paiement:</strong> {selectedOrder.payment_reference || '—'}</p>
                    <p><strong>Réf. Livraison:</strong> {selectedOrder.delivery_reference || 'En cours'}</p>
                  </div>
                </div>

                {/* Articles Table */}
                <div className="mt-6">
                  <table className="w-full text-left text-xs border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100 uppercase text-gray-800 border-b border-gray-300">
                        <th className="p-2 border-r border-gray-300">Article</th>
                        <th className="p-2 border-r border-gray-300 text-right">Prix Unitaire</th>
                        <th className="p-2 border-r border-gray-300 text-center">Qté</th>
                        <th className="p-2 text-right">Total XOF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(selectedOrder.order_items) && selectedOrder.order_items.length > 0 ? (
                        selectedOrder.order_items.map((item: AnyRecord, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="p-2 border-r border-gray-300 font-semibold">{item.product_name || item.name}</td>
                            <td className="p-2 border-r border-gray-300 text-right">{formatXOF(item.unit_price_xof || item.price || 0)}</td>
                            <td className="p-2 border-r border-gray-300 text-center font-bold">{item.quantity || 1}</td>
                            <td className="p-2 text-right font-bold">
                              {formatXOF((item.unit_price_xof || item.price || 0) * (item.quantity || 1))}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-3 text-center italic">
                            Détails des articles non spécifiés
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="mt-4 flex justify-end">
                  <div className="border border-[#002141] p-3 text-right min-w-[220px]">
                    <span className="text-xs text-gray-600 block">Articles : {formatXOF(selectedOrder.subtotal_xof)}</span>
                    <span className="text-xs text-gray-600 block">Livraison : {formatXOF(selectedOrder.delivery_cost_xof)}</span>
                    <span className="text-xs uppercase text-gray-600 block">Total de la Commande</span>
                    <strong className="font-playfair text-xl text-[#002141] font-bold">{formatXOF(selectedOrder.total_xof)}</strong>
                  </div>
                </div>

                {/* Signatures Footer */}
                <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs pt-8 border-t border-gray-300">
                  <div>
                    <p className="font-bold">Pour la Maison HERITAGE</p>
                    <div className="h-16 border-b border-dashed border-gray-400 mt-2" />
                    <p className="mt-1 text-gray-500">Cachet & Signature</p>
                  </div>
                  <div>
                    <p className="font-bold">Émargement / Client ou Coursier</p>
                    <div className="h-16 border-b border-dashed border-gray-400 mt-2" />
                    <p className="mt-1 text-gray-500">Nom & Signature de réception</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const getAuditActionBadge = (action: string, entityType: string) => {
    const map: Record<string, { label: string; style: string }> = {
      created: { label: 'Création', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      created_product: { label: 'Création Produit', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      updated: { label: 'Modification', style: 'bg-blue-50 text-blue-800 border-blue-200' },
      updated_product: { label: 'Modification Produit', style: 'bg-blue-50 text-blue-800 border-blue-200' },
      updated_status: { label: 'Statut Commande', style: 'bg-amber-50 text-amber-800 border-amber-200' },
      updated_order_status: { label: 'Statut Commande', style: 'bg-amber-50 text-amber-800 border-amber-200' },
      deleted: { label: 'Suppression', style: 'bg-red-50 text-red-800 border-red-200' },
      deleted_product: { label: 'Suppression Produit', style: 'bg-red-50 text-red-800 border-red-200' },
      revoked: { label: 'Révocation', style: 'bg-red-50 text-red-800 border-red-200' },
      revoked_admin: { label: 'Révocation Admin', style: 'bg-red-50 text-red-800 border-red-200' },
      reactivated_admin: { label: 'Réactivation Admin', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      generated: { label: 'Code Généré', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      generated_code: { label: 'Code Généré', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      revoked_code: { label: 'Code Révoqué', style: 'bg-red-50 text-red-800 border-red-200' },
      stock_movement: { label: 'Ajustement Stock', style: 'bg-purple-50 text-purple-800 border-purple-200' },
      toggled_user_status: { label: 'Compte Client', style: 'bg-slate-50 text-slate-800 border-slate-200' }
    };

    const found = map[action] || map[`${action}_${entityType}`];
    if (found) return found;

    const entityLabels: Record<string, string> = {
      product: 'Produit',
      order: 'Commande',
      administrator: 'Admin',
      admin_invitation: 'Code d’invitation',
      user: 'Client',
      customer: 'Client'
    };

    return {
      label: `${action} (${entityLabels[entityType] || entityType})`,
      style: 'bg-gray-50 text-gray-800 border-gray-200'
    };
  };

  const renderAdministrators = () => {
    const currentAdminId = admin?.profile?.id || admin?.id;

    return (
      <>
        <PanelHeader
          eyebrow="Accès & Sécurité"
          title="Gestion des Administrateurs"
          description="Consultez la liste des comptes autorisés, révoquez des accès en temps réel, gérez les codes d'invitation temporaires et suivez le journal d'activité."
          action={
            <button
              type="button"
              onClick={() => void generateInvitation()}
              className="admin-primary-button flex items-center gap-2"
            >
              <KeyRound className="h-4 w-4" /> Générer un code temporaire (1h)
            </button>
          }
        />

        {/* NOUVEAU CODE GÉNÉRÉ */}
        {generatedCode && (
          <div className="mb-6 border-2 border-[#AC854B] bg-[#FFFAF0] p-6 shadow-md rounded-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#002141]">
                  <KeyRound className="h-4 w-4 text-[#AC854B]" />
                  <span>Code d’invitation temporaire généré</span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                    Valide 1 Heure
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#3A3A3A]">
                  Ce code permet de créer un nouveau compte administrateur. Transmettez-le de façon sécurisée à votre collaborateur.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode);
                  notify('Code copié dans le presse-papiers !');
                }}
                className="admin-primary-button text-xs shrink-0 flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copier le code
              </button>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <code className="block flex-1 select-all rounded-sm bg-[#002141] px-5 py-3.5 text-xl font-bold tracking-[0.15em] text-[#D6BB8F] font-mono border border-[#002141]">
                {generatedCode}
              </code>
              <div className="text-xs text-[#002141]/80 font-medium bg-amber-50 border border-amber-200 px-4 py-3 rounded-sm">
                ⏱ Expiration : <strong>{new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong> (dans 60 min)
              </div>
            </div>
          </div>
        )}

        {/* GRILLE : COMPTES ADMINS & CODES DE TEMPO */}
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          {/* LISTE DES COMPTES ADMINISTRATEURS */}
          <section className="border border-[#002141]/15 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#002141]/10 p-5 bg-[#FAF9F7]">
              <div>
                <h2 className="font-playfair text-xl font-bold text-[#002141]">Comptes Administrateurs</h2>
                <p className="text-xs text-[#3A3A3A] mt-0.5">Accès actuels à la console de gestion</p>
              </div>
              <span className="rounded-full bg-[#002141]/10 px-3 py-1 text-xs font-bold text-[#002141]">
                {administrators.length} compte(s)
              </span>
            </div>

            <div className="divide-y divide-[#002141]/10">
              {administrators.map((account) => {
                const isSelf = account.id === currentAdminId;
                return (
                  <article key={account.id} className="p-5 hover:bg-[#FAF9F7]/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#002141]">
                            {account.full_name || 'Administrateur'}
                          </span>
                          {isSelf && (
                            <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                              Vous
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                              account.is_active
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${account.is_active ? 'bg-emerald-600' : 'bg-red-600'}`} />
                            {account.is_active ? 'Actif' : 'Accès Révoqué'}
                          </span>
                        </div>

                        <p className="text-xs text-[#3A3A3A] font-medium">{account.email}</p>

                        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#3A3A3A]/80">
                          <div>
                            <strong>Rôle :</strong> {account.role === 'admin' ? 'Administrateur' : account.role || 'Administrateur'}
                          </div>
                          <div>
                            <strong>Créé le :</strong> {account.created_at ? new Date(account.created_at).toLocaleDateString('fr-FR') : '—'}
                          </div>
                          <div className="sm:col-span-2">
                            <strong>Dernière connexion :</strong>{' '}
                            {account.last_signed_in_at
                              ? new Date(account.last_signed_in_at).toLocaleString('fr-FR')
                              : 'Jamais enregistré'}
                          </div>
                        </div>
                      </div>

                      {/* ACTION : RÉVOCATION IMMÉDIATE DE L'ACCÈS */}
                      <div className="shrink-0 pt-2 sm:pt-0">
                        {isSelf ? (
                          <span className="text-xs italic text-gray-500 font-medium">Session actuelle</span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              const actionName = account.is_active ? 'révoquer l’accès de' : 'réactiver';
                              if (
                                !window.confirm(
                                  `Êtes-vous sûr de vouloir ${actionName} ${account.full_name || account.email} ? ${
                                    account.is_active ? 'Sa session en cours sera immédiatement coupée.' : ''
                                  }`
                                )
                              ) {
                                return;
                              }
                              try {
                                await adminRequest(`/administrators/${account.id}`, {
                                  method: 'PATCH',
                                  body: { is_active: !account.is_active }
                                });
                                await loadTab('administrators');
                                notify(account.is_active ? 'Accès admin révoqué (session coupée).' : 'Accès admin réactivé.');
                              } catch (error) {
                                notify(error instanceof Error ? error.message : 'Action impossible.');
                              }
                            }}
                            className={
                              account.is_active
                                ? 'px-3 py-1.5 rounded-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors'
                                : 'px-3 py-1.5 rounded-sm bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-colors'
                            }
                          >
                            {account.is_active ? (
                              <>
                                <ShieldAlert className="h-3.5 w-3.5" /> Révoquer l'accès
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5" /> Réactiver l'accès
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* HISTORIQUE ET GESTION DES CODES D'INVITATION */}
          <section className="border border-[#002141]/15 bg-white shadow-sm flex flex-col">
            <div className="border-b border-[#002141]/10 p-5 bg-[#FAF9F7]">
              <h2 className="font-playfair text-xl font-bold text-[#002141]">Codes temporaires</h2>
              <p className="text-xs text-[#3A3A3A] mt-0.5">Invitations générées pour création de compte admin (Valides 1h)</p>
            </div>

            {invitations.length === 0 ? (
              <p className="p-6 text-sm text-[#3A3A3A] italic text-center">Aucun code d'invitation généré.</p>
            ) : (
              <div className="divide-y divide-[#002141]/10 flex-1">
                {invitations.map((invitation) => {
                  const isExpired = new Date(invitation.expires_at) <= new Date();
                  const isUsed = Boolean(invitation.used_at);
                  const isRevoked = Boolean(invitation.revoked_at);
                  const isValid = !isUsed && !isRevoked && !isExpired;

                  return (
                    <article key={invitation.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[#FAF9F7]/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                              isValid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isUsed
                                ? 'bg-gray-100 text-gray-700 border-gray-300'
                                : isRevoked
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isValid && 'Valide (1h)'}
                            {isUsed && 'Utilisé'}
                            {isRevoked && 'Révoqué'}
                            {isExpired && !isUsed && !isRevoked && 'Expiré'}
                          </span>
                        </div>

                        <p className="text-xs text-[#3A3A3A]">
                          <strong>Créé le :</strong> {invitation.created_at ? new Date(invitation.created_at).toLocaleString('fr-FR') : '—'}
                        </p>
                        <p className="text-xs text-[#3A3A3A]">
                          <strong>Expire le :</strong> {new Date(invitation.expires_at).toLocaleString('fr-FR')}
                        </p>
                      </div>

                      {/* Révocation d'un code non utilisé */}
                      {isValid && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('Voulez-vous révoquer ce code temporaire avant son utilisation ?')) return;
                            try {
                              await adminRequest(`/invitations/${invitation.id}/revoke`, { method: 'PATCH' });
                              await loadTab('administrators');
                              notify('Code temporaire révoqué avec succès.');
                            } catch (err: any) {
                              notify(err.message || 'Impossible de révoquer ce code.');
                            }
                          }}
                          className="px-2.5 py-1 rounded-sm bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                          title="Révoquer ce code non utilisé"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Révoquer
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* JOURNAL D'ACTIVITÉ RÉCENT (AUDIT LOGS) */}
        <section className="mt-8 border border-[#002141]/15 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#002141]/10 p-5 bg-[#FAF9F7]">
            <div>
              <h2 className="font-playfair text-xl font-bold text-[#002141]">Journal d’Activité (Audit)</h2>
              <p className="text-xs text-[#3A3A3A] mt-0.5">Traçabilité complète des actions sensibles effectuées sur le portail</p>
            </div>
            <span className="rounded-full bg-[#002141]/10 px-3 py-1 text-xs font-bold text-[#002141]">
              {auditLogs.length} action(s) récente(s)
            </span>
          </div>

          {auditLogs.length === 0 ? (
            <p className="p-6 text-sm text-[#3A3A3A] italic text-center">Aucune action enregistrée dans le journal.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#002141]/10 bg-[#FAF9F7] text-[#002141] font-bold uppercase tracking-wider">
                    <th className="p-3.5">Quand</th>
                    <th className="p-3.5">Administrateur (Qui)</th>
                    <th className="p-3.5">Action (Quoi)</th>
                    <th className="p-3.5">Entité & Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#002141]/10">
                  {auditLogs.map((entry) => {
                    const actionInfo = getAuditActionBadge(entry.action, entry.entity_type);
                    const detailsStr = entry.details ? JSON.stringify(entry.details) : '';

                    return (
                      <tr key={entry.id} className="hover:bg-[#FAF9F7]/60 transition-colors">
                        <td className="p-3.5 font-medium whitespace-nowrap text-[#002141]">
                          {entry.created_at ? new Date(entry.created_at).toLocaleString('fr-FR') : '—'}
                        </td>
                        <td className="p-3.5 font-semibold text-[#002141]">
                          {entry.actor_name || 'Administrateur'}
                          {entry.actor_email && <span className="block text-[11px] font-normal text-[#3A3A3A]">{entry.actor_email}</span>}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${actionInfo.style}`}>
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="p-3.5 text-[#3A3A3A] max-w-xs truncate">
                          <span className="font-semibold text-[#002141] uppercase tracking-wide text-[10px] mr-1">
                            [{entry.entity_type}]
                          </span>
                          {entry.entity_id && <span className="font-mono text-[11px] mr-1 text-gray-600">({entry.entity_id})</span>}
                          {detailsStr && detailsStr !== '{}' && (
                            <span className="text-[11px] italic text-gray-600 truncate block">
                              {detailsStr.length > 80 ? detailsStr.slice(0, 80) + '…' : detailsStr}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  };

  const renderUsers = () => {
    const safeUsers = Array.isArray(users) ? users : [];
    const totalUsersCount = safeUsers.length;
    const activeUsersCount = safeUsers.filter((u) => u.is_active !== false).length;
    const blockedUsersCount = safeUsers.filter((u) => u.is_active === false).length;
    const aggregateRevenue = safeUsers.reduce((sum, u) => sum + Number(u.total_spent_xof || 0), 0);
    const aggregateOrdersCount = safeUsers.reduce((sum, u) => sum + Number(u.order_count || 0), 0);

    const toggleUserStatus = async (userToUpdate: AnyRecord) => {
      const nextStatus = userToUpdate.is_active === false;
      const actionText = nextStatus ? 'réactiver' : 'bloquer';
      if (!window.confirm(`Voulez-vous vraiment ${actionText} le compte client de ${userToUpdate.full_name || userToUpdate.email} ?`)) {
        return;
      }

      try {
        const updated = await adminRequest<AnyRecord>(`/users/${userToUpdate.id}`, {
          method: 'PATCH',
          body: { is_active: nextStatus }
        });
        await loadTab('users');
        if (selectedUserModal && selectedUserModal.id === userToUpdate.id) {
          setSelectedUserModal((prev) => (prev ? { ...prev, is_active: nextStatus } : null));
        }
        notify(nextStatus ? 'Compte client réactivé avec succès.' : 'Compte client bloqué et accès révoqué.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Action sur le compte impossible.');
      }
    };

    return (
      <>
        <PanelHeader
          eyebrow="Relation Client & Sécurité"
          title="Utilisateurs & Fiches Clients"
          description="Consultez les coordonnées clients, gérez les adresses de livraison enregistrées, visualisez l'historique d'achats complet et bloquez ou réactivez des accès en toute sécurité. Aucune donnée bancaire n'est exposée."
          action={
            <button
              type="button"
              onClick={() => void downloadAdminCsv('/users/export.csv', 'heritage-utilisateurs.csv').catch((error) => notify(error.message))}
              className="admin-secondary-button flex items-center gap-2"
            >
              <FileText className="h-4 w-4" /> Exporter CSV
            </button>
          }
        />

        {/* Aggregate Stats Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Total Clients</span>
              <UsersRound className="h-5 w-5 text-[#AC854B]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#002141]">{totalUsersCount}</p>
            <p className="mt-1 text-[11px] text-[#3A3A3A]">{activeUsersCount} actifs · {blockedUsersCount} bloqués</p>
          </div>

          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Comptes Actifs</span>
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#002141]">{activeUsersCount}</p>
            <p className="mt-1 text-[11px] text-emerald-700">Accès au portail client autorisés</p>
          </div>

          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Commandes Effectuées</span>
              <ClipboardList className="h-5 w-5 text-[#002141]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#002141]">{aggregateOrdersCount}</p>
            <p className="mt-1 text-[11px] text-[#3A3A3A]">Commandes cumulées des clients</p>
          </div>

          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Volume d'Achats</span>
              <CreditCard className="h-5 w-5 text-[#AC854B]" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#002141]">{formatXOF(aggregateRevenue)}</p>
            <p className="mt-1 text-[11px] text-[#3A3A3A]">Chiffre d'affaires clients inscrit</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mb-6 border border-[#002141]/15 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Recherche globale</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#3A3A3A]/60" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Nom, email, téléphone, adresse…"
                  className="admin-input pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Statut du compte</label>
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="admin-input"
              >
                <option value="">Tous les statuts</option>
                <option value="active">Comptes Actifs uniquement</option>
                <option value="blocked">Comptes Bloqués / Désactivés</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Activité d'achat</label>
              <select
                value={userOrderFilter}
                onChange={(e) => setUserOrderFilter(e.target.value)}
                className="admin-input"
              >
                <option value="">Tous les clients</option>
                <option value="with_orders">Avec au moins 1 commande</option>
                <option value="no_orders">Sans commande (Prospects)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Trier par</label>
              <select
                value={userSort}
                onChange={(e) => setUserSort(e.target.value as any)}
                className="admin-input"
              >
                <option value="date_desc">Inscription (Plus récents)</option>
                <option value="date_asc">Inscription (Plus anciens)</option>
                <option value="spent_desc">Total dépensé (Décroissant)</option>
                <option value="orders_desc">Nombre de commandes</option>
                <option value="name_asc">Nom alphabétique (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Directory Table */}
        {users.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur enregistré"
            body="Les comptes des clients apparaîtront automatiquement ici après leur première inscription sur le site."
          />
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            title="Aucun client ne correspond aux critères"
            body="Essayez de modifier votre mot-clé de recherche ou de réinitialiser vos filtres."
          />
        ) : (
          <div className="overflow-x-auto border border-[#002141]/15 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#002141]/15 bg-[#F5F3EF] text-[11px] font-bold uppercase tracking-wider text-[#002141]">
                <tr>
                  <th className="p-3.5">Client & Contact</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5">Adresse / Commune</th>
                  <th className="p-3.5">Commandes & Dépenses</th>
                  <th className="p-3.5">Inscription</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#002141]/10 text-[#3A3A3A]">
                {visibleUsers.map((client) => {
                  const isBlocked = client.is_active === false;
                  const initials = (client.full_name || client.email || 'CL')
                    .split(' ')
                    .map((part: string) => part[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={client.id} className="hover:bg-[#FAF9F7]/80 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#002141] text-[11px] font-bold text-[#D6BB8F]">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-[#002141] text-sm">{client.full_name || 'Client sans nom'}</p>
                            <p className="text-[11px] text-[#3A3A3A] flex items-center gap-1">
                              <Mail className="h-3 w-3 inline text-gray-500" /> {client.email}
                            </p>
                            {client.phone && (
                              <p className="text-[11px] text-[#3A3A3A] flex items-center gap-1">
                                <Phone className="h-3 w-3 inline text-gray-500" /> {client.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800 border border-red-200">
                            <UserX className="h-3 w-3" /> Bloqué
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                            <UserCheck className="h-3 w-3" /> Actif
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 max-w-xs truncate">
                        <p className="font-semibold text-[#002141]">{client.commune || 'Abidjan'}</p>
                        <p className="text-[11px] text-[#3A3A3A] truncate" title={client.delivery_address || client.shipping_address}>
                          {client.delivery_address || client.shipping_address || 'Aucune adresse renseignée'}
                        </p>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded bg-[#002141]/10 px-2 py-0.5 text-[11px] font-bold text-[#002141]">
                            {client.order_count || 0} cmd(s)
                          </span>
                          <span className="font-bold text-[#002141]">{formatXOF(client.total_spent_xof)}</span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-[11px]">
                        {client.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR') : '—'}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedUserModal(client)}
                            className="admin-secondary-button py-1 px-2.5 text-xs flex items-center gap-1"
                            title="Voir la fiche client détaillée"
                          >
                            <Eye className="h-3.5 w-3.5" /> Fiche Client
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleUserStatus(client)}
                            className={
                              isBlocked
                                ? 'admin-primary-button py-1 px-2.5 text-xs flex items-center gap-1'
                                : 'admin-icon-button text-red-700 hover:bg-red-50 p-1.5 border border-red-200'
                            }
                            title={isBlocked ? 'Réactiver le compte' : 'Bloquer le compte client'}
                          >
                            {isBlocked ? (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5" /> Réactiver
                              </>
                            ) : (
                              <ShieldAlert className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Fiche Client Modal Overlay */}
        {selectedUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#002141]/60 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-3xl border border-[#002141]/20 bg-white shadow-2xl my-8">
              {/* Modal Top Header */}
              <div className="flex items-center justify-between border-b border-[#002141]/15 bg-[#002141] p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#AC854B] text-[#002141] font-bold text-base">
                    {(selectedUserModal.full_name || selectedUserModal.email || 'CL')
                      .split(' ')
                      .map((p: string) => p[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedUserModal.full_name || 'Client HERITAGE'}</h2>
                    <p className="text-xs text-[#D6BB8F] flex items-center gap-2">
                      <span>Rôle : Client</span>
                      <span>·</span>
                      <span className="font-mono text-[11px] opacity-80">ID: {selectedUserModal.id}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {selectedUserModal.is_active === false ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-900/80 px-3 py-1 text-xs font-bold text-red-200 border border-red-700">
                      <UserX className="h-3.5 w-3.5" /> Compte Bloqué
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/80 px-3 py-1 text-xs font-bold text-emerald-200 border border-emerald-700">
                      <UserCheck className="h-3.5 w-3.5" /> Compte Actif
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedUserModal(null)}
                    className="p-1 text-gray-300 hover:text-white transition-colors"
                    aria-label="Fermer la fiche client"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Account Action Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-[#002141]/15 bg-[#F5F3EF]">
                  <div>
                    <p className="font-bold text-sm text-[#002141]">Gestion de l'accès du compte</p>
                    <p className="text-xs text-[#3A3A3A] mt-0.5">
                      {selectedUserModal.is_active === false
                        ? "Le compte est actuellement suspendu. Le client ne peut plus se connecter ni passer de commande."
                        : "Le compte est actif. Vous pouvez le suspendre immédiatement à tout moment."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleUserStatus(selectedUserModal)}
                    className={
                      selectedUserModal.is_active === false
                        ? 'admin-primary-button whitespace-nowrap'
                        : 'bg-red-800 text-white hover:bg-red-900 px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap'
                    }
                  >
                    {selectedUserModal.is_active === false ? 'Réactiver le compte client' : 'Bloquer le compte client'}
                  </button>
                </div>

                {/* Section 1: Contact Details & Address */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="border border-[#002141]/15 p-4 bg-white">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#002141] mb-3 flex items-center gap-1.5 border-b border-[#002141]/10 pb-2">
                      <User className="h-4 w-4 text-[#AC854B]" /> Coordonnées du Client
                    </h3>
                    <dl className="space-y-2 text-xs">
                      <div>
                        <dt className="text-gray-500 font-semibold">Nom complet :</dt>
                        <dd className="text-[#002141] font-semibold">{selectedUserModal.full_name || 'Non renseigné'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-semibold">E-mail :</dt>
                        <dd className="text-[#002141]">
                          <a href={`mailto:${selectedUserModal.email}`} className="underline hover:text-[#AC854B]">
                            {selectedUserModal.email}
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-semibold">Téléphone :</dt>
                        <dd className="text-[#002141]">
                          {selectedUserModal.phone ? (
                            <a href={`tel:${selectedUserModal.phone}`} className="underline hover:text-[#AC854B]">
                              {selectedUserModal.phone}
                            </a>
                          ) : (
                            'Non renseigné'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-semibold">Membre depuis le :</dt>
                        <dd className="text-[#002141]">
                          {selectedUserModal.created_at ? new Date(selectedUserModal.created_at).toLocaleString('fr-FR') : '—'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="border border-[#002141]/15 p-4 bg-white">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#002141] mb-3 flex items-center gap-1.5 border-b border-[#002141]/10 pb-2">
                      <MapPin className="h-4 w-4 text-[#AC854B]" /> Adresses Enregistrées
                    </h3>
                    <dl className="space-y-2 text-xs">
                      <div>
                        <dt className="text-gray-500 font-semibold">Commune / Ville :</dt>
                        <dd className="text-[#002141] font-semibold">{selectedUserModal.commune || 'Abidjan (Défaut)'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 font-semibold">Adresse de livraison :</dt>
                        <dd className="text-[#002141] leading-relaxed">
                          {selectedUserModal.delivery_address || selectedUserModal.shipping_address || 'Aucune adresse enregistrée.'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Section 2: Summary Metrics */}
                <div className="grid gap-4 sm:grid-cols-3 bg-[#F5F3EF] p-4 border border-[#002141]/15 text-center">
                  <div>
                    <span className="text-[11px] font-semibold text-[#3A3A3A] uppercase tracking-wider">Commandes Totales</span>
                    <p className="text-xl font-bold text-[#002141] mt-1">{selectedUserModal.order_count || 0}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-[#3A3A3A] uppercase tracking-wider">Cumul Dépensé</span>
                    <p className="text-xl font-bold text-[#002141] mt-1">{formatXOF(selectedUserModal.total_spent_xof)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-[#3A3A3A] uppercase tracking-wider">Panier Moyen</span>
                    <p className="text-xl font-bold text-[#AC854B] mt-1">
                      {selectedUserModal.order_count > 0
                        ? formatXOF(Math.round(Number(selectedUserModal.total_spent_xof || 0) / Number(selectedUserModal.order_count)))
                        : '0 FCFA'}
                    </p>
                  </div>
                </div>

                {/* Section 3: Order History */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#002141] mb-3 flex items-center justify-between border-b border-[#002141]/10 pb-2">
                    <span className="flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4 text-[#AC854B]" /> Historique des Commandes
                    </span>
                    <span className="text-[11px] font-normal text-gray-500">
                      {(selectedUserModal.orders || []).length} commande(s) répertoriée(s)
                    </span>
                  </h3>

                  {(!selectedUserModal.orders || selectedUserModal.orders.length === 0) ? (
                    <p className="text-xs text-[#3A3A3A] italic py-4 text-center border border-dashed border-[#002141]/15">
                      Ce client n'a pas encore passé de commande sur le site.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-[#002141]/15">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F5F3EF] border-b border-[#002141]/15 text-[10px] uppercase font-bold text-[#002141]">
                          <tr>
                            <th className="p-2.5">N° Commande</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Statut</th>
                            <th className="p-2.5">Montant</th>
                            <th className="p-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#002141]/10 text-[#3A3A3A]">
                          {selectedUserModal.orders.map((ord: AnyRecord) => (
                            <tr key={ord.id} className="hover:bg-gray-50">
                              <td className="p-2.5 font-bold text-[#002141]">
                                {ord.order_number || ord.id.slice(0, 8)}
                              </td>
                              <td className="p-2.5 text-[11px]">
                                {ord.created_at ? new Date(ord.created_at).toLocaleDateString('fr-FR') : '—'}
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="admin-pill text-[10px]">
                                  {statusLabel[ord.status] || ord.status}
                                </span>
                              </td>
                              <td className="p-2.5 font-semibold text-[#002141]">
                                {formatXOF(ord.total_xof)}
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserModal(null);
                                    selectTab('orders');
                                    setSelectedOrder(ord);
                                  }}
                                  className="text-[11px] font-bold text-[#AC854B] hover:underline flex items-center gap-1 justify-end ml-auto"
                                >
                                  Voir détail <ExternalLink className="h-3 w-3 inline" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-[#002141]/15 bg-[#F5F3EF] p-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedUserModal(null)}
                  className="admin-secondary-button"
                >
                  Fermer la fiche
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderMedia = () => {
    const safeMedia = Array.isArray(media) ? media : [];
    const totalMediaCount = safeMedia.length;
    const usedMediaCount = safeMedia.filter((m) => Array.isArray(m.usage) && m.usage.length > 0).length;
    const freeMediaCount = totalMediaCount - usedMediaCount;
    const totalStorageBytes = safeMedia.reduce((sum, m) => sum + Number(m.size_bytes || 0), 0);

    const formatBytes = (bytes: number) => {
      if (!bytes || bytes <= 0) return '0 Ko';
      const k = 1024;
      const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    const optimizeImageFile = (file: File, targetFolder: string, defaultAlt: string, defaultTags: string): Promise<{
      fileName: string;
      mimeType: string;
      contentBase64: string;
      altText: string;
      folder: string;
      tags: string[];
      width: number;
      height: number;
    }> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          let { width, height } = img;
          const maxDim = 1920;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Impossible d\'initialiser le canvas d\'optimisation.'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL('image/webp', 0.88);
          let mimeType = 'image/webp';
          let fileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';

          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            mimeType = 'image/jpeg';
            fileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          }

          const cleanAlt = defaultAlt.trim() || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          const tagList = defaultTags.split(',').map((t) => t.trim()).filter(Boolean);

          resolve({
            fileName,
            mimeType,
            contentBase64: dataUrl,
            altText: cleanAlt,
            folder: targetFolder || 'general',
            tags: tagList,
            width,
            height
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Impossible de charger l'image ${file.name}`));
        };
        img.src = objectUrl;
      });
    };

    const processAndUploadFiles = async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) {
        notify('Veuillez sélectionner des fichiers image valides (JPEG, PNG, WebP, AVIF).');
        return;
      }

      setUploadProgress({ current: 0, total: files.length, fileName: files[0].name });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
        try {
          const optimized = await optimizeImageFile(file, batchUploadFolder, batchUploadAltText, batchUploadTags);
          await adminRequest('/media/upload', {
            method: 'POST',
            body: {
              fileName: optimized.fileName,
              mimeType: optimized.mimeType,
              contentBase64: optimized.contentBase64,
              altText: optimized.altText,
              folder: optimized.folder,
              tags: optimized.tags,
              width: optimized.width,
              height: optimized.height
            }
          });
          successCount++;
        } catch (err: any) {
          console.error(`Erreur d'envoi pour ${file.name}:`, err);
          failCount++;
        }
      }

      setUploadProgress(null);
      await loadTab('media');
      if (failCount === 0) {
        notify(`${successCount} image(s) web-optimisée(s) et ajoutée(s) avec succès !`);
      } else {
        notify(`${successCount} image(s) ajoutée(s), ${failCount} échec(s).`);
      }
    };

    const attemptDeleteMedia = async (asset: AnyRecord) => {
      if (Array.isArray(asset.usage) && asset.usage.length > 0) {
        setDeleteWarningMedia(asset);
        return;
      }

      if (!window.confirm(`Voulez-vous vraiment supprimer définitivement l'image "${asset.file_name}" de Supabase Storage ?`)) {
        return;
      }

      try {
        await adminRequest(`/media/${asset.id}`, { method: 'DELETE' });
        await loadTab('media');
        if (selectedMediaModal && selectedMediaModal.id === asset.id) {
          setSelectedMediaModal(null);
        }
        notify('Image supprimée de Supabase Storage et du catalogue.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'La suppression de l\'image a échoué.');
      }
    };

    const copyUrl = (url: string) => {
      navigator.clipboard.writeText(url);
      notify('URL publique copiée dans le presse-papier !');
    };

    return (
      <>
        <PanelHeader
          eyebrow="Supabase Storage & Assets"
          title="Galerie Média & Optimisation Web"
          description="Importez vos visuels par glisser-déposer. Les fichiers sont automatiquement redimensionnés et compressés en WebP (max 1920px). Organisez-les par dossier ou tag et vérifiez leur utilisation exacte sur les produits et articles de la boutique."
          action={
            <label className="admin-primary-button cursor-pointer flex items-center gap-2">
              <Plus className="h-4 w-4" /> Parcourir et Importer
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    void processAndUploadFiles(e.target.files);
                  }
                }}
              />
            </label>
          }
        />

        {/* Global Storage & Usage Metrics */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Total Visuels</span>
              <ImageIcon className="h-5 w-5 text-[#AC854B]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#002141]">{totalMediaCount}</p>
            <p className="mt-1 text-[11px] text-[#3A3A3A]">Images stockées sur Supabase Storage</p>
          </div>

          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Images Utilisées</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#002141]">{usedMediaCount}</p>
            <p className="mt-1 text-[11px] text-emerald-700">Liées aux produits ou articles</p>
          </div>

          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Images Libres</span>
              <FolderOpen className="h-5 w-5 text-[#AC854B]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#002141]">{freeMediaCount}</p>
            <p className="mt-1 text-[11px] text-[#3A3A3A]">Disponibles pour association</p>
          </div>

          <div className="border border-[#002141]/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3A3A3A]">Volume Total</span>
              <HardDrive className="h-5 w-5 text-[#002141]" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#002141]">{formatBytes(totalStorageBytes)}</p>
            <p className="mt-1 text-[11px] text-[#3A3A3A]">Stockage optimisé WebP</p>
          </div>
        </div>

        {/* Drag and Drop Zone & Batch Settings */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setMediaDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setMediaDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setMediaDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              void processAndUploadFiles(e.dataTransfer.files);
            }
          }}
          className={`mb-6 border-2 border-dashed p-6 transition-colors text-center ${
            mediaDragActive
              ? 'border-[#AC854B] bg-[#AC854B]/10'
              : 'border-[#002141]/20 bg-white hover:border-[#AC854B]/60'
          }`}
        >
          <div className="mx-auto flex max-w-xl flex-col items-center justify-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#002141]/10 text-[#002141]">
              <UploadCloud className="h-6 w-6 text-[#AC854B]" />
            </div>
            <h3 className="text-sm font-bold text-[#002141]">
              Glissez-déposez vos images ici pour un import multiple rapide
            </h3>
            <p className="mt-1 text-xs text-[#3A3A3A]">
              Formats acceptés : JPEG, PNG, WebP, AVIF · Conversion WebP et redimensionnement auto (1920px max)
            </p>

            {/* Batch Upload Configuration Controls */}
            <div className="mt-4 grid w-full gap-3 sm:grid-cols-3 text-left">
              <div>
                <label className="block text-[11px] font-bold text-[#002141] mb-1">Dossier de destination</label>
                <select
                  value={batchUploadFolder}
                  onChange={(e) => setBatchUploadFolder(e.target.value)}
                  className="admin-input text-xs py-1.5"
                >
                  <option value="produit">Produit</option>
                  <option value="catégorie">Catégorie</option>
                  <option value="éditorial">Éditorial</option>
                  <option value="blog">Blog</option>
                  <option value="general">Général</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#002141] mb-1">Texte Alt par défaut</label>
                <input
                  type="text"
                  value={batchUploadAltText}
                  onChange={(e) => setBatchUploadAltText(e.target.value)}
                  placeholder="Ex: Montre de luxe Heritage"
                  className="admin-input text-xs py-1.5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#002141] mb-1">Tags (séparés par virgules)</label>
                <input
                  type="text"
                  value={batchUploadTags}
                  onChange={(e) => setBatchUploadTags(e.target.value)}
                  placeholder="Ex: luxe, montre, abidjan"
                  className="admin-input text-xs py-1.5"
                />
              </div>
            </div>
          </div>

          {/* Upload Progress Indicator */}
          {uploadProgress && (
            <div className="mt-4 border-t border-[#002141]/10 pt-4 text-center">
              <div className="flex items-center justify-between text-xs font-bold text-[#002141] mb-1">
                <span>Optimisation et envoi : {uploadProgress.fileName}</span>
                <span>
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-[#AC854B] transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Filters, Search and Sorting Bar */}
        <div className="mb-6 border border-[#002141]/15 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Rechercher une image</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#3A3A3A]/60" />
                <input
                  type="text"
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  placeholder="Nom du fichier, texte alt, tag…"
                  className="admin-input pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Filtrer par Dossier</label>
              <select
                value={mediaFolderFilter}
                onChange={(e) => setMediaFolderFilter(e.target.value)}
                className="admin-input"
              >
                <option value="">Tous les dossiers</option>
                <option value="produit">Dossier Produit</option>
                <option value="catégorie">Dossier Catégorie</option>
                <option value="éditorial">Dossier Éditorial</option>
                <option value="blog">Dossier Blog</option>
                <option value="general">Dossier Général</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Filtrer par Utilisation</label>
              <select
                value={mediaUsageFilter}
                onChange={(e) => setMediaUsageFilter(e.target.value)}
                className="admin-input"
              >
                <option value="">Toutes les images</option>
                <option value="used">Images Utilisées (Liées)</option>
                <option value="unused">Images Libres (Non liées)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#002141] mb-1">Trier par</label>
              <select
                value={mediaSort}
                onChange={(e) => setMediaSort(e.target.value as any)}
                className="admin-input"
              >
                <option value="date_desc">Ajout (Plus récentes)</option>
                <option value="date_asc">Ajout (Plus anciennes)</option>
                <option value="size_desc">Poids du fichier (Décroissant)</option>
                <option value="name_asc">Nom alphabétique (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Media Grid */}
        {safeMedia.length === 0 ? (
          <EmptyState
            title="La galerie média est vide"
            body="Glissez-déposez des visuels ci-dessus ou cliquez sur 'Parcourir et Importer' pour alimenter votre médiathèque."
          />
        ) : visibleMedia.length === 0 ? (
          <EmptyState
            title="Aucune image ne correspond aux critères"
            body="Essayez de réinitialiser vos filtres de dossier, d'utilisation ou votre terme de recherche."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleMedia.map((asset) => {
              const hasUsage = Array.isArray(asset.usage) && asset.usage.length > 0;
              const tagsList = Array.isArray(asset.tags)
                ? asset.tags
                : typeof asset.tags === 'string'
                ? asset.tags.split(',').map((t) => t.trim()).filter(Boolean)
                : [];

              return (
                <article
                  key={asset.id}
                  className="group relative flex flex-col justify-between border border-[#002141]/15 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Image Container & Overlay */}
                  <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
                    <img
                      src={asset.public_url}
                      alt={asset.alt_text || asset.file_name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Format & Dimensions Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="rounded bg-[#002141]/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur-sm">
                        {asset.folder || 'general'}
                      </span>
                      {asset.width && asset.height && (
                        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                          {asset.width}x{asset.height}
                        </span>
                      )}
                    </div>

                    {/* Usage Status Badge */}
                    <div className="absolute top-2 right-2">
                      {hasUsage ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                          <CheckCircle2 className="h-3 w-3" /> Utilisée ({asset.usage.length})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#AC854B]/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                          Libre
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content & Details */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="truncate text-xs font-bold text-[#002141]" title={asset.file_name}>
                        {asset.file_name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#3A3A3A] italic" title={asset.alt_text}>
                        "{asset.alt_text || 'Aucun texte alternatif'}"
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                        <span>{formatBytes(asset.size_bytes)}</span>
                        <span>{asset.mime_type?.replace('image/', '').toUpperCase() || 'WEBP'}</span>
                      </div>

                      {tagsList.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tagsList.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="inline-block rounded bg-[#002141]/5 px-1.5 py-0.5 text-[10px] text-[#002141]">
                              #{tag}
                            </span>
                          ))}
                          {tagsList.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{tagsList.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-3 flex items-center justify-between border-t border-[#002141]/10 pt-3">
                      <button
                        type="button"
                        onClick={() => copyUrl(asset.public_url)}
                        className="text-[11px] font-semibold text-gray-600 hover:text-[#002141] flex items-center gap-1"
                        title="Copier l'URL publique Supabase"
                      >
                        <Copy className="h-3.5 w-3.5" /> URL
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedMediaModal(asset)}
                          className="admin-icon-button p-1.5"
                          title="Inspecter & Modifier les métadonnées"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void attemptDeleteMedia(asset)}
                          className="admin-icon-button text-red-700 hover:bg-red-50 p-1.5"
                          title="Supprimer l'image"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Selected Media Inspector & Edit Modal */}
        {selectedMediaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#002141]/60 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-4xl border border-[#002141]/20 bg-white shadow-2xl my-8">
              {/* Modal Top Header */}
              <div className="flex items-center justify-between border-b border-[#002141]/15 bg-[#002141] p-5 text-white">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-6 w-6 text-[#AC854B]" />
                  <div>
                    <h2 className="text-base font-bold truncate max-w-md">{selectedMediaModal.file_name}</h2>
                    <p className="text-xs text-[#D6BB8F]">Inspecteur & Métadonnées Supabase Storage</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMediaModal(null)}
                  className="p-1 text-gray-300 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="grid gap-6 p-6 md:grid-cols-2 max-h-[75vh] overflow-y-auto">
                {/* Left Column: Visual Preview & Technical Specs */}
                <div className="space-y-4">
                  <div className="relative border border-[#002141]/15 bg-gray-100 overflow-hidden rounded">
                    <img
                      src={selectedMediaModal.public_url}
                      alt={selectedMediaModal.alt_text || selectedMediaModal.file_name}
                      className="w-full max-h-80 object-contain mx-auto"
                    />
                  </div>

                  {/* Tech Details Box */}
                  <div className="border border-[#002141]/15 bg-[#F5F3EF] p-4 text-xs space-y-2">
                    <h4 className="font-bold text-[#002141] uppercase tracking-wider text-[11px] mb-2">Spécifications Techniques</h4>
                    <div className="flex justify-between border-b border-[#002141]/10 pb-1">
                      <span className="text-gray-600">Chemin Storage :</span>
                      <span className="font-mono text-[11px] text-[#002141] truncate max-w-[180px]" title={selectedMediaModal.bucket_path}>
                        {selectedMediaModal.bucket_path || 'products/' + selectedMediaModal.file_name}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#002141]/10 pb-1">
                      <span className="text-gray-600">Dimensions :</span>
                      <span className="font-semibold text-[#002141]">
                        {selectedMediaModal.width && selectedMediaModal.height
                          ? `${selectedMediaModal.width} × ${selectedMediaModal.height} px`
                          : 'Dimensions standard'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#002141]/10 pb-1">
                      <span className="text-gray-600">Poids du fichier :</span>
                      <span className="font-semibold text-[#002141]">{formatBytes(selectedMediaModal.size_bytes)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#002141]/10 pb-1">
                      <span className="text-gray-600">Format MIME :</span>
                      <span className="font-semibold text-[#002141]">{selectedMediaModal.mime_type || 'image/webp'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date d'importation :</span>
                      <span className="text-[#002141]">
                        {selectedMediaModal.created_at ? new Date(selectedMediaModal.created_at).toLocaleString('fr-FR') : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Public URL Field */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#002141] mb-1">URL Publique Supabase</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={selectedMediaModal.public_url}
                        className="admin-input text-xs font-mono bg-gray-50 flex-1 truncate"
                      />
                      <button
                        type="button"
                        onClick={() => copyUrl(selectedMediaModal.public_url)}
                        className="admin-secondary-button py-1 px-3 text-xs flex items-center gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copier
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Editing Form & Usage List */}
                <div className="space-y-6">
                  {/* Metadata Edit Form */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const tagsList = (selectedMediaModal.tags_input || '')
                          .split(',')
                          .map((t: string) => t.trim())
                          .filter(Boolean);

                        await adminRequest(`/media/${selectedMediaModal.id}`, {
                          method: 'PATCH',
                          body: {
                            alt_text: selectedMediaModal.alt_text,
                            folder: selectedMediaModal.folder || 'general',
                            tags: tagsList,
                            product_id: selectedMediaModal.product_id || null,
                            sort_order: selectedMediaModal.sort_order || 0
                          }
                        });
                        await loadTab('media');
                        notify('Métadonnées média enregistrées avec succès.');
                      } catch (error) {
                        notify(error instanceof Error ? error.message : 'La mise à jour a échoué.');
                      }
                    }}
                    className="border border-[#002141]/15 p-4 bg-white space-y-3"
                  >
                    <h4 className="font-bold text-[#002141] uppercase tracking-wider text-[11px] border-b border-[#002141]/10 pb-2 flex items-center gap-1.5">
                      <Pencil className="h-4 w-4 text-[#AC854B]" /> Éditer les métadonnées SEO
                    </h4>

                    <div>
                      <label className="block text-xs font-semibold text-[#002141] mb-1">Texte alternatif (Alt Text) *</label>
                      <input
                        type="text"
                        required
                        value={selectedMediaModal.alt_text || ''}
                        onChange={(e) =>
                          setSelectedMediaModal((prev) => (prev ? { ...prev, alt_text: e.target.value } : null))
                        }
                        placeholder="Description précise pour le SEO et l'accessibilité..."
                        className="admin-input"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#002141] mb-1">Dossier de classement</label>
                      <select
                        value={selectedMediaModal.folder || 'general'}
                        onChange={(e) =>
                          setSelectedMediaModal((prev) => (prev ? { ...prev, folder: e.target.value } : null))
                        }
                        className="admin-input"
                      >
                        <option value="produit">Produit</option>
                        <option value="catégorie">Catégorie</option>
                        <option value="éditorial">Éditorial</option>
                        <option value="blog">Blog</option>
                        <option value="general">Général</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#002141] mb-1">Tags (séparés par des virgules)</label>
                      <input
                        type="text"
                        value={
                          selectedMediaModal.tags_input !== undefined
                            ? selectedMediaModal.tags_input
                            : Array.isArray(selectedMediaModal.tags)
                            ? selectedMediaModal.tags.join(', ')
                            : String(selectedMediaModal.tags || '')
                        }
                        onChange={(e) =>
                          setSelectedMediaModal((prev) => (prev ? { ...prev, tags_input: e.target.value } : null))
                        }
                        placeholder="Ex: bijoux, luxe, abidjan, collection"
                        className="admin-input"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button type="submit" className="admin-primary-button text-xs py-2 px-4">
                        Enregistrer les modifications
                      </button>
                    </div>
                  </form>

                  {/* Usage Details List */}
                  <div className="border border-[#002141]/15 p-4 bg-white">
                    <h4 className="font-bold text-[#002141] uppercase tracking-wider text-[11px] border-b border-[#002141]/10 pb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-[#AC854B]" /> Emplacements d'utilisation
                    </h4>

                    {(!selectedMediaModal.usage || selectedMediaModal.usage.length === 0) ? (
                      <p className="mt-3 text-xs text-[#3A3A3A] italic">
                        Cette image n'est associée à aucun produit, article de blog ou page. Elle peut être supprimée en toute sécurité.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-xs">
                        {selectedMediaModal.usage.map((use: AnyRecord, idx: number) => (
                          <li key={idx} className="flex items-center justify-between border-b border-[#002141]/10 pb-1.5">
                            <span className="font-semibold text-[#002141]">[{use.type}] {use.label}</span>
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Actif
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Delete Action in Modal */}
                  <div className="pt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => void attemptDeleteMedia(selectedMediaModal)}
                      className="bg-red-800 text-white hover:bg-red-900 px-4 py-2 text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" /> Supprimer du Storage
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMediaModal(null)}
                      className="admin-secondary-button text-xs"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Protected Warning Modal */}
        {deleteWarningMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#002141]/70 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg border border-red-300 bg-white p-6 shadow-2xl">
              <div className="flex items-center gap-3 text-red-800 mb-4 border-b border-red-100 pb-3">
                <ShieldAlert className="h-7 w-7 shrink-0 text-red-700" />
                <div>
                  <h3 className="text-base font-bold">Suppression Bloquée · Image Utilisée</h3>
                  <p className="text-xs text-red-700">Protection contre la cassure des liens de la boutique</p>
                </div>
              </div>

              <p className="text-xs text-[#3A3A3A] leading-relaxed mb-4">
                L'image <strong className="text-[#002141]">"{deleteWarningMedia.file_name}"</strong> est actuellement liée à{' '}
                <strong className="text-[#002141]">{(deleteWarningMedia.usage || []).length} élément(s)</strong> de votre boutique. Pour préserver l'affichage du site, la suppression est temporairement bloquée.
              </p>

              <div className="mb-4 border border-red-100 bg-red-50/60 p-3 text-xs text-red-900 rounded space-y-1">
                <p className="font-bold text-[11px] uppercase tracking-wider mb-1">Contenus utilisant ce visuel :</p>
                {(deleteWarningMedia.usage || []).map((u: AnyRecord, i: number) => (
                  <p key={i}>• [{u.type}] {u.label}</p>
                ))}
              </div>

              <p className="text-[11px] text-[#3A3A3A] italic mb-6">
                Pour débloquer la suppression, modifiez d'abord ces produits ou articles afin d'y associer un autre visuel.
              </p>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteWarningMedia(null)}
                  className="admin-primary-button text-xs py-2 px-4"
                >
                  J'ai compris
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

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


  const renderMessages = () => {
    const normalizedQuery = contactMessageSearch.trim().toLocaleLowerCase('fr-FR');
    const visibleMessages = [...contactMessages]
      .filter((message) => {
        const matchesStatus = !contactMessageStatusFilter || message.status === contactMessageStatusFilter;
        const matchesQuery = !normalizedQuery || [message.full_name, message.email, message.subject]
          .some((value) => String(value || '').toLocaleLowerCase('fr-FR').includes(normalizedQuery));
        return matchesStatus && matchesQuery;
      })
      .sort((first, second) => {
        const firstTime = new Date(first.created_at || 0).getTime();
        const secondTime = new Date(second.created_at || 0).getTime();
        return contactMessageSort === 'date_desc' ? secondTime - firstTime : firstTime - secondTime;
      });

    const openMessage = async (message: AnyRecord) => {
      setContactMessageDetailLoading(true);
      try {
        const detail = await adminRequest<AnyRecord>('/contact-messages/' + message.id);
        setSelectedContactMessage(detail);
        setContactMessages((current) => current.map((item) => item.id === detail.id ? { ...item, ...detail } : item));
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Le message ne peut pas être ouvert.');
      } finally {
        setContactMessageDetailLoading(false);
      }
    };

    const updateMessageStatus = async (messageId: string, status: 'new' | 'read' | 'processed') => {
      try {
        const updated = await adminRequest<AnyRecord>('/contact-messages/' + messageId, { method: 'PATCH', body: { status } });
        setContactMessages((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
        setSelectedContactMessage((current) => current?.id === updated.id ? { ...current, ...updated } : current);
        notify(status === 'processed' ? 'Message marqué comme traité.' : 'Statut du message mis à jour.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'La mise à jour est impossible.');
      }
    };

    const deleteMessage = async (message: AnyRecord) => {
      if (!window.confirm('Supprimer définitivement le message de ' + (message.full_name || 'ce visiteur') + ' ?')) return;
      try {
        await adminRequest('/contact-messages/' + message.id, { method: 'DELETE' });
        setContactMessages((current) => current.filter((item) => item.id !== message.id));
        setSelectedContactMessage((current) => current?.id === message.id ? null : current);
        notify('Message supprimé.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'La suppression est impossible.');
      }
    };

    return <>
      <PanelHeader eyebrow="Relation client" title="Messages reçus" description="Consultez les messages envoyés depuis le formulaire de contact du site." />

      <div className="mb-5 grid gap-3 border border-[#002141]/15 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Rechercher un message</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A3A3A]/65" />
          <input value={contactMessageSearch} onChange={(event) => setContactMessageSearch(event.target.value)} placeholder="Rechercher par nom, e-mail ou objet" className="admin-input pl-9" />
        </label>
        <label className="text-xs font-semibold text-[#002141]">Statut
          <select value={contactMessageStatusFilter} onChange={(event) => setContactMessageStatusFilter(event.target.value)} className="admin-input mt-1">
            <option value="">Tous les statuts</option>
            <option value="new">Nouveau</option>
            <option value="read">Lu</option>
            <option value="processed">Traité</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[#002141]">Trier par date
          <select value={contactMessageSort} onChange={(event) => setContactMessageSort(event.target.value as 'date_desc' | 'date_asc')} className="admin-input mt-1">
            <option value="date_desc">Plus récent</option>
            <option value="date_asc">Plus ancien</option>
          </select>
        </label>
      </div>

      {contactMessages.length === 0 ? (
        <EmptyState title="Aucun message" body="Les messages envoyés par les visiteurs de la boutique apparaîtront ici." />
      ) : visibleMessages.length === 0 ? (
        <EmptyState title="Aucun résultat" body="Aucun message ne correspond à votre recherche ou à ce filtre." />
      ) : (
        <div className="space-y-3">
          {visibleMessages.map((message) => (
            <article key={message.id} className={'border bg-white p-5 ' + (message.status === 'new' ? 'border-[#AC854B]/55' : 'border-[#002141]/15')}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <button type="button" onClick={() => void openMessage(message)} className="min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#AC854B]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#002141]">{message.full_name || 'Anonyme'}</p>
                    <span className="admin-pill">{CONTACT_MESSAGE_STATUS_LABELS[message.status] || 'Nouveau'}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#002141]">{message.subject || 'Demande sans objet'}</p>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#3A3A3A]">{contactMessageExcerpt(message.message)}</p>
                  <p className="mt-2 text-xs text-[#3A3A3A]">{message.created_at ? new Date(message.created_at).toLocaleString('fr-FR') : '—'}</p>
                </button>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" onClick={() => void openMessage(message)} className="admin-secondary-button" disabled={contactMessageDetailLoading}>Voir le message</button>
                  {message.status !== 'processed' && <button type="button" onClick={() => void updateMessageStatus(message.id, 'processed')} className="admin-primary-button">Marquer traité</button>}
                  <button type="button" onClick={() => void deleteMessage(message)} className="admin-icon-button text-red-800" aria-label={'Supprimer le message de ' + (message.full_name || 'ce visiteur')}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedContactMessage && (
        <section className="mt-6 border border-[#AC854B]/50 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="contact-message-detail-title">
          <div className="flex flex-col gap-4 border-b border-[#002141]/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AC854B]">Message ouvert</p>
              <h2 id="contact-message-detail-title" className="font-playfair mt-1 text-2xl font-bold text-[#002141]">{selectedContactMessage.subject || 'Demande sans objet'}</h2>
              <p className="mt-1 text-xs text-[#3A3A3A]">{selectedContactMessage.created_at ? new Date(selectedContactMessage.created_at).toLocaleString('fr-FR') : '—'} · <span className="admin-pill">{CONTACT_MESSAGE_STATUS_LABELS[selectedContactMessage.status] || 'Nouveau'}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedContactMessage.status !== 'processed' && <button type="button" onClick={() => void updateMessageStatus(selectedContactMessage.id, 'processed')} className="admin-primary-button">Marquer traité</button>}
              <button type="button" onClick={() => void deleteMessage(selectedContactMessage)} className="admin-icon-button text-red-800" aria-label="Supprimer ce message"><Trash2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => setSelectedContactMessage(null)} className="admin-secondary-button">Fermer</button>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase tracking-wider text-[#3A3A3A]">Nom complet</dt><dd className="mt-1 font-semibold text-[#002141]">{selectedContactMessage.full_name || '—'}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-[#3A3A3A]">Téléphone / WhatsApp</dt><dd className="mt-1 font-semibold text-[#002141]">{selectedContactMessage.phone || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wider text-[#3A3A3A]">Adresse e-mail</dt><dd className="mt-1 font-semibold text-[#002141]">{selectedContactMessage.email || '—'}</dd></div>
          </dl>
          <div className="mt-5 border-t border-[#002141]/10 pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#3A3A3A]">Message</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#3A3A3A]">{selectedContactMessage.message}</p>
          </div>
        </section>
      )}
    </>;
  };

  const moderateProductReview = async (review: AnyRecord, status: 'approved' | 'pending' | 'rejected') => {
    try {
      await adminRequest(`/resources/reviews/${review.id}`, {
        method: 'PATCH',
        body: {
          ...review,
          status,
          manually_validated: status === 'approved' ? true : Boolean(review.manually_validated)
        }
      });
      await loadTab('products');
      notify(status === 'approved' ? 'Avis approuvé.' : status === 'rejected' ? 'Avis refusé.' : 'Avis remis en attente.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'La modération de l’avis a échoué.');
    }
  };

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

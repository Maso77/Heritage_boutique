import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '../types';

const FALLBACK_SITE_SETTINGS: SiteSettings = {
  business_name: 'HERITAGE',
  email: 'contact@heritageboutique.ci',
  phone: '+225 07 00 00 00 00',
  whatsapp_phone: '+225 07 00 00 00 00',
  address: 'Abidjan, Côte d\'Ivoire',
  hours: 'Lundi - Samedi : 09h00 - 19h00',
  social_links: { instagram: 'https://instagram.com', facebook: 'https://facebook.com' },
  structured_data_enabled: true,
  footer_notices: []
};

export interface PublicBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  category: string | null;
  tags: string[];
  related_product_ids: string[];
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  cover: { public_url: string; alt_text: string } | null;
}

export interface PublicFaq {
  id: string;
  question: string;
  answer_html: string;
  category: string | null;
  placements: string[];
}

export interface PublicReview {
  id: string;
  product_id: string | null;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  merchant_response: string | null;
  created_at: string;
  status: 'approved';
  is_featured_home?: boolean;
  is_featured_contact?: boolean;
  product: { name: string; slug: string } | null;
}

export interface SiteSettings {
  business_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  address: string | null;
  hours: string | null;
  social_links: Record<string, string>;
  structured_data_enabled: boolean;
  footer_notices: Array<{ title: string; body: string }>;
}

type PublicContentState = {
  products: Product[];
  blogs: PublicBlogPost[];
  siteSettings: SiteSettings | null;
  faqs: PublicFaq[];
  reviews: PublicReview[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const PublicContentContext = createContext<PublicContentState | undefined>(undefined);

const formatXOF = (value: number) => new Intl.NumberFormat('fr-FR').format(Number(value || 0)) + ' FCFA';

const jsonArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const jsonObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

export const toProduct = (row: Record<string, any>): Product => {
  const managedGallery = Array.isArray(row.gallery) ? row.gallery : [];
  const legacyGallery = jsonArray(row.gallery_images).map((asset) => ({ public_url: asset.url, alt_text: asset.alt, id: asset.url }));
  const gallery = managedGallery.length ? managedGallery : legacyGallery;
  const primary = gallery.find((asset: any) => String(asset.id) === String(row.primary_media_id)) || gallery[0];
  const regularPrice = Number(row.regular_price_xof ?? row.price_xof ?? 0);
  const salePrice = row.sale_price_xof === null || row.sale_price_xof === undefined ? null : Number(row.sale_price_xof);
  const price = salePrice !== null && salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
  return {
    id: String(row.id),
    sku: String(row.sku || row.reference || row.id),
    reference: String(row.reference || row.sku || ''),
    brand: String(row.brand || ''),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    category: String(row.category || 'montres'),
    priceXOF: price,
    stockStatus: row.stock_status || (Number(row.stock_quantity || 0) > 0 ? 'En stock' : 'Indisponible'),
    stockCount: Number(row.stock_quantity ?? row.stock_count ?? 0),
    status: 'published',
    primaryImage: primary?.public_url || '',
    additionalImages: gallery.map((asset: any, index: number) => ({
      url: asset.public_url,
      alt: asset.alt_text || row.name || '',
      isPrimary: index === 0 || String(asset.id) === String(row.primary_media_id)
    })),
    shortDescription: String(row.short_description || ''),
    valueStoryTitle: String(row.value_story_title || ''),
    valueStoryText: String(row.value_story_text || row.description_html || ''),
    attributes: jsonObject(row.attributes) as any,
    provenanceSummary: String(row.provenance_summary || ''),
    warrantySummary: String(row.warranty_summary || ''),
    deliverySummary: String(row.delivery_summary || ''),
    faq: jsonArray(row.faq).filter((item) => item && typeof item.question === 'string' && typeof item.answer === 'string')
  };
};

export async function publicRequest<T>(path: string): Promise<T> {
  // Public editorial content must reflect an unpublish action immediately. In
  // particular, a browser must never reuse an older response containing an
  // article that has just been returned to draft in the administration portal.
  const response = await fetch(`/api/public${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error('Les données publiques ne sont pas disponibles.');
  return response.json() as Promise<T>;
}

export const PublicContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [blogs, setBlogs] = useState<PublicBlogPost[]>([]);
  // Keep the storefront contact links usable while the current Supabase values
  // are being loaded, then replace this fallback with the singleton settings row.
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(FALLBACK_SITE_SETTINGS);
  const [faqs, setFaqs] = useState<PublicFaq[]>([]);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [productRows, posts, settings, faqRows, reviewRows] = await Promise.all([
        publicRequest<Record<string, any>[]>('/products'),
        publicRequest<PublicBlogPost[]>('/blogs').catch(() => []),
        publicRequest<SiteSettings>('/site-settings').catch(() => null),
        publicRequest<PublicFaq[]>('/faqs').catch(() => []),
        publicRequest<PublicReview[]>('/reviews').catch(() => [])
      ]);
      // An empty Supabase catalogue is intentionally empty on the storefront.
      // This prevents retired demo items from reappearing after an admin deletes
      // or unpublishes the final product in a category.
      setProducts((productRows || []).map(toProduct));
      // A successful Supabase response is authoritative, including when the
      // journal is intentionally empty. Demo articles remain a resilience-only
      // fallback for a temporary public API outage.
      setBlogs(posts || []);
      setSiteSettings(settings || FALLBACK_SITE_SETTINGS);
      setFaqs(faqRows || []);
      setReviews(reviewRows || []);
      setError(null);
    } catch {
      setProducts([]);
      // Blogs have no client-side fallback: only the publication endpoint is
      // authoritative. This prevents bundled demonstration content from ever
      // being mistaken for an article that remains published.
      setBlogs([]);
      setSiteSettings(FALLBACK_SITE_SETTINGS);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const refreshWhenReturningToStorefront = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refreshWhenReturningToStorefront);
    document.addEventListener('visibilitychange', refreshWhenReturningToStorefront);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenReturningToStorefront);
      document.removeEventListener('visibilitychange', refreshWhenReturningToStorefront);
    };
  }, []);

  const value = useMemo(() => ({ products, blogs, siteSettings, faqs, reviews, loading, error, refresh }), [products, blogs, siteSettings, faqs, reviews, loading, error]);
  return <PublicContentContext.Provider value={value}>{children}</PublicContentContext.Provider>;
};

export const usePublicContent = () => {
  const context = useContext(PublicContentContext);
  if (!context) throw new Error('usePublicContent doit être utilisé dans PublicContentProvider.');
  return context;
};

export const usePublicPageMeta = (pageKey: string) => {
  useEffect(() => {
    let active = true;
    void publicRequest<{ title: string; description: string; no_index: boolean; og_title?: string | null; og_description?: string | null; og_image?: string | null } | null>(`/meta/${encodeURIComponent(pageKey)}`)
      .then((meta) => {
        if (!active || !meta) return;
        document.title = meta.title;
        const description = document.querySelector('meta[name="description"]') || document.head.appendChild(document.createElement('meta'));
        description.setAttribute('name', 'description');
        description.setAttribute('content', meta.description);
        let robots = document.querySelector('meta[name="robots"]');
        if (meta.no_index) {
          if (!robots) robots = document.head.appendChild(document.createElement('meta'));
          robots.setAttribute('name', 'robots');
          robots.setAttribute('content', 'noindex, nofollow');
        } else if (robots) {
          robots.remove();
        }
        const setOg = (property: string, content: string | null | undefined) => {
          if (!content) return;
          let element = document.querySelector(`meta[property="${property}"]`);
          if (!element) element = document.head.appendChild(document.createElement('meta'));
          element.setAttribute('property', property);
          element.setAttribute('content', content);
        };
        setOg('og:title', meta.og_title || meta.title);
        setOg('og:description', meta.og_description || meta.description);
        setOg('og:image', meta.og_image);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [pageKey]);
};

export const xof = formatXOF;

import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const requestedPort = Number(process.env.PORT);
const PORT = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MEDIA_BUCKET = 'heritage-media';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminProfile = {
  id: string;
  email: string | null;
  full_name: string;
  role: 'admin';
  is_active: boolean;
};

interface AdminRequest extends Request {
  admin?: AdminProfile;
}

const app = express();
app.use(express.json({ limit: '12mb' }));

const adminRegistrationAttempts = new Map<string, { count: number; resetAt: number }>();

function limitAdminRegistration(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const clientIp = forwarded || req.ip || 'unknown';
  const now = Date.now();
  const existing = adminRegistrationAttempts.get(clientIp);
  const attempt = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + 15 * 60 * 1000 }
    : existing;

  if (attempt.count >= 8) {
    return sendError(res, 429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  }

  attempt.count += 1;
  adminRegistrationAttempts.set(clientIp, attempt);
  next();
}

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  const url = SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  return supabaseAdmin;
}

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

/**
 * Keep database details out of browser responses while telling an authenticated
 * administrator when a failed, transactional CMS migration is the likely cause.
 */
function sendSupabaseFailure(res: Response, error: unknown, fallback: string) {
  console.error('[HERITAGE Supabase]', error);
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(code)) {
    return sendError(res, 503, 'La structure Supabase du portail est incomplète. Exécutez intégralement la migration CMS, puis rechargez le portail.');
  }
  return sendError(res, 503, fallback);
}

function text(value: unknown, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integerValue(value: unknown, fallback = 0) {
  return Math.max(0, Math.round(numberValue(value, fallback)));
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

function jsonValue(value: unknown, fallback: Record<string, unknown> | unknown[] = {}) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  if (value && typeof value === 'object') return value;
  return fallback;
}

function sanitizeHtml(value: unknown) {
  return text(value, 100000)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|base|form|input|button)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:(['"])[\s\S]*?\1|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(?:(['"])?\s*(?:javascript|data:text\/html)[\s\S]*?\1|(?:javascript|data:text\/html)[^\s>]*)/gi, '');
}

function safeFileName(value: string) {
  const extension = path.extname(value).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const base = path.basename(value, path.extname(value)).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 70) || 'image';
  return `${base}${extension}`;
}

function optionalUrl(value: unknown) {
  const candidate = text(value, 2000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function stockStatus(stockQuantity: number, threshold: number, policy: unknown) {
  if (text(policy, 20) === 'on_order') return 'Sur commande';
  if (stockQuantity <= 0) return 'Indisponible';
  if (stockQuantity <= threshold) return 'Stock limité';
  return 'En stock';
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function writeAudit(
  adminId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details: Record<string, unknown> = {}
) {
  try {
    await getSupabaseAdmin().from('admin_audit_logs').insert({
      admin_id: adminId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details
    });
  } catch {
    // A failed audit entry must never block the legitimate management action.
  }
}

async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authorization = req.header('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) {
    return sendError(res, 401, 'Connexion administrateur requise.');
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return sendError(res, 401, 'Session administrateur invalide ou expirée.');
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
      return sendError(res, 403, 'Accès réservé aux administrateurs actifs.');
    }

    req.admin = profile as AdminProfile;
    void admin.from('profiles').update({ last_signed_in_at: new Date().toISOString() }).eq('id', profile.id);
    next();
  } catch {
    return sendError(res, 503, 'Le service administrateur est indisponible.');
  }
}

function productPayload(body: Record<string, unknown>, adminId: string) {
  const name = text(body.name, 180);
  const candidateSlug = text(body.slug, 140) || slugify(name);
  const suppliedReference = text(body.reference, 100);
  const sku = text(body.sku, 100) || suppliedReference || `HRT-${candidateSlug.toUpperCase()}`;
  const reference = suppliedReference || sku;
  const salePrice = body.sale_price_xof === '' || body.sale_price_xof === null
    ? null
    : numberValue(body.sale_price_xof, 0);
  const regularPrice = numberValue(body.regular_price_xof, 0);
  const stockQuantity = integerValue(body.stock_quantity, 0);
  const lowStockThreshold = integerValue(body.low_stock_threshold, 2);
  const stockPolicy = text(body.stock_policy, 30) === 'on_order' ? 'on_order' : 'standard';
  const category = ['montres', 'parfums', 'lunettes'].includes(text(body.category, 80))
    ? text(body.category, 80)
    : 'montres';

  return {
    name,
    slug: candidateSlug,
    sku,
    reference,
    brand: text(body.brand, 100) || null,
    category,
    short_description: text(body.short_description, 1000) || null,
    description_html: sanitizeHtml(body.description_html),
    purchase_price_xof: numberValue(body.purchase_price_xof, 0),
    regular_price_xof: regularPrice,
    sale_price_xof: salePrice,
    stock_quantity: stockQuantity,
    low_stock_threshold: lowStockThreshold,
    stock_policy: stockPolicy,
    status: ['draft', 'published', 'archived'].includes(text(body.status, 20))
      ? text(body.status, 20)
      : 'draft',
    primary_media_id: text(body.primary_media_id, 80) || null,
    attributes: jsonValue(body.attributes, {}),
    colors: jsonValue(body.colors, []),
    faq: jsonValue(body.faq, []),
    seo_title: text(body.seo_title, 180) || null,
    seo_description: text(body.seo_description, 320) || null,
    // Legacy fields are maintained so that an existing HERITAGE catalogue
    // remains compatible during the transition to the richer model.
    price_xof: salePrice ?? regularPrice,
    stock_count: stockQuantity,
    stock_status: stockQuantity > 0 ? 'En stock' : 'Rupture de stock',
    primary_image: optionalUrl(body.primary_image) || text(body.primary_image, 2000) || undefined,
    value_story_title: text(body.value_story_title, 300) || null,
    value_story_text: text(body.value_story_text, 6000) || null,
    provenance_summary: text(body.provenance_summary, 2000) || null,
    warranty_summary: text(body.warranty_summary, 2000) || null,
    delivery_summary: text(body.delivery_summary, 2000) || null,
    created_by: adminId
  };
}

async function validatePublishableProduct(payload: ReturnType<typeof productPayload>) {
  if (payload.status !== 'published') return null;
  if (!payload.name || !payload.category || numberValue(payload.regular_price_xof) <= 0) {
    return 'Un produit publié doit avoir un nom, une catégorie et un prix normal de vente supérieur à zéro.';
  }
  if (payload.sale_price_xof !== null && (
    numberValue(payload.sale_price_xof) <= 0 || numberValue(payload.sale_price_xof) >= numberValue(payload.regular_price_xof)
  )) {
    return 'Le prix promotionnel doit être positif et strictement inférieur au prix normal.';
  }
  if (!payload.primary_media_id && !payload.primary_image) {
    return 'Un produit publié doit comporter au moins une image principale.';
  }
  if (payload.primary_media_id) {
    const { data: media, error } = await getSupabaseAdmin()
      .from('media_assets')
      .select('alt_text, is_ai_generated')
      .eq('id', String(payload.primary_media_id))
      .maybeSingle();
    if (error || !media || !text(media.alt_text, 300) || media.is_ai_generated) {
      return 'L’image principale doit avoir un texte alternatif et ne peut pas être marquée comme générée par IA.';
    }
  }
  return null;
}

const resourceDefinitions = {
  reviews: {
    table: 'product_reviews',
    fields: ['product_id', 'author_name', 'author_email', 'rating', 'title', 'body', 'status', 'verified_purchase', 'manually_validated', 'is_featured_home', 'is_featured_contact', 'merchant_response']
  },
  blogs: {
    table: 'blog_posts',
    fields: ['title', 'slug', 'excerpt', 'content_html', 'cover_media_id', 'cover_image', 'status', 'published_at', 'category', 'tags', 'related_product_ids', 'seo_title', 'seo_description']
  },
  faqs: {
    table: 'faqs',
    fields: ['placement', 'placements', 'category', 'question', 'answer_html', 'sort_order', 'is_active']
  },
  legal: {
    table: 'legal_pages',
    fields: ['page_key', 'title', 'content_html', 'status', 'published_at']
  },
  meta: {
    table: 'page_meta',
    fields: ['page_key', 'title', 'description', 'og_title', 'og_description', 'og_media_id', 'no_index']
  },
  pixels: {
    table: 'tracking_pixels',
    fields: ['provider', 'label', 'pixel_id', 'script_code', 'is_active', 'requires_consent', 'is_test']
  }
} as const;

type ResourceKey = keyof typeof resourceDefinitions;

function resourcePayload(resource: ResourceKey, body: Record<string, unknown>, adminId: string) {
  const definition = resourceDefinitions[resource];
  const payload: Record<string, unknown> = {};

  definition.fields.forEach((field) => {
    if (!(field in body)) return;
    payload[field] = body[field];
  });

  if (resource === 'blogs') {
    payload.title = text(payload.title, 180);
    payload.slug = text(payload.slug, 140) || slugify(String(payload.title || ''));
    payload.excerpt = text(payload.excerpt, 600) || null;
    payload.content_html = sanitizeHtml(payload.content_html);
    payload.status = ['draft', 'scheduled', 'published', 'archived'].includes(text(payload.status, 20))
      ? payload.status
      : 'draft';
    payload.category = text(payload.category, 100) || null;
    payload.cover_image = optionalUrl(payload.cover_image) || text(payload.cover_image, 2000) || null;
    payload.tags = jsonValue(payload.tags, []);
    payload.related_product_ids = jsonValue(payload.related_product_ids, []);
    payload.author_id = adminId;
    if (payload.status === 'published' && !payload.published_at) payload.published_at = new Date().toISOString();
    if (payload.status === 'scheduled') {
      const scheduledAt = new Date(String(payload.published_at || ''));
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) payload.status = 'draft';
    }
  }

  if (resource === 'faqs') {
    payload.question = text(payload.question, 400);
    payload.answer_html = sanitizeHtml(payload.answer_html);
    payload.sort_order = integerValue(payload.sort_order, 0);
    payload.placement = ['home', 'catalog', 'contact', 'all'].includes(text(payload.placement, 20))
      ? payload.placement
      : 'all';
    const placements = jsonValue(payload.placements, []);
    payload.placements = Array.isArray(placements)
      ? placements.filter((placement) => ['home', 'catalog', 'contact'].includes(String(placement)))
      : payload.placement === 'all' ? ['home', 'catalog', 'contact'] : [payload.placement];
    payload.category = text(payload.category, 100) || null;
  }

  if (resource === 'legal') {
    payload.page_key = text(payload.page_key, 80);
    payload.title = text(payload.title, 180);
    payload.content_html = sanitizeHtml(payload.content_html);
    payload.status = text(payload.status, 20) === 'published' ? 'published' : 'draft';
    if (payload.status === 'published' && !payload.published_at) payload.published_at = new Date().toISOString();
    payload.updated_by = adminId;
  }

  if (resource === 'meta') {
    payload.page_key = text(payload.page_key, 120);
    payload.title = text(payload.title, 180);
    payload.description = text(payload.description, 320);
    payload.og_title = text(payload.og_title, 180) || null;
    payload.og_description = text(payload.og_description, 320) || null;
    payload.no_index = Boolean(payload.no_index);
    payload.updated_by = adminId;
  }

  if (resource === 'reviews') {
    payload.author_name = text(payload.author_name, 160);
    payload.author_email = text(payload.author_email, 180) || null;
    payload.title = text(payload.title, 180) || null;
    payload.body = text(payload.body, 5000);
    payload.rating = Math.min(5, Math.max(1, integerValue(payload.rating, 5)));
    payload.status = ['pending', 'approved', 'rejected'].includes(text(payload.status, 20))
      ? payload.status
      : 'pending';
    payload.verified_purchase = Boolean(payload.verified_purchase);
    payload.manually_validated = Boolean(payload.manually_validated);
    payload.is_featured_home = Boolean(payload.is_featured_home);
    payload.is_featured_contact = Boolean(payload.is_featured_contact);
    payload.merchant_response = text(payload.merchant_response, 3000) || null;
    if (payload.status === 'approved' && !payload.verified_purchase && !payload.manually_validated) {
      payload.status = 'pending';
    }
    if (payload.merchant_response) {
      payload.responded_at = new Date().toISOString();
      payload.responded_by = adminId;
    }
  }

  if (resource === 'pixels') {
    const provider = text(payload.provider, 30);
    if (!['meta', 'google_ads', 'google_analytics'].includes(provider)) throw new Error('Plateforme de tracking non autorisée.');
    payload.provider = provider;
    payload.label = text(payload.label, 160);
    payload.pixel_id = text(payload.pixel_id, 200) || null;
    payload.script_code = null;
    payload.is_active = Boolean(payload.is_active);
    payload.requires_consent = payload.requires_consent !== false;
    payload.is_test = Boolean(payload.is_test);
    payload.created_by = adminId;
  }

  return payload;
}

// Public health check does not reveal configuration or customer data.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Account creation is deliberately the only unauthenticated admin endpoint.
// A one-hour, single-use code generated by an existing administrator is required.
app.post('/api/admin/auth/create-account', limitAdminRegistration, async (req: Request, res: Response) => {
  const email = text(req.body?.email, 180).toLowerCase();
  const password = String(req.body?.password || '');
  const fullName = text(req.body?.fullName, 160);
  const code = text(req.body?.invitationCode, 80).toUpperCase();

  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || !fullName || !code) {
    return sendError(res, 400, 'Vérifiez le nom, l’e-mail, le mot de passe de 12 caractères et le code d’invitation.');
  }

  try {
    const admin = getSupabaseAdmin();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    // Reserve the code before creating the Auth user. This makes it genuinely
    // single-use even if two requests arrive at the same instant.
    const { data: invitation } = await admin
      .from('admin_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle();

    if (!invitation) {
      return sendError(res, 400, 'Le code est invalide, expiré ou a déjà été utilisé.');
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: 'admin' }
    });

    if (createError || !created.user) {
      return sendError(res, 400, 'La création du compte est impossible. Vérifiez que cet e-mail n’est pas déjà utilisé.');
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id,
      email,
      full_name: fullName,
      role: 'admin',
      is_active: true
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return sendError(res, 500, 'Le profil administrateur n’a pas pu être créé.');
    }

    await admin
      .from('admin_invitations')
      .update({ used_by: created.user.id })
      .eq('id', invitation.id);
    await writeAudit(created.user.id, 'admin_created', 'admin', created.user.id, { source: 'invitation' });

    return res.status(201).json({ success: true });
  } catch {
    return sendError(res, 503, 'Le service de création de compte est indisponible.');
  }
});

// ---------------------------------------------------------------------------
// Public read API. These endpoints deliberately return only content eligible
// for publication; no service key or private customer data reaches the browser.
// ---------------------------------------------------------------------------
async function hydratePublishedProducts(rows: Record<string, any>[]) {
  const productIds = rows.map((row) => String(row.id));
  const primaryMediaIds = rows.map((row) => row.primary_media_id).filter(Boolean);
  const admin = getSupabaseAdmin();
  const [ownedMediaResult, primaryMediaResult, variantsResult] = await Promise.all([
    productIds.length
      ? admin.from('media_assets').select('id, product_id, public_url, file_name, alt_text, sort_order, is_ai_generated').in('product_id', productIds).eq('is_ai_generated', false).order('sort_order')
      : Promise.resolve({ data: [], error: null }),
    primaryMediaIds.length
      ? admin.from('media_assets').select('id, public_url, file_name, alt_text, sort_order, is_ai_generated').in('id', primaryMediaIds).eq('is_ai_generated', false)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? admin.from('product_variants').select('id, product_id, name, sku, options, sale_price_xof, stock_quantity, is_active').in('product_id', productIds).eq('is_active', true)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (ownedMediaResult.error || primaryMediaResult.error || variantsResult.error) {
    throw ownedMediaResult.error || primaryMediaResult.error || variantsResult.error;
  }
  const byProduct = new Map<string, any[]>();
  (ownedMediaResult.data || []).forEach((asset: any) => {
    const entries = byProduct.get(String(asset.product_id)) || [];
    entries.push(asset);
    byProduct.set(String(asset.product_id), entries);
  });
  const byMediaId = new Map((primaryMediaResult.data || []).map((asset: any) => [String(asset.id), asset]));
  const variantsByProduct = new Map<string, any[]>();
  (variantsResult.data || []).forEach((variant: any) => {
    const entries = variantsByProduct.get(String(variant.product_id)) || [];
    entries.push(variant);
    variantsByProduct.set(String(variant.product_id), entries);
  });

  return rows.map((row) => {
    const gallery = [...(byProduct.get(String(row.id)) || [])];
    const primaryAsset = row.primary_media_id ? byMediaId.get(String(row.primary_media_id)) : null;
    if (primaryAsset && !gallery.some((asset) => asset.id === primaryAsset.id)) gallery.unshift(primaryAsset);
    return {
      ...row,
      stock_status: stockStatus(Number(row.stock_quantity || 0), Number(row.low_stock_threshold || 0), row.stock_policy),
      gallery,
      variants: variantsByProduct.get(String(row.id)) || []
    };
  });
}

app.get('/api/public/products', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .select('id, name, slug, sku, reference, brand, category, short_description, description_html, purchase_price_xof, regular_price_xof, sale_price_xof, stock_quantity, low_stock_threshold, stock_policy, attributes, colors, faq, primary_media_id, primary_image, gallery_images, value_story_title, value_story_text, provenance_summary, warranty_summary, delivery_summary, seo_title, seo_description, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json(await hydratePublishedProducts(data || []));
  } catch {
    sendError(res, 503, 'Le catalogue est temporairement indisponible.');
  }
});

app.get('/api/public/blogs', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('blog_posts')
      .select('id, title, slug, excerpt, content_html, cover_media_id, cover_image, status, published_at, category, tags, related_product_ids, seo_title, seo_description, updated_at')
      .in('status', ['published', 'scheduled'])
      .order('published_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    const visible = (data || []).filter((post: any) => post.status === 'published' || (post.published_at && new Date(post.published_at) <= new Date()));
    const mediaIds = visible.map((post: any) => post.cover_media_id).filter(Boolean);
    const { data: assets, error: mediaError } = mediaIds.length
      ? await getSupabaseAdmin().from('media_assets').select('id, public_url, alt_text').in('id', mediaIds)
      : { data: [], error: null };
    if (mediaError) throw mediaError;
    const covers = new Map((assets || []).map((asset: any) => [String(asset.id), asset]));
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json(visible.map((post: any) => ({ ...post, cover: post.cover_media_id ? covers.get(String(post.cover_media_id)) || null : post.cover_image ? { public_url: post.cover_image, alt_text: post.title } : null })));
  } catch {
    sendError(res, 503, 'Le journal est temporairement indisponible.');
  }
});

app.get('/api/public/faqs', async (req: Request, res: Response) => {
  const placement = ['home', 'catalog', 'contact'].includes(String(req.query.placement || ''))
    ? String(req.query.placement)
    : '';
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('faqs')
      .select('id, question, answer_html, category, placement, placements, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    const filtered = (data || []).filter((faq: any) => {
      const placements = Array.isArray(faq.placements) ? faq.placements : [];
      return !placement || placements.includes(placement) || faq.placement === placement || faq.placement === 'all';
    });
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json(filtered);
  } catch {
    sendError(res, 503, 'La foire aux questions est temporairement indisponible.');
  }
});

app.get('/api/public/reviews', async (req: Request, res: Response) => {
  const placement = String(req.query.placement || '');
  const productId = text(req.query.product_id, 120);
  try {
    let query = getSupabaseAdmin()
      .from('product_reviews')
      .select('id, product_id, author_name, rating, title, body, merchant_response, created_at, is_featured_home, is_featured_contact')
      .eq('status', 'approved')
      .or('verified_purchase.eq.true,manually_validated.eq.true')
      .order('created_at', { ascending: false });
    if (productId) query = query.eq('product_id', productId);
    const { data, error } = await query.limit(placement ? 12 : 100);
    if (error) throw error;
    const featured = (data || []).filter((review: any) => placement === 'home'
      ? review.is_featured_home
      : placement === 'contact'
        ? review.is_featured_contact
        : true);
    const productIds = featured.map((review: any) => review.product_id).filter(Boolean);
    const { data: products, error: productError } = productIds.length
      ? await getSupabaseAdmin().from('products').select('id, name, slug').in('id', productIds)
      : { data: [], error: null };
    if (productError) throw productError;
    const productsById = new Map((products || []).map((product: any) => [String(product.id), product]));
    res.json(featured.map((review: any) => ({ ...review, product: review.product_id ? productsById.get(String(review.product_id)) || null : null })));
  } catch {
    sendError(res, 503, 'Les avis sont temporairement indisponibles.');
  }
});

app.get('/api/public/site-settings', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('site_settings')
      .select('business_name, email, phone, whatsapp_phone, address, hours, social_links, structured_data_enabled, footer_notices, updated_at')
      .eq('id', true)
      .single();
    if (error) throw error;
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(data);
  } catch {
    sendError(res, 503, 'Les coordonnées sont temporairement indisponibles.');
  }
});

app.get('/api/public/legal/:pageKey', async (req: Request, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('legal_pages')
      .select('page_key, title, content_html, updated_at, published_at')
      .eq('page_key', text(req.params.pageKey, 80))
      .eq('status', 'published')
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 404, 'Cette page n’est pas encore publiée.');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(data);
  } catch {
    sendError(res, 503, 'La page légale est temporairement indisponible.');
  }
});

app.get('/api/public/meta/:pageKey', async (req: Request, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('page_meta')
      .select('page_key, title, description, og_title, og_description, no_index, og_media_id')
      .eq('page_key', text(req.params.pageKey, 120))
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.json(null);
    const { data: media, error: mediaError } = data.og_media_id
      ? await getSupabaseAdmin().from('media_assets').select('public_url').eq('id', data.og_media_id).maybeSingle()
      : { data: null, error: null };
    if (mediaError) throw mediaError;
    res.json({ ...data, og_image: media?.public_url || null });
  } catch {
    sendError(res, 503, 'Les métadonnées sont temporairement indisponibles.');
  }
});

app.get('/api/public/tracking', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('tracking_pixels')
      .select('provider, label, pixel_id, requires_consent, is_test')
      .eq('is_active', true)
      .eq('is_test', false);
    if (error) throw error;
    // Custom arbitrary scripts are never sent to visitors: identifiers for the
    // approved providers are safer and are sufficient for Meta/Google tracking.
    res.json(data || []);
  } catch {
    sendError(res, 503, 'Les paramètres de suivi sont temporairement indisponibles.');
  }
});

app.post('/api/public/contact-messages', limitAdminRegistration, async (req: Request, res: Response) => {
  const payload = {
    full_name: text(req.body?.full_name, 160),
    email: text(req.body?.email, 180).toLowerCase(),
    phone: text(req.body?.phone, 80),
    subject: text(req.body?.subject, 180),
    message: text(req.body?.message, 5000)
  };
  if (!payload.full_name || !/^\S+@\S+\.\S+$/.test(payload.email) || !payload.phone || !payload.message) {
    return sendError(res, 400, 'Veuillez renseigner votre nom, votre e-mail, votre téléphone et votre message.');
  }
  try {
    const { error } = await getSupabaseAdmin().from('contact_messages').insert(payload);
    if (error) throw error;
    res.status(201).json({ success: true });
  } catch {
    sendError(res, 503, 'Votre message ne peut pas être transmis pour le moment.');
  }
});

app.use('/api/admin', requireAdmin);

app.get('/api/admin/session', (req: AdminRequest, res: Response) => {
  res.json({ admin: req.admin });
});

app.get('/api/admin/dashboard', async (req: AdminRequest, res: Response) => {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(now.getDate() - 29);
  const from = new Date(text(req.query.from, 40) || defaultFrom.toISOString());
  const to = new Date(text(req.query.to, 40) || now.toISOString());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return sendError(res, 400, 'La période sélectionnée est invalide.');
  }
  try {
    const admin = getSupabaseAdmin();
    // Requetes principales — toutes obligatoires pour le dashboard
    const [ordersResult, recentResult, productsResult, reviewsResult, usersResult] = await Promise.all([
      admin.from('orders').select('id, order_number, total_xof, status, created_at').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()).order('created_at', { ascending: true }),
      admin.from('orders').select('id, order_number, customer_name, customer_email, total_xof, status, created_at').order('created_at', { ascending: false }).limit(8),
      admin.from('products').select('id, name, slug, stock_quantity, low_stock_threshold, stock_policy, status').neq('status', 'archived').order('stock_quantity', { ascending: true }),
      admin.from('product_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer').gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (recentResult.error) throw recentResult.error;
    if (productsResult.error) throw productsResult.error;
    if (reviewsResult.error) throw reviewsResult.error;
    if (usersResult.error) throw usersResult.error;

    // contact_messages : isolation — la table peut ne pas encore exister (42P01)
    let unreadMessages = 0;
    try {
      const contactsResult = await admin
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unread');
      const errCode = contactsResult.error && 'code' in contactsResult.error ? String((contactsResult.error as { code?: unknown }).code || '') : '';
      if (!contactsResult.error || ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(errCode)) {
        unreadMessages = contactsResult.count || 0;
      }
    } catch {
      // Table contact_messages absente : le dashboard continue avec 0 messages non lus
    }

    // Suppression de la variable inutilisee (satisfait TypeScript strict)
    void usersResult;

    const orders = ordersResult.data || [];
    const products = productsResult.data || [];
    const revenueOrders = orders.filter((order: any) => ['paid', 'processing', 'shipped_or_ready', 'delivered'].includes(order.status));
    const revenueXOF = revenueOrders.reduce((sum, order: any) => sum + Number(order.total_xof || 0), 0);

    // Statuts : on n'inclut que ceux ayant au moins une commande
    const allStatuses = ['pending_payment', 'payment_pending', 'paid', 'processing', 'shipped_or_ready', 'delivered', 'cancelled', 'refunded', 'payment_failed'];
    const statuses = Object.fromEntries(
      allStatuses
        .map((status) => [status, orders.filter((order: any) => order.status === status).length] as [string, number])
        .filter(([, count]) => count > 0)
    );

    const lowStockProducts = products.filter((product: any) =>
      product.stock_policy !== 'on_order' &&
      Number(product.stock_quantity || 0) <= Number(product.low_stock_threshold || 0)
    );

    // Graphique CA + commandes par jour, trie chronologiquement
    const points = new Map<string, { date: string; revenueXOF: number; orders: number }>();
    orders.forEach((order: any) => {
      const date = new Date(order.created_at).toISOString().slice(0, 10);
      const point = points.get(date) || { date, revenueXOF: 0, orders: 0 };
      point.orders += 1;
      if (['paid', 'processing', 'shipped_or_ready', 'delivered'].includes(order.status)) {
        point.revenueXOF += Number(order.total_xof || 0);
      }
      points.set(date, point);
    });
    const chart = [...points.values()].sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        revenueXOF,
        orders: orders.length,
        averageCartXOF: revenueOrders.length ? Math.round(revenueXOF / revenueOrders.length) : 0,
        lowStock: lowStockProducts.length,
        pendingReviews: reviewsResult.count || 0,
        unreadMessages,
        newCustomers: usersResult.count || 0,
        statuses
      },
      chart,
      recentOrders: recentResult.data || [],
      lowStockProducts: lowStockProducts.slice(0, 8).map((product: any) => ({
        ...product,
        stock_status: stockStatus(product.stock_quantity, product.low_stock_threshold, product.stock_policy)
      }))
    });
  } catch (error) {
    sendSupabaseFailure(res, error, 'Les statistiques sont indisponibles.');
  }
});

app.get('/api/admin/products', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .select('*, product_variants(*), media_assets(*)')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    sendSupabaseFailure(res, error, 'Le catalogue est indisponible.');
  }
});

app.post('/api/admin/products', async (req: AdminRequest, res: Response) => {
  const payload = productPayload(req.body || {}, req.admin!.id);
  payload.primary_image ||= '';
  if (!payload.name || !payload.slug) return sendError(res, 400, 'Le nom et le lien produit sont obligatoires.');
  const publicationError = await validatePublishableProduct(payload);
  if (publicationError) return sendError(res, 400, publicationError);

  try {
    const { data, error } = await getSupabaseAdmin().from('products').insert(payload).select().single();
    if (error) throw error;
    if (Number(payload.stock_quantity) !== 0) {
      await getSupabaseAdmin().from('stock_movements').insert({
        product_id: data.id,
        quantity_delta: Number(payload.stock_quantity),
        reason: 'initial',
        note: 'Stock initial à la création du produit.',
        created_by: req.admin!.id
      });
    }
    await writeAudit(req.admin!.id, 'created', 'product', data.id, { name: data.name });
    res.status(201).json(data);
  } catch {
    sendError(res, 400, 'Impossible d’enregistrer ce produit. Vérifiez l’unicité du lien, SKU ou de la référence.');
  }
});

app.patch('/api/admin/products/:id', async (req: AdminRequest, res: Response) => {
  const payload = productPayload(req.body || {}, req.admin!.id);
  delete (payload as { created_by?: string }).created_by;
  const publicationError = await validatePublishableProduct(payload);
  if (publicationError) return sendError(res, 400, publicationError);

  try {
    const admin = getSupabaseAdmin();
    const { data: before, error: beforeError } = await admin.from('products').select('stock_quantity').eq('id', req.params.id).single();
    if (beforeError) throw beforeError;
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    const delta = Number(payload.stock_quantity) - Number(before.stock_quantity || 0);
    if (delta !== 0) {
      await admin.from('stock_movements').insert({
        product_id: data.id,
        quantity_delta: delta,
        reason: 'adjustment',
        note: text(req.body?.stock_note, 500) || 'Ajustement depuis la fiche produit.',
        created_by: req.admin!.id
      });
    }
    await writeAudit(req.admin!.id, 'updated', 'product', data.id, { name: data.name });
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour du produit a échoué.');
  }
});

app.post('/api/admin/products/bulk', async (req: AdminRequest, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => text(id, 120)).filter(Boolean) : [];
  const action = text(req.body?.action, 30);
  if (!ids.length || !['publish', 'unpublish', 'archive', 'delete'].includes(action)) {
    return sendError(res, 400, 'Sélection ou action groupée invalide.');
  }
  try {
    const admin = getSupabaseAdmin();
    if (action === 'delete') {
      const { error } = await admin.from('products').delete().in('id', ids);
      if (error) throw error;
    } else {
      const status = action === 'publish' ? 'published' : action === 'archive' ? 'archived' : 'draft';
      if (status === 'published') {
        const { data: candidates, error: lookupError } = await admin.from('products').select('*').in('id', ids);
        if (lookupError) throw lookupError;
        for (const candidate of candidates || []) {
          const invalid = await validatePublishableProduct(candidate as ReturnType<typeof productPayload>);
          if (invalid) return sendError(res, 400, `« ${candidate.name} » ne peut pas être publié : ${invalid}`);
        }
      }
      const { error } = await admin.from('products').update({ status }).in('id', ids);
      if (error) throw error;
    }
    await writeAudit(req.admin!.id, action, 'product_batch', ids.join(','), { count: ids.length });
    res.json({ success: true, count: ids.length });
  } catch {
    sendError(res, 400, 'L’action groupée a échoué.');
  }
});

app.get('/api/admin/products/export.csv', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .select('name, slug, sku, reference, brand, category, regular_price_xof, sale_price_xof, purchase_price_xof, stock_quantity, low_stock_threshold, status')
      .order('name');
    if (error) throw error;
    const columns = ['name', 'slug', 'sku', 'reference', 'brand', 'category', 'regular_price_xof', 'sale_price_xof', 'purchase_price_xof', 'stock_quantity', 'low_stock_threshold', 'status'];
    const csv = [columns.join(','), ...(data || []).map((row: any) => columns.map((column) => csvCell(row[column])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="heritage-produits.csv"');
    res.send(`\ufeff${csv}`);
  } catch {
    sendError(res, 503, 'L’export du catalogue est indisponible.');
  }
});

app.delete('/api/admin/products/:id', async (req: AdminRequest, res: Response) => {
  try {
    const { error } = await getSupabaseAdmin().from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    await writeAudit(req.admin!.id, 'deleted', 'product', req.params.id);
    res.status(204).end();
  } catch {
    sendError(res, 400, 'La suppression du produit a échoué.');
  }
});

app.put('/api/admin/products/:id/variants', async (req: AdminRequest, res: Response) => {
  const variants = Array.isArray(req.body?.variants) ? req.body.variants : [];
  const productId = req.params.id;

  try {
    const admin = getSupabaseAdmin();
    const { error: deleteError } = await admin.from('product_variants').delete().eq('product_id', productId);
    if (deleteError) throw deleteError;

    const prepared = variants
      .map((variant: Record<string, unknown>) => ({
        product_id: productId,
        name: text(variant.name, 160),
        sku: text(variant.sku, 100) || null,
        options: jsonValue(variant.options, {}),
        purchase_price_xof: variant.purchase_price_xof === '' ? null : numberValue(variant.purchase_price_xof, 0),
        sale_price_xof: variant.sale_price_xof === '' ? null : numberValue(variant.sale_price_xof, 0),
        stock_quantity: integerValue(variant.stock_quantity, 0),
        is_active: variant.is_active !== false
      }))
      .filter((variant: { name: string }) => variant.name);

    if (prepared.length) {
      const { error: insertError } = await admin.from('product_variants').insert(prepared);
      if (insertError) throw insertError;
    }

    await writeAudit(req.admin!.id, 'updated_variants', 'product', productId, { count: prepared.length });
    res.json({ success: true, count: prepared.length });
  } catch {
    sendError(res, 400, 'La mise à jour des variantes a échoué.');
  }
});

app.put('/api/admin/products/:id/media', async (req: AdminRequest, res: Response) => {
  const mediaIds = Array.isArray(req.body?.media_ids) ? req.body.media_ids.map((id: unknown) => text(id, 80)).filter(Boolean) : [];
  const primaryMediaId = text(req.body?.primary_media_id, 80) || mediaIds[0] || null;
  try {
    const admin = getSupabaseAdmin();
    if (mediaIds.length) {
      const { data: assets, error: assetsError } = await admin
        .from('media_assets')
        .select('id, alt_text, is_ai_generated')
        .in('id', mediaIds);
      if (assetsError || (assets || []).length !== mediaIds.length || (assets || []).some((asset: any) => !text(asset.alt_text, 300) || asset.is_ai_generated)) {
        return sendError(res, 400, 'Chaque image doit avoir un texte alternatif et ne peut pas être générée par IA.');
      }
    }
    const { error: unlinkError } = await admin.from('media_assets').update({ product_id: null }).eq('product_id', req.params.id);
    if (unlinkError) throw unlinkError;
    const { error: unlinkRelationsError } = await admin.from('product_media').delete().eq('product_id', req.params.id);
    if (unlinkRelationsError) throw unlinkRelationsError;
    for (const [index, mediaId] of mediaIds.entries()) {
      const { error } = await admin.from('media_assets').update({ product_id: req.params.id, sort_order: index }).eq('id', mediaId);
      if (error) throw error;
    }
    if (mediaIds.length) {
      const { error: relationError } = await admin.from('product_media').insert(mediaIds.map((mediaId, position) => ({ product_id: req.params.id, media_id: mediaId, position })));
      if (relationError) throw relationError;
    }
    const { error: productError } = await admin.from('products').update({ primary_media_id: primaryMediaId }).eq('id', req.params.id);
    if (productError) throw productError;
    await writeAudit(req.admin!.id, 'updated_media', 'product', req.params.id, { count: mediaIds.length });
    res.json({ success: true, media_ids: mediaIds, primary_media_id: primaryMediaId });
  } catch {
    sendError(res, 400, 'La galerie produit n’a pas pu être enregistrée.');
  }
});

app.get('/api/admin/products/:id/stock-movements', async (req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('stock_movements')
      .select('*')
      .eq('product_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch {
    sendError(res, 503, 'L’historique de stock est indisponible.');
  }
});

app.post('/api/admin/products/:id/stock-movements', async (req: AdminRequest, res: Response) => {
  const quantityDelta = Math.round(numberValue(req.body?.quantity_delta, 0));
  const reason = ['adjustment', 'return', 'correction'].includes(text(req.body?.reason, 30)) ? text(req.body?.reason, 30) : 'adjustment';
  if (!quantityDelta) return sendError(res, 400, 'Le mouvement de stock doit être différent de zéro.');
  try {
    const admin = getSupabaseAdmin();
    const { data: product, error: productError } = await admin.from('products').select('stock_quantity').eq('id', req.params.id).single();
    if (productError) throw productError;
    const nextQuantity = Number(product.stock_quantity || 0) + quantityDelta;
    if (nextQuantity < 0) return sendError(res, 400, 'Le stock ne peut pas devenir négatif.');
    const { error: updateError } = await admin.from('products').update({ stock_quantity: nextQuantity, stock_count: nextQuantity }).eq('id', req.params.id);
    if (updateError) throw updateError;
    const { data, error } = await admin.from('stock_movements').insert({
      product_id: req.params.id,
      quantity_delta: quantityDelta,
      reason,
      note: text(req.body?.note, 500) || null,
      created_by: req.admin!.id
    }).select().single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'stock_movement', 'product', req.params.id, { quantityDelta, reason });
    res.status(201).json({ movement: data, stock_quantity: nextQuantity });
  } catch {
    sendError(res, 400, 'Le mouvement de stock a échoué.');
  }
});

app.get('/api/admin/orders', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch {
    sendError(res, 503, 'Les commandes sont indisponibles.');
  }
});

app.get('/api/admin/orders/export.csv', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('orders')
      .select('order_number, customer_name, customer_email, customer_phone, total_xof, status, payment_method, payment_reference, delivery_reference, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const columns = ['order_number', 'customer_name', 'customer_email', 'customer_phone', 'total_xof', 'status', 'payment_method', 'payment_reference', 'delivery_reference', 'created_at'];
    const csv = [columns.join(','), ...(data || []).map((row: any) => columns.map((column) => csvCell(row[column])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="heritage-commandes.csv"');
    res.send(`\ufeff${csv}`);
  } catch {
    sendError(res, 503, 'L’export des commandes est indisponible.');
  }
});

app.patch('/api/admin/orders/:id', async (req: AdminRequest, res: Response) => {
  const status = text(req.body?.status, 40);
  const deliveryReference = text(req.body?.delivery_reference, 180) || null;
  const deliveryProofUrl = optionalUrl(req.body?.delivery_proof_url);
  const allowed = ['pending_payment', 'payment_pending', 'paid', 'processing', 'shipped_or_ready', 'delivered', 'cancelled', 'refunded', 'payment_failed'];
  if (!allowed.includes(status)) return sendError(res, 400, 'Statut de commande invalide.');
  if (status === 'delivered' && !deliveryReference && !deliveryProofUrl) {
    return sendError(res, 400, 'Une référence ou une preuve de livraison est obligatoire avant de marquer une commande comme livrée.');
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: current, error: currentError } = await admin
      .from('orders')
      .select('status_history, delivery_reference, delivery_proof_url')
      .eq('id', req.params.id)
      .single();
    if (currentError) throw currentError;

    const statusHistory = Array.isArray(current.status_history) ? current.status_history : [];
    statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      note: text(req.body?.note, 500) || `Statut mis à jour par ${req.admin!.full_name || 'un administrateur'}`,
      actor_id: req.admin!.id
    });

    const { data, error } = await admin
      .from('orders')
      .update({
        status,
        status_history: statusHistory,
        delivery_reference: deliveryReference || current.delivery_reference || null,
        delivery_proof_url: deliveryProofUrl || current.delivery_proof_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'updated_status', 'order', req.params.id, { status });
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour de la commande a échoué.');
  }
});

app.get('/api/admin/administrators', async (_req: AdminRequest, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    const [adminsResult, invitationsResult, auditResult] = await Promise.all([
      admin.from('profiles').select('id, email, full_name, is_active, created_at, updated_at, last_signed_in_at').eq('role', 'admin').order('created_at', { ascending: true }),
      admin.from('admin_invitations').select('id, expires_at, created_at, used_at, revoked_at, created_by, used_by').order('created_at', { ascending: false }),
      admin.from('admin_audit_logs').select('id, admin_id, action, entity_type, entity_id, details, created_at').order('created_at', { ascending: false }).limit(30)
    ]);
    if (adminsResult.error || invitationsResult.error || auditResult.error) throw adminsResult.error || invitationsResult.error || auditResult.error;
    res.json({ administrators: adminsResult.data || [], invitations: invitationsResult.data || [], auditLogs: auditResult.data || [] });
  } catch {
    sendError(res, 503, 'La liste des administrateurs est indisponible.');
  }
});

app.patch('/api/admin/administrators/:id', async (req: AdminRequest, res: Response) => {
  const targetId = req.params.id;
  const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : undefined;
  const fullName = 'full_name' in (req.body || {}) ? text(req.body.full_name, 160) : undefined;

  if (targetId === req.admin!.id && isActive === false) {
    return sendError(res, 400, 'Vous ne pouvez pas désactiver votre propre compte.');
  }

  try {
    const payload: Record<string, unknown> = {};
    if (isActive !== undefined) payload.is_active = isActive;
    if (fullName !== undefined) payload.full_name = fullName;
    const admin = getSupabaseAdmin();
    if (isActive !== undefined) {
      const { error: authError } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: isActive ? 'none' : '876000h'
      });
      if (authError) throw authError;
    }
    const { data, error } = await admin.from('profiles').update(payload).eq('id', targetId).eq('role', 'admin').select().single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'updated', 'administrator', targetId, payload);
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour de l’administrateur a échoué.');
  }
});

app.post('/api/admin/invitations', async (req: AdminRequest, res: Response) => {
  try {
    const code = `HRT-${crypto.randomBytes(9).toString('base64url').toUpperCase()}`;
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from('admin_invitations')
      .insert({ code_hash: codeHash, expires_at: expiresAt, created_by: req.admin!.id })
      .select('id, expires_at, created_at')
      .single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'generated', 'admin_invitation', data.id, { expiresAt });
    res.status(201).json({ invitation: data, code });
  } catch {
    sendError(res, 503, 'Le code d’invitation n’a pas pu être généré.');
  }
});

app.patch('/api/admin/invitations/:id/revoke', async (req: AdminRequest, res: Response) => {
  try {
    const { error } = await getSupabaseAdmin()
      .from('admin_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .is('used_at', null);
    if (error) throw error;
    await writeAudit(req.admin!.id, 'revoked', 'admin_invitation', req.params.id);
    res.json({ success: true });
  } catch {
    sendError(res, 400, 'La révocation du code a échoué.');
  }
});

app.get('/api/admin/users', async (_req: AdminRequest, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    const [profilesResult, ordersResult] = await Promise.all([
      admin.from('profiles').select('id, email, full_name, phone, commune, delivery_address, is_active, created_at, updated_at').eq('role', 'customer').order('created_at', { ascending: false }),
      admin.from('orders').select('id, user_id, customer_email, order_number, total_xof, status, created_at').order('created_at', { ascending: false })
    ]);
    if (profilesResult.error || ordersResult.error) throw profilesResult.error || ordersResult.error;
    const orderLookup = new Map<string, any[]>();
    (ordersResult.data || []).forEach((order: any) => {
      const keys = [order.user_id, order.customer_email?.toLowerCase()].filter(Boolean);
      keys.forEach((key) => {
        const existing = orderLookup.get(String(key)) || [];
        existing.push(order);
        orderLookup.set(String(key), existing);
      });
    });
    res.json((profilesResult.data || []).map((profile: any) => {
      const customerOrders = orderLookup.get(String(profile.id)) || orderLookup.get(String(profile.email || '').toLowerCase()) || [];
      return {
        ...profile,
        order_count: customerOrders.length,
        total_spent_xof: customerOrders.filter((order: any) => !['cancelled', 'refunded', 'payment_failed'].includes(order.status)).reduce((sum: number, order: any) => sum + Number(order.total_xof || 0), 0),
        orders: customerOrders.slice(0, 10)
      };
    }));
  } catch {
    sendError(res, 503, 'La liste des utilisateurs est indisponible.');
  }
});

app.patch('/api/admin/users/:id', async (req: AdminRequest, res: Response) => {
  if (typeof req.body?.is_active !== 'boolean') return sendError(res, 400, 'État du compte manquant.');

  try {
    const admin = getSupabaseAdmin();
    const { error: authError } = await admin.auth.admin.updateUserById(req.params.id, {
      ban_duration: req.body.is_active ? 'none' : '876000h'
    });
    if (authError) throw authError;
    const { data, error } = await admin
      .from('profiles')
      .update({ is_active: req.body.is_active })
      .eq('id', req.params.id)
      .eq('role', 'customer')
      .select()
      .single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'updated', 'customer', req.params.id, { is_active: req.body.is_active });
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour de l’utilisateur a échoué.');
  }
});

app.get('/api/admin/users/export.csv', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('profiles')
      .select('full_name, email, phone, commune, is_active, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const columns = ['full_name', 'email', 'phone', 'commune', 'is_active', 'created_at'];
    const csv = [columns.join(','), ...(data || []).map((row: any) => columns.map((column) => csvCell(row[column])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="heritage-utilisateurs.csv"');
    res.send(`\ufeff${csv}`);
  } catch {
    sendError(res, 503, 'L’export des utilisateurs est indisponible.');
  }
});

app.get('/api/admin/contact-messages', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('contact_messages').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch {
    sendError(res, 503, 'Les messages de contact sont indisponibles.');
  }
});

app.patch('/api/admin/contact-messages/:id', async (req: AdminRequest, res: Response) => {
  const status = ['unread', 'read', 'archived'].includes(text(req.body?.status, 20)) ? text(req.body?.status, 20) : '';
  if (!status) return sendError(res, 400, 'Statut de message invalide.');
  try {
    const { data, error } = await getSupabaseAdmin().from('contact_messages').update({
      status,
      read_at: status === 'read' ? new Date().toISOString() : null,
      read_by: status === 'read' ? req.admin!.id : null
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'updated', 'contact_message', req.params.id, { status });
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour du message a échoué.');
  }
});

app.get('/api/admin/media', async (_req: AdminRequest, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    const [mediaResult, productsResult, productMediaResult, blogsResult, metaResult] = await Promise.all([
      admin.from('media_assets').select('*').order('created_at', { ascending: false }),
      admin.from('products').select('id, name, primary_media_id'),
      admin.from('product_media').select('product_id, media_id, products(name)'),
      admin.from('blog_posts').select('id, title, cover_media_id'),
      admin.from('page_meta').select('page_key, og_media_id')
    ]);
    if (mediaResult.error || productsResult.error || productMediaResult.error || blogsResult.error || metaResult.error) throw mediaResult.error || productsResult.error || productMediaResult.error || blogsResult.error || metaResult.error;
    const usage = new Map<string, Array<{ type: string; label: string }>>();
    const addUsage = (mediaId: string | null, type: string, label: string) => {
      if (!mediaId) return;
      const entries = usage.get(String(mediaId)) || [];
      entries.push({ type, label });
      usage.set(String(mediaId), entries);
    };
    (productsResult.data || []).forEach((product: any) => addUsage(product.primary_media_id, 'Produit', product.name));
    (productMediaResult.data || []).forEach((relation: any) => addUsage(relation.media_id, 'Galerie produit', relation.products?.name || relation.product_id));
    (blogsResult.data || []).forEach((post: any) => addUsage(post.cover_media_id, 'Blog', post.title));
    (metaResult.data || []).forEach((meta: any) => addUsage(meta.og_media_id, 'Méta', meta.page_key));
    res.json((mediaResult.data || []).map((asset: any) => ({ ...asset, usage: usage.get(String(asset.id)) || [] })));
  } catch {
    sendError(res, 503, 'La galerie média est indisponible.');
  }
});

app.post('/api/admin/media/upload', async (req: AdminRequest, res: Response) => {
  const fileName = safeFileName(text(req.body?.fileName, 180));
  const mimeType = text(req.body?.mimeType, 80);
  const base64 = text(req.body?.contentBase64, 16 * 1024 * 1024).replace(/^data:[^;]+;base64,/, '');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  const altText = text(req.body?.altText, 300);
  if (!base64 || !allowed.includes(mimeType) || !altText || req.body?.isAiGenerated === true) {
    return sendError(res, 400, 'Utilisez une image JPEG, PNG, WebP ou AVIF avec un texte alternatif. Les images générées par IA ne sont pas acceptées.');
  }

  try {
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) {
      return sendError(res, 400, 'L’image doit peser au maximum 10 Mo.');
    }

    const admin = getSupabaseAdmin();
    const storagePath = `products/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${fileName}`;
    const { error: uploadError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
    const { data, error } = await admin
      .from('media_assets')
      .insert({
        bucket_path: storagePath,
        public_url: publicUrlData.publicUrl,
        file_name: fileName,
        mime_type: mimeType,
        alt_text: altText,
        size_bytes: buffer.length,
        product_id: text(req.body?.productId, 80) || null,
        folder: text(req.body?.folder, 100) || 'general',
        tags: jsonValue(req.body?.tags, []),
        width: integerValue(req.body?.width, 0) || null,
        height: integerValue(req.body?.height, 0) || null,
        is_ai_generated: false,
        uploaded_by: req.admin!.id
      })
      .select()
      .single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'uploaded', 'media', data.id, { fileName });
    res.status(201).json(data);
  } catch {
    sendError(res, 400, 'L’image n’a pas pu être envoyée dans la galerie.');
  }
});

app.patch('/api/admin/media/:id', async (req: AdminRequest, res: Response) => {
  try {
    const altText = text(req.body?.alt_text, 300);
    if (!altText) return sendError(res, 400, 'Le texte alternatif est obligatoire.');
    const { data, error } = await getSupabaseAdmin()
      .from('media_assets')
      .update({
        alt_text: altText,
        product_id: text(req.body?.product_id, 80) || null,
        folder: text(req.body?.folder, 100) || 'general',
        tags: jsonValue(req.body?.tags, []),
        sort_order: integerValue(req.body?.sort_order, 0)
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour du média a échoué.');
  }
});

app.delete('/api/admin/media/:id', async (req: AdminRequest, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    const [productUsage, productGalleryUsage, blogUsage, metaUsage] = await Promise.all([
      admin.from('products').select('id', { count: 'exact', head: true }).eq('primary_media_id', req.params.id),
      admin.from('product_media').select('media_id', { count: 'exact', head: true }).eq('media_id', req.params.id),
      admin.from('blog_posts').select('id', { count: 'exact', head: true }).eq('cover_media_id', req.params.id),
      admin.from('page_meta').select('id', { count: 'exact', head: true }).eq('og_media_id', req.params.id)
    ]);
    if ((productUsage.count || 0) + (productGalleryUsage.count || 0) + (blogUsage.count || 0) + (metaUsage.count || 0) > 0) {
      return sendError(res, 409, 'Cette image est encore utilisée. Retirez-la des contenus concernés avant de la supprimer.');
    }
    const { data: media, error: mediaError } = await admin
      .from('media_assets')
      .select('bucket_path')
      .eq('id', req.params.id)
      .single();
    if (mediaError) throw mediaError;

    const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove([media.bucket_path]);
    if (removeError) throw removeError;
    const { error: deleteError } = await admin.from('media_assets').delete().eq('id', req.params.id);
    if (deleteError) throw deleteError;
    await writeAudit(req.admin!.id, 'deleted', 'media', req.params.id);
    res.status(204).end();
  } catch {
    sendError(res, 400, 'La suppression du média a échoué.');
  }
});

app.get('/api/admin/site-settings', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('site_settings').select('*').eq('id', true).single();
    if (error) throw error;
    res.json(data);
  } catch {
    sendError(res, 503, 'Les coordonnées sont indisponibles.');
  }
});

app.patch('/api/admin/site-settings', async (req: AdminRequest, res: Response) => {
  try {
    const socialLinks = jsonValue(req.body?.social_links, {});
    if (!socialLinks || Array.isArray(socialLinks) || typeof socialLinks !== 'object') {
      return sendError(res, 400, 'Les liens sociaux doivent être fournis sous forme d’adresses valides.');
    }
    for (const value of Object.values(socialLinks as Record<string, unknown>)) {
      if (value && !optionalUrl(value)) return sendError(res, 400, 'Chaque lien de réseau social doit commencer par http:// ou https://.');
    }
    const footerNotices = jsonValue(req.body?.footer_notices, []);
    if (!Array.isArray(footerNotices) || footerNotices.some((item) => !item || !text((item as Record<string, unknown>).title, 120) || !text((item as Record<string, unknown>).body, 500))) {
      return sendError(res, 400, 'Chaque information du footer doit avoir un titre et un texte.');
    }
    const payload = {
      business_name: text(req.body?.business_name, 160) || 'HERITAGE',
      email: text(req.body?.email, 180) || null,
      phone: text(req.body?.phone, 80) || null,
      whatsapp_phone: text(req.body?.whatsapp_phone, 80) || null,
      address: text(req.body?.address, 500) || null,
      hours: text(req.body?.hours, 500) || null,
      social_links: socialLinks,
      structured_data_enabled: Boolean(req.body?.structured_data_enabled),
      footer_notices: footerNotices.slice(0, 3).map((item) => ({ title: text((item as Record<string, unknown>).title, 120), body: text((item as Record<string, unknown>).body, 500) })),
      updated_by: req.admin!.id
    };
    const { data, error } = await getSupabaseAdmin().from('site_settings').update(payload).eq('id', true).select().single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'updated', 'site_settings', 'true');
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour des coordonnées a échoué.');
  }
});

app.get('/api/admin/resources/:resource', async (req: AdminRequest, res: Response) => {
  const resource = req.params.resource as ResourceKey;
  const definition = resourceDefinitions[resource];
  if (!definition) return sendError(res, 404, 'Ressource inconnue.');

  try {
    let query = getSupabaseAdmin().from(definition.table).select('*');
    if (resource === 'blogs') query = query.order('updated_at', { ascending: false });
    else if (resource === 'reviews') query = query.order('created_at', { ascending: false });
    else if (resource === 'faqs') query = query.order('sort_order').order('updated_at', { ascending: false });
    else query = query.order('updated_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch {
    sendError(res, 503, 'Cette ressource est indisponible.');
  }
});

app.put('/api/admin/faqs/reorder', async (req: AdminRequest, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => text(id, 80)).filter(Boolean) : [];
  if (!ids.length) return sendError(res, 400, 'Ordre des questions manquant.');
  try {
    const admin = getSupabaseAdmin();
    for (const [sortOrder, id] of ids.entries()) {
      const { error } = await admin.from('faqs').update({ sort_order: sortOrder }).eq('id', id);
      if (error) throw error;
    }
    await writeAudit(req.admin!.id, 'reordered', 'faqs', null, { count: ids.length });
    res.json({ success: true });
  } catch {
    sendError(res, 400, 'Le réordonnancement des questions a échoué.');
  }
});

app.post('/api/admin/resources/:resource', async (req: AdminRequest, res: Response) => {
  const resource = req.params.resource as ResourceKey;
  const definition = resourceDefinitions[resource];
  if (!definition) return sendError(res, 404, 'Ressource inconnue.');

  try {
    const payload = resourcePayload(resource, req.body || {}, req.admin!.id);
    const { data, error } = await getSupabaseAdmin().from(definition.table).insert(payload).select().single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'created', resource, data.id);
    res.status(201).json(data);
  } catch {
    sendError(res, 400, 'L’enregistrement a échoué. Vérifiez les champs uniques et obligatoires.');
  }
});

app.patch('/api/admin/resources/:resource/:id', async (req: AdminRequest, res: Response) => {
  const resource = req.params.resource as ResourceKey;
  const definition = resourceDefinitions[resource];
  if (!definition) return sendError(res, 404, 'Ressource inconnue.');

  try {
    const payload = resourcePayload(resource, req.body || {}, req.admin!.id);
    if (resource === 'pixels') delete payload.created_by;
    if (resource === 'blogs') delete payload.author_id;
    const { data, error } = await getSupabaseAdmin()
      .from(definition.table)
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'updated', resource, req.params.id);
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour a échoué.');
  }
});

app.delete('/api/admin/resources/:resource/:id', async (req: AdminRequest, res: Response) => {
  const resource = req.params.resource as ResourceKey;
  const definition = resourceDefinitions[resource];
  if (!definition) return sendError(res, 404, 'Ressource inconnue.');

  try {
    const { error } = await getSupabaseAdmin().from(definition.table).delete().eq('id', req.params.id);
    if (error) throw error;
    await writeAudit(req.admin!.id, 'deleted', resource, req.params.id);
    res.status(204).end();
  } catch {
    sendError(res, 400, 'La suppression a échoué.');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maison HERITAGE server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

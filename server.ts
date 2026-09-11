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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase serveur non configuré. Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  return supabaseAdmin;
}

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
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

  return {
    name,
    slug: candidateSlug,
    sku,
    reference,
    brand: text(body.brand, 100) || 'HERITAGE',
    category: text(body.category, 80) || 'montres',
    short_description: text(body.short_description, 1000) || null,
    description_html: sanitizeHtml(body.description_html),
    purchase_price_xof: numberValue(body.purchase_price_xof, 0),
    regular_price_xof: regularPrice,
    sale_price_xof: salePrice,
    stock_quantity: stockQuantity,
    low_stock_threshold: integerValue(body.low_stock_threshold, 2),
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
    primary_image: text(body.primary_image, 2000) || undefined,
    created_by: adminId
  };
}

const resourceDefinitions = {
  reviews: {
    table: 'product_reviews',
    fields: ['product_id', 'author_name', 'author_email', 'rating', 'title', 'body', 'status']
  },
  blogs: {
    table: 'blog_posts',
    fields: ['title', 'slug', 'excerpt', 'content_html', 'cover_media_id', 'status', 'published_at', 'seo_title', 'seo_description']
  },
  faqs: {
    table: 'faqs',
    fields: ['placement', 'question', 'answer_html', 'sort_order', 'is_active']
  },
  legal: {
    table: 'legal_pages',
    fields: ['page_key', 'title', 'content_html']
  },
  meta: {
    table: 'page_meta',
    fields: ['page_key', 'title', 'description', 'og_title', 'og_description', 'no_index']
  },
  pixels: {
    table: 'tracking_pixels',
    fields: ['provider', 'label', 'pixel_id', 'script_code', 'is_active']
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
    payload.status = ['draft', 'published', 'archived'].includes(text(payload.status, 20))
      ? payload.status
      : 'draft';
    payload.author_id = adminId;
    if (payload.status === 'published' && !payload.published_at) payload.published_at = new Date().toISOString();
  }

  if (resource === 'faqs') {
    payload.question = text(payload.question, 400);
    payload.answer_html = sanitizeHtml(payload.answer_html);
    payload.sort_order = integerValue(payload.sort_order, 0);
    payload.placement = ['home', 'catalog', 'contact', 'all'].includes(text(payload.placement, 20))
      ? payload.placement
      : 'all';
  }

  if (resource === 'legal') {
    payload.page_key = text(payload.page_key, 80);
    payload.title = text(payload.title, 180);
    payload.content_html = sanitizeHtml(payload.content_html);
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
  }

  if (resource === 'pixels') {
    payload.provider = ['meta', 'google_ads', 'google_analytics', 'custom'].includes(text(payload.provider, 30))
      ? payload.provider
      : 'custom';
    payload.label = text(payload.label, 160);
    payload.pixel_id = text(payload.pixel_id, 200) || null;
    payload.script_code = text(payload.script_code, 30000) || null;
    payload.is_active = Boolean(payload.is_active);
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

app.use('/api/admin', requireAdmin);

app.get('/api/admin/session', (req: AdminRequest, res: Response) => {
  res.json({ admin: req.admin });
});

app.get('/api/admin/dashboard', async (req: AdminRequest, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    const [ordersResult, productsResult, reviewsResult, usersResult] = await Promise.all([
      admin.from('orders').select('id, total_xof, status, created_at').order('created_at', { ascending: false }).limit(8),
      admin.from('products').select('id, stock_quantity, low_stock_threshold, status'),
      admin.from('product_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer')
    ]);

    const orders = ordersResult.data || [];
    const products = productsResult.data || [];
    const totalRevenue = orders.reduce((sum, order: any) => sum + Number(order.total_xof || 0), 0);
    const pendingOrders = orders.filter((order: any) => ['pending_payment', 'paid', 'processing'].includes(order.status)).length;
    const deliveredOrders = orders.filter((order: any) => order.status === 'delivered').length;
    const lowStock = products.filter((product: any) => product.stock_quantity <= product.low_stock_threshold).length;

    res.json({
      totals: {
        revenueXOF: totalRevenue,
        orders: orders.length,
        pendingOrders,
        deliveredOrders,
        averageCartXOF: orders.length ? Math.round(totalRevenue / orders.length) : 0,
        products: products.length,
        lowStock,
        pendingReviews: reviewsResult.count || 0,
        customers: usersResult.count || 0
      },
      recentOrders: orders
    });
  } catch {
    sendError(res, 503, 'Les statistiques sont indisponibles.');
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
  } catch {
    sendError(res, 503, 'Le catalogue est indisponible.');
  }
});

app.post('/api/admin/products', async (req: AdminRequest, res: Response) => {
  const payload = productPayload(req.body || {}, req.admin!.id);
  payload.primary_image ||= '';
  if (!payload.name || !payload.slug) return sendError(res, 400, 'Le nom et le lien produit sont obligatoires.');

  try {
    const { data, error } = await getSupabaseAdmin().from('products').insert(payload).select().single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'created', 'product', data.id, { name: data.name });
    res.status(201).json(data);
  } catch {
    sendError(res, 400, 'Impossible d’enregistrer ce produit. Vérifiez l’unicité du lien, SKU ou de la référence.');
  }
});

app.patch('/api/admin/products/:id', async (req: AdminRequest, res: Response) => {
  const payload = productPayload(req.body || {}, req.admin!.id);
  delete (payload as { created_by?: string }).created_by;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await writeAudit(req.admin!.id, 'updated', 'product', data.id, { name: data.name });
    res.json(data);
  } catch {
    sendError(res, 400, 'La mise à jour du produit a échoué.');
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

app.patch('/api/admin/orders/:id', async (req: AdminRequest, res: Response) => {
  const status = text(req.body?.status, 40);
  const allowed = ['pending_payment', 'payment_pending', 'paid', 'processing', 'shipped_or_ready', 'delivered', 'cancelled', 'refunded', 'payment_failed'];
  if (!allowed.includes(status)) return sendError(res, 400, 'Statut de commande invalide.');

  try {
    const admin = getSupabaseAdmin();
    const { data: current, error: currentError } = await admin
      .from('orders')
      .select('status_history')
      .eq('id', req.params.id)
      .single();
    if (currentError) throw currentError;

    const statusHistory = Array.isArray(current.status_history) ? current.status_history : [];
    statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      note: `Statut mis à jour par ${req.admin!.full_name || 'un administrateur'}`
    });

    const { data, error } = await admin
      .from('orders')
      .update({ status, status_history: statusHistory, updated_at: new Date().toISOString() })
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
    const [adminsResult, invitationsResult] = await Promise.all([
      admin.from('profiles').select('id, email, full_name, is_active, created_at, updated_at').eq('role', 'admin').order('created_at', { ascending: true }),
      admin.from('admin_invitations').select('id, expires_at, created_at, used_at, revoked_at, created_by, used_by').order('created_at', { ascending: false })
    ]);
    if (adminsResult.error || invitationsResult.error) throw adminsResult.error || invitationsResult.error;
    res.json({ administrators: adminsResult.data || [], invitations: invitationsResult.data || [] });
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
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, full_name, phone, is_active, created_at, updated_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
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

app.get('/api/admin/media', async (_req: AdminRequest, res: Response) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch {
    sendError(res, 503, 'La galerie média est indisponible.');
  }
});

app.post('/api/admin/media/upload', async (req: AdminRequest, res: Response) => {
  const fileName = safeFileName(text(req.body?.fileName, 180));
  const mimeType = text(req.body?.mimeType, 80);
  const base64 = text(req.body?.contentBase64, 16 * 1024 * 1024).replace(/^data:[^;]+;base64,/, '');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  if (!base64 || !allowed.includes(mimeType)) {
    return sendError(res, 400, 'Utilisez une image JPEG, PNG, WebP ou AVIF.');
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
        alt_text: text(req.body?.altText, 300),
        size_bytes: buffer.length,
        product_id: text(req.body?.productId, 80) || null,
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
    const { data, error } = await getSupabaseAdmin()
      .from('media_assets')
      .update({ alt_text: text(req.body?.alt_text, 300), product_id: text(req.body?.product_id, 80) || null })
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
    const payload = {
      business_name: text(req.body?.business_name, 160) || 'HERITAGE',
      email: text(req.body?.email, 180) || null,
      phone: text(req.body?.phone, 80) || null,
      address: text(req.body?.address, 500) || null,
      hours: text(req.body?.hours, 500) || null,
      social_links: jsonValue(req.body?.social_links, {}),
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
    else query = query.order('updated_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch {
    sendError(res, 503, 'Cette ressource est indisponible.');
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

import { createClient } from '@supabase/supabase-js';
import { Order, Product, UserProfile } from '../types';

// Supabase Configuration
const metaEnv = (import.meta as any).env || {};
const SUPABASE_URL = metaEnv.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

type CustomerRequestOptions = Omit<RequestInit, 'body'> & { body?: Record<string, unknown> };

async function customerRequest<T>(path: string, options: CustomerRequestOptions = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error('Connectez-vous à votre compte client pour continuer.');

  const response = await fetch(`/api/customer${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'La requête relative à votre compte a échoué.');
  return payload as T;
}

const mapCustomerProfile = (profile: Record<string, any>): UserProfile => ({
  id: String(profile.id),
  email: profile.email || undefined,
  phone: profile.phone || undefined,
  fullName: String(profile.full_name || ''),
  commune: profile.commune || undefined,
  deliveryAddress: profile.delivery_address || undefined,
  role: profile.role === 'admin' ? 'admin' : 'customer',
  createdAt: profile.created_at || undefined
});

export type CustomerAddress = {
  id: string;
  label: string;
  recipient_name: string | null;
  phone: string | null;
  commune: string | null;
  address_line: string;
  is_default: boolean;
};

export async function fetchCurrentCustomerAccount(): Promise<{ profile: UserProfile; addresses: CustomerAddress[] } | null> {
  try {
    const payload = await customerRequest<{ profile: Record<string, any>; addresses: CustomerAddress[] }>('/profile');
    return { profile: mapCustomerProfile(payload.profile), addresses: Array.isArray(payload.addresses) ? payload.addresses : [] };
  } catch {
    return null;
  }
}

export async function fetchCustomerCart() {
  return customerRequest<{ items: Array<{ product_id: string; quantity: number }> }>('/cart');
}

export async function saveCustomerCartItem(productId: string, quantity: number) {
  return customerRequest<{ item: { product_id: string; quantity: number } }>(`/cart/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: { quantity }
  });
}

export async function removeCustomerCartItem(productId: string) {
  return customerRequest<void>(`/cart/${encodeURIComponent(productId)}`, { method: 'DELETE' });
}

export async function fetchCustomerWishlist() {
  return customerRequest<{ items: Array<{ product_id: string }> }>('/wishlist');
}

export async function addCustomerWishlistItem(productId: string) {
  return customerRequest<void>(`/wishlist/${encodeURIComponent(productId)}`, { method: 'PUT' });
}

export async function removeCustomerWishlistItem(productId: string) {
  return customerRequest<void>(`/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' });
}

/**
 * Inscription d'un nouveau visiteur par Email uniquement
 * avec possibilité de renseigner un numéro WhatsApp pour le suivi
 */
export async function signUpWithSupabase({
  email,
  password,
  fullName,
  whatsappPhone,
  commune,
  deliveryAddress
}: {
  email: string;
  password: string;
  fullName: string;
  whatsappPhone?: string;
  commune?: string;
  deliveryAddress?: string;
}) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanWhatsApp = whatsappPhone ? whatsappPhone.trim() : '';

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/compte`,
        data: {
          full_name: fullName.trim(),
          phone: cleanWhatsApp,
          whatsapp: cleanWhatsApp,
          commune: commune || 'Abidjan',
          delivery_address: deliveryAddress || '',
          role: 'customer'
        }
      }
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        throw new Error('Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter directement.');
      }
      throw error;
    }

    return { user: data.user, session: data.session };
  } catch (err: any) {
    console.error('Erreur inscription Supabase:', err);
    throw new Error(err.message || "Erreur lors de l'inscription. Veuillez vérifier votre adresse e-mail.");
  }
}

/**
 * Connexion par Email uniquement avec mot de passe
 */
export async function signInWithSupabase({
  email,
  password
}: {
  email: string;
  password: string;
}) {
  try {
    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      if (/email not confirmed/i.test(error.message || '')) {
        throw new Error('Votre adresse e-mail doit être confirmée avant la première connexion. Consultez votre boîte de réception ou demandez un nouvel e-mail de confirmation.');
      }
      if (/banned|disabled|not allowed/i.test(error.message || '')) {
        throw new Error('Ce compte client est désactivé. Contactez la Maison HERITAGE si vous pensez qu’il s’agit d’une erreur.');
      }
      throw error;
    }

    return { user: data.user, session: data.session };
  } catch (err: any) {
    console.error('Erreur connexion Supabase:', err);
    if (/désactivé|disabled|confirmée|confirmed/i.test(err?.message || '')) throw err;
    throw new Error('Adresse e-mail ou mot de passe incorrect.');
  }
}

export async function resendSignupConfirmation(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Saisissez votre adresse e-mail pour recevoir le lien de confirmation.');

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: cleanEmail,
    options: { emailRedirectTo: `${window.location.origin}/compte` }
  });
  if (error) throw new Error("L’e-mail de confirmation n’a pas pu être renvoyé. Réessayez dans quelques instants.");
}

/**
 * Déconnexion
 */
export async function signOutSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Erreur déconnexion:', error);
}

/**
 * Récupération du profil utilisateur
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const payload = await customerRequest<{ profile: Record<string, any> }>('/profile');
  if (String(payload.profile?.id || '') !== userId) return null;
  return mapCustomerProfile(payload.profile);
}

/**
 * Récupère le profil de la session active courante
 */
export async function fetchCurrentSessionProfile(): Promise<UserProfile | null> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return null;
    return await fetchUserProfile(authData.user.id);
  } catch (e) {
    return null;
  }
}

/**
 * Création contrôlée d'une commande. Le navigateur n'envoie jamais un prix,
 * un total ni un statut faisant foi : l'API les recalcule à partir du
 * catalogue publié avant d'écrire le snapshot dans Supabase.
 */
export async function syncOrderToSupabase(order: Order) {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken) {
      return { success: false as const, error: new Error('Connectez-vous avant de finaliser votre commande.') };
    }

    const response = await fetch('/api/public/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        customer_name: order.customer.fullName,
        customer_email: order.customer.email,
        customer_phone: order.customer.phone,
        customer_commune: order.customer.commune,
        customer_delivery_address: order.customer.deliveryAddress,
        customer_notes: order.customer.notes || null,
        delivery_mode: order.customer.deliveryMode,
        payment_method: order.paymentMethod || 'transmission_whatsapp',
        items: order.items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity
        }))
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.order) {
      return { success: false as const, error: new Error(data?.error || 'La commande ne peut pas être enregistrée pour le moment.') };
    }

    return { success: true as const, order: data.order };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error : new Error('La commande ne peut pas être enregistrée pour le moment.')
    };
  }
}

/**
 * Récupération de l'historique des commandes d'un client
 */
export async function fetchUserOrdersFromSupabase(email?: string, phone?: string, userId?: string): Promise<Order[]> {
  try {
    if (!email && !phone && !userId) return [];
    const payload = await customerRequest<{ orders: Record<string, any>[] }>('/orders');
    return (payload.orders || []).map((d: any) => ({
      id: d.id,
      orderNumber: d.order_number,
      createdAt: d.created_at,
      status: d.status,
      customer: {
        fullName: d.customer_name,
        email: d.customer_email,
        phone: d.customer_phone,
        commune: d.customer_commune,
        deliveryAddress: d.customer_delivery_address,
        notes: d.customer_notes,
        deliveryMode: d.delivery_mode
      },
      items: (d.order_items || []).map((it: any) => ({
        product: {
          id: it.product_id || it.id,
          sku: it.product_sku || '',
          reference: it.product_reference || '',
          name: it.product_name,
          brand: 'Tissot',
          slug: '',
          category: 'montres',
          priceXOF: Number(it.price_xof),
          stockStatus: 'En stock',
          stockCount: 1,
          status: 'published',
          primaryImage: it.image_url || '/assets/products/tissot-le-locle.jpg',
          additionalImages: [],
          shortDescription: '',
          valueStoryTitle: '',
          valueStoryText: '',
          attributes: {} as any,
          provenanceSummary: '',
          warrantySummary: '',
          deliverySummary: '',
          faq: []
        },
        quantity: it.quantity
      })),
      subtotalXOF: Number(d.subtotal_xof),
      deliveryCostXOF: Number(d.delivery_cost_xof),
      totalXOF: Number(d.total_xof),
      paymentMethod: d.payment_method,
      statusHistory: d.status_history || []
    }));
  } catch (e) {
    console.warn('Erreur lecture commandes Supabase:', e);
    return [];
  }
}

/** Vérification limitée au client Auth : les tables privées sont interrogées côté serveur. */
export async function checkSupabaseConnection() {
  const results = {
    connected: false,
    authWorking: false,
    tables: {
      profiles: false,
      products: false,
      orders: false,
      order_items: false
    },
    projectUrl: SUPABASE_URL,
    details: ''
  };

  try {
    // 1. Tester Auth
    const { error: authErr } = await supabase.auth.getSession();
    results.authWorking = !authErr;
    results.connected = true;

    return results;
  } catch (e: any) {
    results.details = e.message || 'Erreur de connexion';
    return results;
  }
}

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

    // Mise à jour ou insertion dans la table profiles en tant que Compte Client / Visiteur (role = 'customer')
    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: cleanEmail,
          phone: cleanWhatsApp || null,
          commune: commune || '',
          delivery_address: deliveryAddress || '',
          role: 'customer',
          is_active: true
        });
      } catch (e) {
        // RLS ou table non encore migrée : ignoré car auth.users stocke déjà les métadonnées
        console.warn('Profile table sync info:', e);
      }
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
      throw error;
    }

    return { user: data.user, session: data.session };
  } catch (err: any) {
    console.error('Erreur connexion Supabase:', err);
    throw new Error('Adresse e-mail ou mot de passe incorrect.');
  }
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
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      // Fallback vers les métadonnées auth
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user && userData.user.id === userId) {
        return {
          id: userData.user.id,
          email: userData.user.email,
          phone: userData.user.user_metadata?.phone,
          fullName: userData.user.user_metadata?.full_name || 'Client HERITAGE',
          commune: userData.user.user_metadata?.commune,
          deliveryAddress: userData.user.user_metadata?.delivery_address,
          role: 'customer'
        };
      }
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      phone: data.phone,
      fullName: data.full_name,
      commune: data.commune,
      deliveryAddress: data.delivery_address,
      role: data.role || 'customer',
      createdAt: data.created_at
    };
  } catch (e) {
    console.warn('Impossible de charger le profil Supabase:', e);
    return null;
  }
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

    let query = supabase.from('orders').select('*, order_items(*)');

    const filters: string[] = [];
    if (userId) filters.push(`user_id.eq.${userId}`);
    if (email) filters.push(`customer_email.eq.${email}`);
    if (phone) filters.push(`customer_phone.eq.${phone}`);

    if (filters.length > 0) {
      query = query.or(filters.join(','));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => ({
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
      paymentReference: d.payment_reference,
      statusHistory: d.status_history || []
    }));
  } catch (e) {
    console.warn('Erreur lecture commandes Supabase:', e);
    return [];
  }
}

/**
 * Récupération de TOUTES les commandes pour le portail administrateur
 */
export async function fetchAllAdminOrdersFromSupabase(): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => ({
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
      paymentReference: d.payment_reference,
      statusHistory: d.status_history || []
    }));
  } catch (e) {
    console.warn('Erreur admin commandes Supabase:', e);
    return [];
  }
}

/**
 * Mise à jour du statut d'une commande par l'administrateur
 */
export async function updateOrderStatusInSupabase(
  orderId: string,
  newStatus: string,
  note: string
) {
  try {
    const { data: current } = await supabase
      .from('orders')
      .select('status_history')
      .eq('id', orderId)
      .maybeSingle();

    const currentHistory = current?.status_history || [];
    const updatedHistory = [
      ...currentHistory,
      {
        status: newStatus,
        timestamp: new Date().toISOString(),
        note
      }
    ];

    const { error } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        status_history: updatedHistory,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error('Erreur mise à jour commande Supabase:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Vérification de l'état de la connexion Supabase et des tables
 */
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

    // 2. Tester table profiles
    const { error: profErr } = await supabase.from('profiles').select('id').limit(1);
    results.tables.profiles = !profErr;

    // 3. Tester table products
    const { error: prodErr } = await supabase.from('products').select('id').limit(1);
    results.tables.products = !prodErr;

    // 4. Tester table orders
    const { error: ordErr } = await supabase.from('orders').select('id').limit(1);
    results.tables.orders = !ordErr;

    // 5. Tester table order_items
    const { error: itmErr } = await supabase.from('order_items').select('id').limit(1);
    results.tables.order_items = !itmErr;

    return results;
  } catch (e: any) {
    results.details = e.message || 'Erreur de connexion';
    return results;
  }
}

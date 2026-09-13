import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Order, OrderCustomer, OrderStatus, Product } from '../types';
import {
  supabase,
  syncOrderToSupabase,
  fetchCurrentCustomerAccount,
  fetchCustomerCart,
  saveCustomerCartItem,
  removeCustomerCartItem,
  fetchCustomerWishlist,
  addCustomerWishlistItem,
  removeCustomerWishlistItem
} from '../lib/supabase';
import { usePublicContent } from '../lib/public-content';

interface StoreContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (sku: string, quantity: number) => Promise<void>;
  removeFromCart: (sku: string) => Promise<void>;
  clearCart: () => Promise<void>;
  cartSubtotal: number;
  cartItemCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  orders: Order[];
  currentOrder: Order | null;
  setCurrentOrder: (order: Order | null) => void;
  createOrder: (
    customer: OrderCustomer,
    paymentMethod?: string
  ) => Promise<Order>;
  userEmail: string | null;
  loginUser: (email: string) => void;
  logoutUser: () => void;
  cartToast: string | null;
  setCartToast: (msg: string | null) => void;
  wishlist: string[];
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (product: Product) => Promise<void>;
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  clearWishlist: () => Promise<void>;
  wishlistItemCount: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { products } = usePublicContent();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [cartToast, setCartToast] = useState<string | null>(null);

  const [wishlist, setWishlist] = useState<string[]>([]);

  const showToast = (message: string) => {
    setCartToast(message);
    window.setTimeout(() => setCartToast(null), 4000);
  };

  const hydrateCustomerSelections = async () => {
    if (!products.length || !userEmail) {
      setCart([]);
      setWishlist([]);
      return;
    }
    try {
      const [serverCart, serverWishlist] = await Promise.all([fetchCustomerCart(), fetchCustomerWishlist()]);
      const productById = new Map<string, Product>(
        products
          .filter((product) => product.status === 'published')
          .map((product): [string, Product] => [String(product.id), product])
      );
      setCart(
        (serverCart.items || []).flatMap((entry) => {
          const product = productById.get(String(entry.product_id));
          return product ? [{ product, quantity: Math.max(1, Math.min(Number(entry.quantity) || 1, product.stockCount)) }] : [];
        })
      );
      setWishlist((serverWishlist.items || []).map((entry) => String(entry.product_id)).filter((id) => productById.has(id)));
    } catch {
      // A suspended or expired customer session must not retain a local cart/wishlist.
      setCart([]);
      setWishlist([]);
    }
  };

  useEffect(() => {
    void hydrateCustomerSelections();
  }, [products, userEmail]);

  // Écouter les changements d'état d'authentification Supabase
  useEffect(() => {
    let mounted = true;
    const resetCustomerState = () => {
      if (!mounted) return;
      setUserEmail(null);
      setCart([]);
      setWishlist([]);
    };
    const synchronizeCustomerSession = async (session: { user?: { email?: string | null } } | null) => {
      if (!session?.user) {
        resetCustomerState();
        return;
      }
      const account = await fetchCurrentCustomerAccount();
      if (!mounted) return;
      if (!account?.profile) {
        // The server refused the token because the account is not a customer
        // account or because it was disabled by an administrator.
        resetCustomerState();
        return;
      }
      setUserEmail(account.profile.email || session.user.email || null);
    };

    supabase.auth.getSession().then(({ data: { session } }) => void synchronizeCustomerSession(session));

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer API work outside Supabase's auth callback to avoid re-entrant
      // session access while the SDK is notifying subscribers.
      window.setTimeout(() => void synchronizeCustomerSession(session), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const ensureCustomerSession = async (): Promise<boolean> => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return true;
    showToast('Connectez-vous à votre compte client pour ajouter une pièce au panier ou à vos favoris.');
    return false;
  };

  const addToCart = async (product: Product, quantity = 1) => {
    if (!(await ensureCustomerSession())) return;
    if (product.stockStatus === 'Indisponible' || product.stockCount <= 0) {
      showToast('Cette pièce est actuellement indisponible.');
      return;
    }
    const existing = cart.find((item) => String(item.product.id) === String(product.id));
    const nextQuantity = Math.min((existing?.quantity || 0) + quantity, product.stockCount, 20);
    try {
      await saveCustomerCartItem(String(product.id), nextQuantity);
      setCart((prev) => existing
        ? prev.map((item) => String(item.product.id) === String(product.id) ? { ...item, quantity: nextQuantity } : item)
        : [...prev, { product, quantity: nextQuantity }]);
      showToast('La pièce a été ajoutée à votre panier.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : "L'ajout au panier est impossible pour le moment.");
    }
  };

  const updateQuantity = async (sku: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(sku);
      return;
    }
    const target = cart.find((item) => item.product.sku === sku);
    if (!target || !(await ensureCustomerSession())) return;
    const nextQuantity = Math.max(1, Math.min(quantity, target.product.stockCount, 20));
    try {
      await saveCustomerCartItem(String(target.product.id), nextQuantity);
      setCart((prev) => prev.map((item) => item.product.sku === sku ? { ...item, quantity: nextQuantity } : item));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'La quantité ne peut pas être mise à jour.');
    }
  };

  const removeFromCart = async (sku: string) => {
    const target = cart.find((item) => item.product.sku === sku);
    if (!target || !(await ensureCustomerSession())) return;
    try {
      await removeCustomerCartItem(String(target.product.id));
      setCart((prev) => prev.filter((item) => item.product.sku !== sku));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'La pièce ne peut pas être retirée du panier.');
    }
  };

  const clearCart = async () => {
    if (!(await ensureCustomerSession())) return;
    try {
      await Promise.all(cart.map((item) => removeCustomerCartItem(String(item.product.id))));
      setCart([]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Le panier ne peut pas être vidé pour le moment.');
    }
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.product.priceXOF * item.quantity, 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const createOrder = async (
    customer: OrderCustomer,
    paymentMethod: string = 'commande_directe'
  ): Promise<Order> => {
    const cartSnapshot = cart.map((item) => ({ ...item, product: { ...item.product } }));
    if (!cartSnapshot.length) throw new Error('Votre panier est vide.');

    // Identifiants et montants provisoires uniquement : le serveur les remplace
    // par les valeurs faisant foi de Supabase avant de confirmer la commande.
    const provisionalReference = `HRT-${Date.now()}`;
    const deliveryCostXOF = customer.deliveryMode === 'livraison_abidjan' ? 5000 : 0;
    const totalXOF = cartSubtotal + deliveryCostXOF;

    const provisionalOrder: Order = {
      id: 'ord-' + Date.now(),
      orderNumber: provisionalReference,
      createdAt: new Date().toISOString(),
      status: 'pending_payment',
      customer,
      items: cartSnapshot,
      subtotalXOF: cartSubtotal,
      deliveryCostXOF,
      totalXOF,
      paymentMethod: paymentMethod as any,
      statusHistory: [
        {
          status: 'pending_payment',
          timestamp: new Date().toISOString(),
          note: 'Commande en cours de vérification.'
        }
      ]
    };

    const persisted = await syncOrderToSupabase(provisionalOrder);
    if (!persisted.success) throw persisted.error;

    const serverOrder = persisted.order as Record<string, any>;
    const serverItems = Array.isArray(serverOrder.order_items) ? serverOrder.order_items : [];
    const pricesByProduct = new Map(serverItems.map((item: Record<string, any>) => [String(item.product_id), Number(item.unit_price_xof ?? item.price_xof)]));
    const rawStatus = String(serverOrder.status || 'pending_payment') as OrderStatus;
    const validStatuses: OrderStatus[] = ['pending_payment', 'payment_pending', 'paid', 'processing', 'shipped_or_ready', 'delivered', 'cancelled', 'refunded', 'payment_failed'];
    const serverHistory = Array.isArray(serverOrder.status_history) ? serverOrder.status_history : [];
    const confirmedOrder: Order = {
      ...provisionalOrder,
      id: String(serverOrder.id || provisionalOrder.id),
      orderNumber: String(serverOrder.order_number || provisionalOrder.orderNumber),
      createdAt: String(serverOrder.created_at || provisionalOrder.createdAt),
      status: validStatuses.includes(rawStatus) ? rawStatus : 'pending_payment',
      customer: {
        ...customer,
        email: String(serverOrder.customer_email || customer.email)
      },
      items: cartSnapshot.map((item) => {
        const price = pricesByProduct.get(String(item.product.id));
        return typeof price === 'number' && Number.isFinite(price) && price > 0
          ? { ...item, product: { ...item.product, priceXOF: price } }
          : item;
      }),
      subtotalXOF: Number(serverOrder.subtotal_xof ?? provisionalOrder.subtotalXOF),
      deliveryCostXOF: Number(serverOrder.delivery_cost_xof ?? provisionalOrder.deliveryCostXOF),
      totalXOF: Number(serverOrder.total_xof ?? provisionalOrder.totalXOF),
      paymentMethod: String(serverOrder.payment_method || provisionalOrder.paymentMethod || ''),
      statusHistory: serverHistory.length
        ? serverHistory.map((entry: Record<string, any>) => ({
            status: validStatuses.includes(entry.status as OrderStatus) ? entry.status as OrderStatus : 'pending_payment',
            timestamp: String(entry.timestamp || serverOrder.created_at || provisionalOrder.createdAt),
            note: String(entry.note || '')
          }))
        : provisionalOrder.statusHistory
    };

    setOrders((prev) => [confirmedOrder, ...prev]);
    setCurrentOrder(confirmedOrder);
    await Promise.all(cartSnapshot.map((item) => removeCustomerCartItem(String(item.product.id)).catch(() => undefined)));
    setCart([]);
    return confirmedOrder;
  };

  const loginUser = (email: string) => {
    setUserEmail(email);
  };

  const logoutUser = () => {
    setUserEmail(null);
    setCart([]);
    setWishlist([]);
  };

  const isInWishlist = (productId: string): boolean => {
    return wishlist.includes(productId);
  };

  const toggleWishlist = async (product: Product) => {
    if (!(await ensureCustomerSession())) return;
    const exists = wishlist.includes(product.id);
    try {
      if (exists) {
        await removeCustomerWishlistItem(String(product.id));
        setWishlist((prev) => prev.filter((id) => id !== product.id));
        showToast(`« ${product.name} » a été retiré de votre liste d'envies.`);
      } else {
        await addCustomerWishlistItem(String(product.id));
        setWishlist((prev) => [...prev, product.id]);
        showToast(`« ${product.name} » a été ajouté à votre liste d'envies.`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "La liste d'envies ne peut pas être mise à jour.");
    }
  };

  const addToWishlist = async (product: Product) => {
    if (wishlist.includes(product.id)) return;
    await toggleWishlist(product);
  };

  const removeFromWishlist = async (productId: string) => {
    if (!(await ensureCustomerSession())) return;
    try {
      await removeCustomerWishlistItem(productId);
      setWishlist((prev) => prev.filter((id) => id !== productId));
      const targetProduct = products.find((product) => product.id === productId);
      showToast(targetProduct ? `« ${targetProduct.name} » a été retiré de votre liste d'envies.` : "La pièce a été retirée de votre liste d'envies.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "La liste d'envies ne peut pas être mise à jour.");
    }
  };

  const clearWishlist = async () => {
    if (!(await ensureCustomerSession())) return;
    try {
      await Promise.all(wishlist.map((productId) => removeCustomerWishlistItem(productId)));
      setWishlist([]);
      showToast("Votre liste d'envies a été vidée.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "La liste d'envies ne peut pas être vidée.");
    }
  };

  const wishlistItemCount = wishlist.length;

  return (
    <StoreContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartSubtotal,
        cartItemCount,
        isCartOpen,
        setIsCartOpen,
        isSearchOpen,
        setIsSearchOpen,
        orders,
        currentOrder,
        setCurrentOrder,
        createOrder,
        userEmail,
        loginUser,
        logoutUser,
        cartToast,
        setCartToast,
        wishlist,
        isInWishlist,
        toggleWishlist,
        addToWishlist,
        removeFromWishlist,
        clearWishlist,
        wishlistItemCount
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextType {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}

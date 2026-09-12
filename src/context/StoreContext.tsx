import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Order, OrderCustomer, OrderStatus, Product } from '../types';
import { supabase, syncOrderToSupabase, fetchUserOrdersFromSupabase } from '../lib/supabase';
import { usePublicContent } from '../lib/public-content';

interface StoreContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeFromCart: (sku: string) => void;
  clearCart: () => void;
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
  toggleWishlist: (product: Product) => void;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
  wishlistItemCount: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'heritage_cart_v1';
const ORDERS_STORAGE_KEY = 'heritage_orders_v1';
const USER_STORAGE_KEY = 'heritage_user_v1';
const WISHLIST_STORAGE_KEY = 'heritage_wishlist_v1';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { products } = usePublicContent();
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate with current products
        return parsed;
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [userEmail, setUserEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem(USER_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [cartToast, setCartToast] = useState<string | null>(null);

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // Ignore
    }
  }, [wishlist]);

  // The published Supabase catalogue is the source of truth for persisted cart
  // and wishlist entries once it has loaded.
  useEffect(() => {
    if (!products.length) return;
    setCart((current) => current.filter((item) => products.some((product) => product.sku === item.product.sku && product.status === 'published')));
    setWishlist((current) => current.filter((id) => products.some((product) => product.id === id)));
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // Ignore
    }
  }, [orders]);

  useEffect(() => {
    if (userEmail) {
      localStorage.setItem(USER_STORAGE_KEY, userEmail);
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [userEmail]);

  // Écouter les changements d'état d'authentification Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const identifier =
          session.user.email ||
          session.user.phone ||
          session.user.user_metadata?.phone ||
          session.user.user_metadata?.full_name;
        if (identifier && !userEmail) {
          setUserEmail(identifier);
        }
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const identifier =
          session.user.email ||
          session.user.phone ||
          session.user.user_metadata?.phone;
        if (identifier) setUserEmail(identifier);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const addToCart = (product: Product, quantity = 1) => {
    if (product.stockStatus === 'Indisponible' || product.stockCount <= 0) {
      setCartToast('Cette pièce est actuellement indisponible.');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.sku === product.sku);
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, product.stockCount);
        return prev.map((item) =>
          item.product.sku === product.sku ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stockCount) }];
    });

    setCartToast('La pièce a été ajoutée à votre panier.');
    setTimeout(() => {
      setCartToast(null);
    }, 4000);
  };

  const updateQuantity = (sku: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(sku);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.sku === sku) {
          const max = item.product.stockCount;
          return { ...item, quantity: Math.min(quantity, max) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (sku: string) => {
    setCart((prev) => prev.filter((item) => item.product.sku !== sku));
  };

  const clearCart = () => {
    setCart([]);
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
    setCart([]);
    return confirmedOrder;
  };

  const loginUser = (email: string) => {
    setUserEmail(email);
  };

  const logoutUser = () => {
    setUserEmail(null);
  };

  const isInWishlist = (productId: string): boolean => {
    return wishlist.includes(productId);
  };

  const toggleWishlist = (product: Product) => {
    setWishlist((prev) => {
      const exists = prev.includes(product.id);
      void fetch('/api/public/analytics/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, action: exists ? 'remove' : 'add' })
      }).catch(() => undefined);

      if (exists) {
        setCartToast(`« ${product.name} » a été retiré de votre liste d'envies.`);
        setTimeout(() => setCartToast(null), 3500);
        return prev.filter((id) => id !== product.id);
      } else {
        setCartToast(`« ${product.name} » a été ajouté à votre liste d'envies.`);
        setTimeout(() => setCartToast(null), 3500);
        return [...prev, product.id];
      }
    });
  };

  const addToWishlist = (product: Product) => {
    setWishlist((prev) => {
      if (!prev.includes(product.id)) {
        void fetch('/api/public/analytics/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: product.id, action: 'add' })
        }).catch(() => undefined);

        setCartToast(`« ${product.name} » a été ajouté à votre liste d'envies.`);
        setTimeout(() => setCartToast(null), 3500);
        return [...prev, product.id];
      }
      return prev;
    });
  };

  const removeFromWishlist = (productId: string) => {
    setWishlist((prev) => {
      const targetProduct = products.find((p) => p.id === productId);
      if (targetProduct) {
        setCartToast(`« ${targetProduct.name} » a été retiré de votre liste d'envies.`);
        setTimeout(() => setCartToast(null), 3500);
      }
      return prev.filter((id) => id !== productId);
    });
  };

  const clearWishlist = () => {
    setWishlist([]);
    setCartToast("Votre liste d'envies a été vidée.");
    setTimeout(() => setCartToast(null), 3500);
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

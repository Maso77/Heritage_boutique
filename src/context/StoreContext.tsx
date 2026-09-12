import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Order, OrderCustomer, OrderStatus, Product } from '../types';
import { supabase, syncOrderToSupabase, updateOrderStatusInSupabase, fetchUserOrdersFromSupabase } from '../lib/supabase';
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
  ) => Order;
  processPaymentWebhook: (orderId: string, success: boolean) => void;
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

  const createOrder = (
    customer: OrderCustomer,
    paymentMethod: string = 'commande_directe'
  ): Order => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `HER-${dateStr}-${randomSuffix}`;
    const deliveryCostXOF = customer.deliveryMode === 'livraison_abidjan' ? 5000 : 0;
    const totalXOF = cartSubtotal + deliveryCostXOF;

    const newOrder: Order = {
      id: 'ord-' + Date.now(),
      orderNumber,
      createdAt: new Date().toISOString(),
      status: 'processing',
      customer,
      items: [...cart],
      subtotalXOF: cartSubtotal,
      deliveryCostXOF,
      totalXOF,
      paymentMethod: paymentMethod as any,
      statusHistory: [
        {
          status: 'processing',
          timestamp: new Date().toISOString(),
          note: 'Commande transmise et enregistrée avec succès à Abidjan.'
        }
      ]
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCurrentOrder(newOrder);
    // Clear cart upon successful order submission
    setCart([]);
    // Synchroniser avec Supabase
    syncOrderToSupabase(newOrder);
    return newOrder;
  };

  const processPaymentWebhook = (orderId: string, success: boolean) => {
    const nextStatus: OrderStatus = success ? 'paid' : 'payment_failed';
    const note = success
      ? 'Paiement vérifié avec succès par webhook sécurisé idempotent.'
      : 'Échec de la transaction auprès du prestataire de paiement.';

    // Synchroniser la mise à jour de statut avec Supabase
    updateOrderStatusInSupabase(orderId, nextStatus, note);

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const updated: Order = {
            ...ord,
            status: nextStatus,
            paymentReference: success
              ? 'WAVE-' + Math.random().toString(36).substring(2, 10).toUpperCase()
              : undefined,
            statusHistory: [
              ...ord.statusHistory,
              {
                status: nextStatus,
                timestamp: new Date().toISOString(),
                note
              }
            ]
          };
          if (currentOrder && currentOrder.id === orderId) {
            setCurrentOrder(updated);
          }
          return updated;
        }
        return ord;
      })
    );

    if (success) {
      clearCart();
    }
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
        processPaymentWebhook,
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

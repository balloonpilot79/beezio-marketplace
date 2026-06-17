import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  sellerAsk?: number;
  currency?: string;
  affiliateRate?: number;
  quantity: number;
  image: string;
  sellerId: string;
  sellerName: string;
  shippingCost?: number;
  maxQuantity?: number;
  commission_rate?: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
  affiliateId?: string;
  affiliateCommissionRate?: number;
  variantId?: string;
  variantName?: string;
  variantAttributes?: Record<string, string>;
  shippingOptionId?: string;
  shippingOptionName?: string;
  shippingOptionCost?: number;
  isSample?: boolean;
  isDigital?: boolean;
}

export interface ShippingOptionSelection {
  id: string;
  name: string;
  cost: number;
  methodCode?: string;
  destinationCountry?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getShippingTotal: () => number;
  isInCart: (productId: string) => boolean;
  shippingOption: ShippingOptionSelection | null;
  setShippingOption: (option: ShippingOptionSelection | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    // During development/initialization, return safe defaults to prevent crashes
    console.warn('useCart called outside of CartProvider or during initialization, returning safe defaults');
    return {
      items: [],
      addToCart: () => {},
      removeFromCart: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      getTotalItems: () => 0,
      getTotalPrice: () => 0,
      getShippingTotal: () => 0,
      isInCart: () => false,
      shippingOption: null,
      setShippingOption: () => {},
    };
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [shippingOption, setShippingOption] = useState<ShippingOptionSelection | null>(null);
  const [isCartHydrated, setIsCartHydrated] = useState(false);

  const STORE_SCOPE_KEY = 'beezio-store-scope';
  const LEGACY_CART_KEY = 'beezio-cart';
  const LAST_CART_SCOPE_KEY = 'beezio-last-cart-scope';
  const [storeScope, setStoreScope] = useState<string>(() => localStorage.getItem(STORE_SCOPE_KEY) || 'global');

  const resolveCartKey = (userId: string | null, scope: string) =>
    userId ? `beezio-cart-${scope}-${userId}` : `beezio-cart-${scope}-guest`;
  const resolveShippingKey = (userId: string | null, scope: string) =>
    userId ? `beezio-shipping-${scope}-${userId}` : `beezio-shipping-${scope}-guest`;

  const loadStoredShippingOption = (userId: string | null, scope: string) => {
    const storageKey = resolveShippingKey(userId, scope);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setShippingOption(JSON.parse(stored));
      } catch {
        setShippingOption(null);
      }
    } else {
      setShippingOption(null);
    }
  };

  const tryParseCart = (raw: string | null): CartItem[] | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CartItem[]) : null;
    } catch {
      return null;
    }
  };

  const loadCartFromKeys = (keys: string[], preferNonEmpty = false) => {
    let firstParsed: { found: true; items: CartItem[]; sourceKey: string } | null = null;

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      const parsed = tryParseCart(raw);
      if (parsed !== null) {
        if (!firstParsed) {
          firstParsed = { found: true as const, items: parsed, sourceKey: key };
        }

        if (!preferNonEmpty || parsed.length > 0) {
          return { found: true as const, items: parsed, sourceKey: key };
        }
      }
    }

    if (firstParsed) {
      return firstParsed;
    }

    return { found: false as const, items: [] as CartItem[], sourceKey: null as string | null };
  };

  useEffect(() => {
    const handleScopeChange = () => {
      const nextScope = localStorage.getItem(STORE_SCOPE_KEY) || 'global';
      setStoreScope(prev => (prev === nextScope ? prev : nextScope));
    };

    window.addEventListener('beezio-store-scope-changed', handleScopeChange);
    window.addEventListener('storage', handleScopeChange);

    return () => {
      window.removeEventListener('beezio-store-scope-changed', handleScopeChange);
      window.removeEventListener('storage', handleScopeChange);
    };
  }, []);

  // Track signed-in user
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      if (userId !== currentUserId) {
        setCurrentUserId(userId);
      }
    };

    checkUser();
  }, [currentUserId]);

  // Load cart whenever user or store scope changes
  useEffect(() => {
    setIsCartHydrated(false);

    const userId = currentUserId;
    const userCartKey = resolveCartKey(userId, storeScope);
    const guestCartKey = resolveCartKey(null, storeScope);
    const lastScope = localStorage.getItem(LAST_CART_SCOPE_KEY);

    if (userId) {
      const candidateKeys = [
        userCartKey,
        guestCartKey,
        ...(lastScope && lastScope !== storeScope ? [resolveCartKey(userId, lastScope), resolveCartKey(null, lastScope)] : []),
        LEGACY_CART_KEY,
      ];
      const loaded = loadCartFromKeys(candidateKeys, true);
      setItems(loaded.items);

      // Migrate guest/legacy/previous-scope carts into the current signed-in scope key.
      if (loaded.found && loaded.sourceKey && loaded.sourceKey !== userCartKey) {
        localStorage.setItem(userCartKey, JSON.stringify(loaded.items));
        if (loaded.sourceKey !== LEGACY_CART_KEY) {
          localStorage.removeItem(loaded.sourceKey);
        }
      }
    } else {
      const candidateKeys = [
        guestCartKey,
        ...(lastScope && lastScope !== storeScope ? [resolveCartKey(null, lastScope)] : []),
        LEGACY_CART_KEY,
      ];
      const loaded = loadCartFromKeys(candidateKeys, true);
      setItems(loaded.items);

      // Keep guest cart aligned to current scope for stable refresh behavior.
      if (loaded.found && loaded.sourceKey && loaded.sourceKey !== guestCartKey) {
        localStorage.setItem(guestCartKey, JSON.stringify(loaded.items));
      }
    }

    loadStoredShippingOption(userId, storeScope);
    setIsCartHydrated(true);
  }, [currentUserId, storeScope]);

  // Save cart to localStorage whenever items change - PER USER + STORE
  useEffect(() => {
    if (!isCartHydrated) return;

    const key = resolveCartKey(currentUserId, storeScope);
    localStorage.setItem(key, JSON.stringify(items));
    localStorage.setItem(LEGACY_CART_KEY, JSON.stringify(items));
    localStorage.setItem(LAST_CART_SCOPE_KEY, storeScope);
  }, [items, currentUserId, storeScope, isCartHydrated]);

  useEffect(() => {
    if (!isCartHydrated) return;

    const key = resolveShippingKey(currentUserId, storeScope);
    if (shippingOption) {
      localStorage.setItem(key, JSON.stringify(shippingOption));
    } else {
      localStorage.removeItem(key);
    }
  }, [shippingOption, currentUserId, storeScope, isCartHydrated]);

  const addToCart = (newItem: Omit<CartItem, 'id'>) => {
    setItems(prevItems => {
      const hasMaxQuantity = typeof newItem.maxQuantity === 'number' && Number.isFinite(newItem.maxQuantity);
      const maxQuantity = hasMaxQuantity ? Math.max(0, Math.floor(newItem.maxQuantity as number)) : null;

      // If this item is out of stock, don't add it.
      if (maxQuantity !== null && maxQuantity <= 0) {
        return prevItems;
      }

      // Check if item already exists in cart
      const existingItemIndex = prevItems.findIndex(
        item => item.productId === newItem.productId && item.variantId === newItem.variantId
      );
      
      if (existingItemIndex > -1) {
        // Update quantity of existing item
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + newItem.quantity;
        
        // Check max quantity constraint
        if (maxQuantity !== null && newQuantity > maxQuantity) {
          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: maxQuantity
          };
        } else {
          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: newQuantity
          };
        }
        
        return updatedItems;
      } else {
        // Add new item to cart
        const cartItem: CartItem = {
          ...newItem,
          ...(maxQuantity !== null ? { maxQuantity } : {}),
          id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        return [...prevItems, cartItem];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === itemId) {
          // Check max quantity constraint
          const finalQuantity = item.maxQuantity 
            ? Math.min(quantity, item.maxQuantity) 
            : quantity;
          
          return { ...item, quantity: finalQuantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setShippingOption(null);
    // Also clear from localStorage
    localStorage.removeItem(resolveCartKey(currentUserId, storeScope));
    localStorage.removeItem(resolveShippingKey(currentUserId, storeScope));
    localStorage.removeItem(LEGACY_CART_KEY);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getShippingTotal = () => {
    const perItem = items.reduce((total, item) => total + (item.shippingCost || 0) * (item.quantity || 0), 0);
    if (shippingOption) {
      return shippingOption.cost || 0;
    }
    return perItem;
  };

  const isInCart = (productId: string) => {
    return items.some(item => item.productId === productId);
  };

  const value: CartContextType = {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
    getShippingTotal,
    isInCart
    ,
    shippingOption,
    setShippingOption
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

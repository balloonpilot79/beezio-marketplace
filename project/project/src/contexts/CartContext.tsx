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

  const GUEST_CART_KEY = 'beezio-cart-guest';
  const resolveShippingKey = (userId: string | null) =>
    userId ? `beezio-shipping-${userId}` : 'beezio-shipping-guest';

  const loadStoredShippingOption = (userId: string | null) => {
    const storageKey = resolveShippingKey(userId);
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

  // Load cart from localStorage on component mount AND track user
  useEffect(() => {
    // Get current user from Supabase session
    const checkUserAndLoadCart = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      
      // If user changed, clear cart
      if (userId !== currentUserId) {
        setCurrentUserId(userId);
        
        if (userId) {
          // New user logged in - load their cart, and migrate any guest cart if present
          const userCartKey = `beezio-cart-${userId}`;
          const savedUserCart = localStorage.getItem(userCartKey);

          // If the user cart is empty/missing but a guest cart exists, migrate it.
          if (!savedUserCart) {
            const guestCart = localStorage.getItem(GUEST_CART_KEY);
            if (guestCart) {
              localStorage.setItem(userCartKey, guestCart);
              localStorage.removeItem(GUEST_CART_KEY);
            }
          }

          const resolvedCart = localStorage.getItem(userCartKey);
          if (resolvedCart) {
            try {
              setItems(JSON.parse(resolvedCart));
            } catch (error) {
              console.error('Error loading cart from localStorage:', error);
              setItems([]);
            }
          } else {
            setItems([]);
          }
        } else {
          // User logged out - load guest cart (if any)
          const guestCart = localStorage.getItem(GUEST_CART_KEY);
          if (guestCart) {
            try {
              setItems(JSON.parse(guestCart));
            } catch (error) {
              console.error('Error loading guest cart from localStorage:', error);
              setItems([]);
            }
          } else {
            setItems([]);
          }
        }
      }
      loadStoredShippingOption(userId);
    };
    
    checkUserAndLoadCart();
  }, [currentUserId]);

  // Save cart to localStorage whenever items change - PER USER
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`beezio-cart-${currentUserId}`, JSON.stringify(items));
    } else {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
    }
    // Also clear old global cart key if it exists
    localStorage.removeItem('beezio-cart');
  }, [items, currentUserId]);

  useEffect(() => {
    const key = resolveShippingKey(currentUserId);
    if (shippingOption) {
      localStorage.setItem(key, JSON.stringify(shippingOption));
    } else {
      localStorage.removeItem(key);
    }
  }, [shippingOption, currentUserId]);

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
    if (currentUserId) {
      localStorage.removeItem(`beezio-cart-${currentUserId}`);
      localStorage.removeItem(resolveShippingKey(currentUserId));
    } else {
      localStorage.removeItem(GUEST_CART_KEY);
      localStorage.removeItem(resolveShippingKey(null));
    }
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getShippingTotal = () => {
    const perItem = items.reduce((total, item) => total + (item.shippingCost || 0) * (item.quantity || 0), 0);
    return perItem + (shippingOption?.cost || 0);
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

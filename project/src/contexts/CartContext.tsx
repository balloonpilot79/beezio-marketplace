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
      isInCart: () => false
    };
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
          // New user logged in - load their cart
          const savedCart = localStorage.getItem(`beezio-cart-${userId}`);
          if (savedCart) {
            try {
              setItems(JSON.parse(savedCart));
            } catch (error) {
              console.error('Error loading cart from localStorage:', error);
              setItems([]);
            }
          } else {
            setItems([]);
          }
        } else {
          // User logged out - clear cart
          setItems([]);
        }
      }
    };
    
    checkUserAndLoadCart();
  }, [currentUserId]);

  // Save cart to localStorage whenever items change - PER USER
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(`beezio-cart-${currentUserId}`, JSON.stringify(items));
    }
    // Also clear old global cart key if it exists
    localStorage.removeItem('beezio-cart');
  }, [items, currentUserId]);

  const addToCart = (newItem: Omit<CartItem, 'id'>) => {
    setItems(prevItems => {
      // Check if item already exists in cart
      const existingItemIndex = prevItems.findIndex(item => item.productId === newItem.productId);
      
      if (existingItemIndex > -1) {
        // Update quantity of existing item
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];
        const newQuantity = existingItem.quantity + newItem.quantity;
        
        // Check max quantity constraint
        if (newItem.maxQuantity && newQuantity > newItem.maxQuantity) {
          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: newItem.maxQuantity
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
    // Also clear from localStorage
    if (currentUserId) {
      localStorage.removeItem(`beezio-cart-${currentUserId}`);
    }
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getShippingTotal = () => {
    return items.reduce((total, item) => total + (item.shippingCost || 0), 0);
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
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

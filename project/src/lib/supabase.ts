import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Log configuration status for debugging
if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
  console.warn('Supabase not configured. Please create a .env file with your Supabase credentials.');
}

export const isSupabaseConfigured = (
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string;
          role: 'buyer' | 'seller' | 'affiliate' | 'fundraiser' | 'admin';
          primary_role?: 'buyer' | 'seller' | 'affiliate' | 'fundraiser' | 'admin' | null;
          referred_by_affiliate_id?: string | null;
          avatar_url?: string;
          bio?: string;
          website?: string;
          location?: string;
          phone?: string;
          zip_code?: string;
          stripe_customer_id?: string;
          stripe_account_id?: string;
          created_at: string;
          updated_at: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description?: string;
          icon_name?: string;
          slug: string;
          parent_id?: string;
          created_at: string;
        };
      };
      products: {
        Row: {
          id: string;
          seller_id: string;
          category_id?: string;
          title: string;
          description?: string;
          // Product lineage / source: affects fulfillment, fees, etc.
          // Backed by a text/varchar column in the products table.
          // Expected values (non-exhaustive):
          // - 'CJ'            → imported from CJ dropshipping
          // - 'SELLER_DIRECT' → manually added by a seller
          // - 'BEEZIO_HOUSE'  → Beezio-owned products
          lineage?: 'CJ' | 'SELLER_DIRECT' | 'BEEZIO_HOUSE' | string | null;
          price: number;
          seller_ask?: number | null;
          seller_amount?: number | null;
          seller_ask_price?: number | null;
          currency?: string | null;
          images: string[];
          stock_quantity: number;
          is_active: boolean;
          is_subscription?: boolean | null;
          subscription_interval?: string | null;
          subscription_price?: number | null;
          affiliate_enabled?: boolean;
          commission_rate: number;
          commission_type: 'percentage' | 'flat_rate';
          flat_commission_amount: number;
          affiliate_commission_type?: 'percent' | 'flat';
          affiliate_commission_value?: number | null;
          calculated_customer_price?: number | null;
          shipping_cost: number;
          shipping_price?: number | null;
          tags: string[];
          videos: string[];
          unique_slug?: string;
          views_count: number;
          clicks_count: number;
          conversions_count: number;
          created_at: string;
          updated_at: string;
        };
      };
      affiliate_stores: {
        Row: {
          id: string;
          profile_id: string;
          store_name: string;
          store_slug: string;
          description: string;
          logo_url?: string;
          banner_url?: string;
          custom_domain?: string;
          is_active: boolean;
          theme_color: string;
          created_at: string;
          updated_at: string;
        };
      };
      affiliate_store_products: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          added_at: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string | null;
          product_id: string | null;
          seller_id: string | null;
          affiliate_id?: string | null;
          affiliate_referrer_id?: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
          sale_price?: number | null;
          seller_payout?: number | null;
          affiliate_commission?: number | null;
          referral_bonus?: number | null;
          beezio_gross?: number | null;
          beezio_net?: number | null;
          stripe_fee?: number | null;
          commission_rate?: number | null;
          affiliate_commission_rate?: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'buyer' | 'seller' | 'affiliate' | 'fundraiser' | 'admin';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Log configuration status for debugging
if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
  console.warn('Supabase not configured. Please create a .env file with your Supabase credentials.');
}

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
          role: 'buyer' | 'seller' | 'affiliate';
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
          price: number;
          images: string[];
          stock_quantity: number;
          is_active: boolean;
          commission_rate: number;
          commission_type: 'percentage' | 'flat_rate';
          flat_commission_amount: number;
          shipping_cost: number;
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
    };
  };
};
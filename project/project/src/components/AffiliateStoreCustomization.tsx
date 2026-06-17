import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Save,
  Eye,
  Palette,
  Settings,
  Zap,
  Heart,
  Globe,
  PackagePlus,
  LayoutTemplate,
  FileText,
  Wand2,
  ArrowUp,
  ArrowDown,
  Star,
  Trash2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CustomDomainManager from './CustomDomainManager';
import { getStoreUrl } from '../utils/customDomainRouter';
import CustomPageBuilder from './CustomPageBuilder';
import ImageUploader from './ImageUploader';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { ensureProfileIdForUser, resolveProfileIdForUser } from '../utils/resolveProfileId';
import { blocksToHtml, starterPackTemplates } from '../utils/storePageTemplates';
import { resolveProductImageFromList } from '../utils/imageHelpers';
import { addAffiliateProduct } from '../api/affiliateStore';
import StoreTemplateSelector, { type StoreTemplate } from './StoreTemplateSelector';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { normalizeStoreSlug } from '../utils/normalizeStoreSlug';

interface AffiliateStoreSettings {
  store_name?: string;
  store_description?: string;
  store_banner?: string;
  store_logo?: string;
  store_theme?: string;
  template_id?: string;
  layout_config?: {
    header_style?: string;
    product_grid?: string;
    sidebar?: boolean;
    footer_style?: string;
    grid_layout?: 'compact' | 'standard' | 'comfortable' | 'large';
    background_image_url?: string;
  };
  color_scheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  subdomain?: string;
  custom_domain?: string;
  social_links?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    website?: string;
  };
  favorite_categories?: string[];
  commission_goal?: number;
}

const AffiliateStoreCustomization: React.FC<{ affiliateId: string }> = ({ affiliateId }) => {
  const { user } = useAuth();
  const [resolvedStoreAffiliateId, setResolvedStoreAffiliateId] = useState<string>('');
  const [storeSettings, setStoreSettings] = useState<AffiliateStoreSettings>({
    store_theme: 'vibrant',
    social_links: {},
    favorite_categories: [],
    layout_config: {
      grid_layout: 'standard'
    },
    color_scheme: {
      primary: '#7c3aed',
      secondary: '#0ea5e9',
      accent: '#f59e0b',
      background: '#ffffff',
      text: '#0f172a'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');
  const [curatedProducts, setCuratedProducts] = useState<any[]>([]);
  const [curatedLoading, setCuratedLoading] = useState(true);
  const [newProductInput, setNewProductInput] = useState('');
  const [productActionLoading, setProductActionLoading] = useState(false);
  const [productActionMessage, setProductActionMessage] = useState<string | null>(null);
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [marketplaceProducts, setMarketplaceProducts] = useState<any[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceCategory, setMarketplaceCategory] = useState('All');
  const [marketplacePage, setMarketplacePage] = useState(1);
  const [marketplaceTotal, setMarketplaceTotal] = useState(0);
  const [creatingStarterPages, setCreatingStarterPages] = useState(false);
  const [marketplaceSort, setMarketplaceSort] = useState<'price_desc' | 'price_asc' | 'commission_desc' | 'commission_asc'>('price_desc');
  const [activeTemplate, setActiveTemplate] = useState<string>('modern-grid');
  const initialSnapshotRef = useRef<string>('');

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setResolvedStoreAffiliateId(String(affiliateId || '').trim());
      return () => {
        alive = false;
      };
    }

    void (async () => {
      const resolved = await resolveProfileIdForUser(user.id);
      if (alive) {
        setResolvedStoreAffiliateId(String(resolved || affiliateId || user.id).trim());
      }
    })();

    return () => {
      alive = false;
    };
  }, [affiliateId, user?.id]);

  const MARKETPLACE_PAGE_SIZE = 12;
  const DEFAULT_CATEGORY_OPTIONS = [
    'All',
    'Electronics', 'Fashion', 'Home & Garden', 'Health & Beauty',
    'Sports & Fitness', 'Books & Media', 'Food & Beverages', 'Toys & Games',
    'Pet Supplies', 'Automotive', 'Art & Crafts', 'Music & Instruments',
    'Travel & Experiences', 'Business & Industrial', 'Baby & Kids', 'Jewelry'
  ];
  const reservedSlugs = new Set([
    'home','marketplace','stores','affiliates','affiliate','partner','affiliate-signup','affiliate-dashboard-preview',
    'seller','sellers','store','products','product','dashboard','dashboard-preview','buyer-dashboard-preview',
    'admin','auth','login','signup','onboarding','messages','earnings','checkout','cart',
    'about','contact','privacy','terms','faq','search','how-it-works','get-started','start-earning',
    'add-product','add-product-old','profile','orders','order-confirmation','contact-support','write-review',
    'reset-password','change-password','test','testing','revolutionary','api'
  ]);
  const normalizeSlugInput = (value: string) =>
    normalizeStoreSlug(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  const isValidSlug = (value: string) => {
    if (!value) return true;
    if (!/^[a-z0-9-]{3,32}$/.test(value)) return false;
    if (value.includes('beezio') || value.includes('bzo')) return false;
    if (reservedSlugs.has(value)) return false;
    return true;
  };
  const checkSlugAvailability = async (slug: string, ownerId: string) => {
    if (!slug) return true;
    const [
      { data: sellerMatch, error: sellerCheckError },
      { data: affiliateMatch, error: affiliateCheckError }
    ] = await Promise.all([
      supabase.from('store_settings').select('seller_id').eq('subdomain', slug).maybeSingle(),
      supabase.from('affiliate_store_settings').select('affiliate_id').eq('subdomain', slug).maybeSingle(),
    ]);
    if (sellerCheckError && sellerCheckError.code !== 'PGRST116') throw sellerCheckError;
    if (affiliateCheckError && affiliateCheckError.code !== 'PGRST116') throw affiliateCheckError;

    if (sellerMatch?.seller_id && String(sellerMatch.seller_id) !== String(ownerId)) return false;
    if (affiliateMatch?.affiliate_id && String(affiliateMatch.affiliate_id) !== String(ownerId)) return false;
    return true;
  };
  const [marketplaceCategoryOptions, setMarketplaceCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Prefer DB categories if present so the dropdown matches actual product values.
        let { data, error } = await supabase.from('categories').select('name').order('sort_order', { ascending: true });
        const msg = String((error as any)?.message || '');
        if (error && /sort_order/i.test(msg)) {
          ({ data, error } = await supabase.from('categories').select('name').order('name', { ascending: true }));
        }
        if (!cancelled && !error && Array.isArray(data) && data.length) {
          const names = data.map((r: any) => String(r?.name || '').trim()).filter(Boolean);
          const unique = Array.from(new Set(names));
          setMarketplaceCategoryOptions(['All', ...unique]);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!marketplaceCategoryOptions.includes(marketplaceCategory)) {
      setMarketplaceCategory('All');
    }
  }, [marketplaceCategory, marketplaceCategoryOptions]);

  useEffect(() => {
    initialSnapshotRef.current = '';
    setHasUnsavedChanges(false);
    fetchAffiliateSettings();
    loadCuratedProducts();
  }, [affiliateId, resolvedStoreAffiliateId]);

  useEffect(() => {
    if (loading) return;
    const current = JSON.stringify(storeSettings);
    if (!initialSnapshotRef.current) {
      initialSnapshotRef.current = current;
      setHasUnsavedChanges(false);
      return;
    }
    setHasUnsavedChanges(current !== initialSnapshotRef.current);
  }, [loading, storeSettings]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let cancelled = false;

    const timeout = setTimeout(() => {
      void (async () => {
        setMarketplaceLoading(true);
        try {
          const from = (marketplacePage - 1) * MARKETPLACE_PAGE_SIZE;
          const to = from + MARKETPLACE_PAGE_SIZE - 1;

          const selectCandidates = [
            // Newer schema (commission columns + category)
            'id,title,description,price,images,category,seller_ask,seller_amount,seller_ask_price,affiliate_commission_rate,affiliate_commission_type,affiliate_commission_value,commission_rate,commission_type,flat_commission_amount',
            // Mid schema (legacy commission columns + maybe category)
            'id,title,description,price,images,category,seller_ask,seller_amount,seller_ask_price,affiliate_commission_rate,affiliate_commission_value,commission_rate,commission_type,flat_commission_amount',
            // Mid schema (commission columns without category)
            'id,title,description,price,images,seller_ask,seller_amount,seller_ask_price,affiliate_commission_rate,affiliate_commission_type,affiliate_commission_value,commission_rate,commission_type,flat_commission_amount',
            // Older schema (no commission/category columns)
            'id,title,description,price,images',
          ];

          let lastError: any = null;
          let data: any[] | null = null;
          let count: number | null = null;

          for (const select of selectCandidates) {
            try {
              let query = supabase
                .from('products')
                .select(select, { count: 'exact' })
                .eq('is_active', true);

              const q = marketplaceSearch.trim();
              if (q) {
                query = query.ilike('title', `%${q}%`);
              }

              // Category filtering is best-effort (older schemas may not have category).
              // If a schema doesn't support it, we'll retry without it.
              const wantsCategory = marketplaceCategory !== 'All';
              if (wantsCategory) {
                query = query.eq('category', marketplaceCategory);
              }

              // Order must reference existing columns; default to `id` which always exists.
              if (marketplaceSort === 'price_desc') {
                query = query.order('price', { ascending: false }).order('id', { ascending: false });
              } else if (marketplaceSort === 'price_asc') {
                query = query.order('price', { ascending: true }).order('id', { ascending: false });
              } else {
                query = query.order('id', { ascending: false });
              }

              const res = await query.range(from, to);
              if (res.error) throw res.error;
              data = (res.data as any[]) || [];
              count = typeof res.count === 'number' ? res.count : 0;
              lastError = null;
              break;
            } catch (e: any) {
              lastError = e;
              const msg = String(e?.message || '');
              const code = String(e?.code || '');
              const status = Number(e?.status || e?.statusCode || 0);
              const missingColumn = status === 400 && (/column/i.test(msg) && /does not exist/i.test(msg));
              const badOrder = status === 400 && (/failed to parse/i.test(msg) || /unexpected/i.test(msg) || /order/i.test(msg));
              const missingCategory = status === 400 && /category/i.test(msg) && /does not exist/i.test(msg);
              const retryable = missingColumn || missingCategory || badOrder || code === '42703';

              // If category filtering broke the request, retry once without the category filter.
              if (retryable && /category/i.test(msg)) {
                try {
                  let query = supabase
                    .from('products')
                    .select(select, { count: 'exact' })
                    .eq('is_active', true);

                  const q = marketplaceSearch.trim();
                  if (q) query = query.ilike('title', `%${q}%`);

                  if (marketplaceSort === 'price_desc') {
                    query = query.order('price', { ascending: false }).order('id', { ascending: false });
                  } else if (marketplaceSort === 'price_asc') {
                    query = query.order('price', { ascending: true }).order('id', { ascending: false });
                  } else {
                    query = query.order('id', { ascending: false });
                  }

                  const res = await query.range(from, to);
                  if (!res.error) {
                    data = (res.data as any[]) || [];
                    count = typeof res.count === 'number' ? res.count : 0;
                    lastError = null;
                    break;
                  }
                  lastError = res.error;
                } catch (e2: any) {
                  lastError = e2;
                }
              }

              if (!retryable) break;
            }
          }

          if (!data) {
            throw lastError || new Error('Failed to load products');
          }

          if (!cancelled) {
            const rows = (data || []).slice();

            const computeCommissionAmount = (mp: any) => {
              const price = getBuyerFacingProductPrice(mp || {});
              const rawType = String(mp?.affiliate_commission_type || mp?.commission_type || 'percentage').toLowerCase();
              const isFixed = rawType === 'fixed' || rawType === 'flat_rate' || rawType === 'flat';
              const rawRate = Number(mp?.affiliate_commission_rate ?? mp?.commission_rate ?? 0);
              const fixedAmount = Number(mp?.affiliate_commission_rate ?? mp?.flat_commission_amount ?? 0);
              const pct = rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate;
              const commissionAmount = isFixed ? fixedAmount : price * (pct / 100);
              return Number.isFinite(commissionAmount) ? commissionAmount : 0;
            };

            if (marketplaceSort === 'commission_desc' || marketplaceSort === 'commission_asc') {
              rows.sort((a, b) => {
                const diff = computeCommissionAmount(a) - computeCommissionAmount(b);
                return marketplaceSort === 'commission_asc' ? diff : -diff;
              });
            }

            setMarketplaceProducts(rows);
            setMarketplaceTotal(typeof count === 'number' ? count : 0);
          }
        } catch (e) {
          console.error('Error loading marketplace products:', e);
          if (!cancelled) {
            setMarketplaceProducts([]);
            setMarketplaceTotal(0);
          }
        } finally {
          if (!cancelled) setMarketplaceLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [affiliateId, marketplaceCategory, marketplacePage, marketplaceSearch, marketplaceSort]);

  useEffect(() => {
    setMarketplacePage(1);
  }, [marketplaceCategory, marketplaceSearch, marketplaceSort]);

  useEffect(() => {
    if (productActionMessage) {
      const timeout = setTimeout(() => setProductActionMessage(null), 4000);
      return () => clearTimeout(timeout);
    }
  }, [productActionMessage]);

  useEffect(() => {
    const handler = () => {
      // Best-effort refresh when products are added elsewhere (marketplace modal, etc.).
      void loadCuratedProducts();
    };
    window.addEventListener('affiliate-products-changed', handler as any);
    return () => window.removeEventListener('affiliate-products-changed', handler as any);
  }, [affiliateId, resolvedStoreAffiliateId]);

  const loadCuratedProducts = async () => {
    const effectiveAffiliateId = String(resolvedStoreAffiliateId || affiliateId || '').trim();
    if (!effectiveAffiliateId) {
      setCuratedProducts([]);
      setCuratedLoading(false);
      return;
    }
      setCuratedLoading(true);
    try {
      const affiliateIds = Array.from(
        new Set([effectiveAffiliateId, affiliateId, user?.id].filter(Boolean).map(String))
      );
      const { data, error } = await supabase
        .from('affiliate_products')
        .select(`
          id,
          product_id,
          display_order,
          is_featured,
          products (
            id,
            title,
            description,
            price,
            seller_ask,
            seller_amount,
            seller_ask_price,
            affiliate_commission_rate,
            affiliate_commission_type,
            affiliate_commission_value,
            commission_rate,
            commission_type,
            flat_commission_amount,
            images,
            is_active,
            profiles!products_seller_id_fkey (full_name)
          )
        `)
        .in('affiliate_id', affiliateIds)
        .eq('products.is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      setCuratedProducts(data || []);
    } catch (error) {
      console.error('Error loading curated products:', error);
      setCuratedProducts([]);
    } finally {
      setCuratedLoading(false);
    }
  };

  const fetchAffiliateSettings = async () => {
    const effectiveAffiliateId = String(resolvedStoreAffiliateId || affiliateId || '').trim();
    if (!effectiveAffiliateId) {
      setLoading(false);
      return;
    }

    // Try to get affiliate store settings
    const { data, error } = await supabase
      .from('affiliate_store_settings')
      .select('*')
      .eq('affiliate_id', effectiveAffiliateId)
      .maybeSingle();
    
    if (error && (error as any).code !== 'PGRST116') {
      console.warn('[AffiliateStoreCustomization] settings fetch failed (non-fatal):', error);
    }

    if (data) {
      setStoreSettings(prev => ({
        ...prev,
        ...data,
        social_links: data.social_links || {},
        favorite_categories: data.favorite_categories || [],
        custom_domain: data.custom_domain || '',
        subdomain: normalizeSlugInput(data.subdomain || ''),
        layout_config: data.layout_config || prev.layout_config,
        color_scheme: data.color_scheme || prev.color_scheme
      }));
      if (data.template_id) {
        setActiveTemplate(data.template_id);
      }
    } else {
      setStoreSettings(prev => ({
        ...prev,
        social_links: prev.social_links || {},
        favorite_categories: prev.favorite_categories || []
      }));
    }
    
    setLoading(false);
  };

  const addCuratedProductById = async (productId: string) => {
    if (!productId) return;

    if (curatedProducts.some((product) => product.product_id === productId)) {
      setProductActionMessage('That product is already part of your store.');
      return;
    }
    if (user?.id) {
      await ensureProfileIdForUser(user);
    }
    await addAffiliateProduct(productId, { affiliateId: resolvedStoreAffiliateId || affiliateId });

    setProductActionMessage('Product added to your curated list.');
    await loadCuratedProducts();
  };

  const mapTemplateGridToLayout = (grid?: string): AffiliateStoreSettings['layout_config']['grid_layout'] => {
    switch (grid) {
      case '2-col':
        return 'large';
      case '3-col':
        return 'comfortable';
      case '4-col':
        return 'standard';
      case 'masonry':
        return 'comfortable';
      case 'carousel':
        return 'large';
      default:
        return 'standard';
    }
  };

  const handleAddProduct = async () => {
    if (!newProductInput.trim()) {
      setProductActionMessage('Enter a product ID or slug first.');
      return;
    }

    setProductActionLoading(true);
    setProductActionMessage(null);

    try {
      const identifier = newProductInput.trim();
      const { data: productRecord, error: productLookupError } = await supabase
        .from('products')
        .select('id')
        .or(`id.eq.${identifier},unique_slug.eq.${identifier}`)
        .eq('is_active', true)
        .maybeSingle();

      if (productLookupError && productLookupError.code !== 'PGRST116') {
        throw productLookupError;
      }

      if (!productRecord) {
        setProductActionMessage('Product not found. Double-check the ID or slug.');
        return;
      }

      await addCuratedProductById(String(productRecord.id));
      setNewProductInput('');
    } catch (error) {
      console.error('Error adding curated product:', error);
      setProductActionMessage('Could not add that product. Please try again.');
    } finally {
      setProductActionLoading(false);
    }
  };

  const handleRemoveProduct = async (rowId: string) => {
    setProductActionLoading(true);
    setProductActionMessage(null);
    try {
      const { error } = await supabase
        .from('affiliate_products')
        .delete()
        .eq('id', rowId);
      if (error) throw error;
      setProductActionMessage('Product removed from your storefront.');
      await loadCuratedProducts();
    } catch (error) {
      console.error('Error removing curated product:', error);
      setProductActionMessage('Failed to remove that product.');
    } finally {
      setProductActionLoading(false);
    }
  };

  const handleMoveProduct = async (rowId: string, direction: 'up' | 'down') => {
    const currentIndex = curatedProducts.findIndex(product => product.id === rowId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= curatedProducts.length) return;

    const current = curatedProducts[currentIndex];
    const target = curatedProducts[targetIndex];

    setProductActionLoading(true);
    setProductActionMessage(null);

    try {
      await Promise.all([
        supabase
          .from('affiliate_products')
          .update({ display_order: target.display_order ?? targetIndex + 1 })
          .eq('id', current.id),
        supabase
          .from('affiliate_products')
          .update({ display_order: current.display_order ?? currentIndex + 1 })
          .eq('id', target.id),
      ]);

      setProductActionMessage('Product order updated.');
      await loadCuratedProducts();
    } catch (error) {
      console.error('Error reordering curated products:', error);
      setProductActionMessage('Failed to reorder products.');
    } finally {
      setProductActionLoading(false);
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const ordered = [...curatedProducts].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const items = Array.from(ordered);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updated = items.map((product, index) => ({
      ...product,
      display_order: index
    }));

    setCuratedProducts(updated);
    setProductActionLoading(true);
    setProductActionMessage(null);

    try {
      await Promise.all(
        updated.map((product, index) =>
          supabase
            .from('affiliate_products')
            .update({ display_order: index })
            .eq('id', product.id)
        )
      );
      setProductActionMessage('Product order updated.');
    } catch (error) {
      console.error('Error reordering curated products:', error);
      setProductActionMessage('Failed to reorder products.');
      await loadCuratedProducts();
    } finally {
      setProductActionLoading(false);
    }
  };

  const handleToggleFeatured = async (rowId: string, nextValue: boolean) => {
    setProductActionLoading(true);
    setProductActionMessage(null);

    try {
      const { error } = await supabase
        .from('affiliate_products')
        .update({ is_featured: nextValue })
        .eq('id', rowId);

      if (error) throw error;

      setProductActionMessage(nextValue ? 'Product marked as featured.' : 'Product removed from featured list.');
      await loadCuratedProducts();
    } catch (error) {
      console.error('Error toggling featured product:', error);
      setProductActionMessage('Could not update featured status.');
    } finally {
      setProductActionLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ownerId = user ? await ensureProfileIdForUser(user) : affiliateId;
      const effectiveAffiliateId = String(resolvedStoreAffiliateId || ownerId || affiliateId || '').trim();
      const saveOwnerId = effectiveAffiliateId || ownerId;
      if (!saveOwnerId) {
        alert('Missing profile id. Please refresh and try again.');
        setSaving(false);
        return;
      }

      const normalizedSlug = normalizeSlugInput(storeSettings.subdomain || '');
      if (!isValidSlug(normalizedSlug)) {
        alert('Store URL slug must be 3-32 characters, lowercase letters/numbers/hyphens only, and not reserved.');
        setSaving(false);
        return;
      }
      try {
        const slugAvailable = await checkSlugAvailability(normalizedSlug, saveOwnerId);
        if (!slugAvailable) {
          alert('That store URL slug is already taken. Please choose another.');
          setSaving(false);
          return;
        }
      } catch (error) {
        console.error('[AffiliateStoreCustomization] Failed to validate slug availability:', error);
        alert('Could not validate the store URL slug. Please try again.');
        setSaving(false);
        return;
      }

      const payload: Record<string, any> = {
        affiliate_id: saveOwnerId,
        store_name: storeSettings.store_name || null,
        store_description: storeSettings.store_description || null,
        store_banner: storeSettings.store_banner || null,
        store_logo: storeSettings.store_logo || null,
        store_theme: storeSettings.store_theme || null,
        template_id: storeSettings.template_id || null,
        layout_config: storeSettings.layout_config || null,
        color_scheme: storeSettings.color_scheme || null,
        subdomain: normalizedSlug || null,
        custom_domain: storeSettings.custom_domain || null,
        social_links: storeSettings.social_links || {},
        favorite_categories: storeSettings.favorite_categories || [],
        commission_goal: storeSettings.commission_goal || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('affiliate_store_settings')
        .upsert(payload, { onConflict: 'affiliate_id' });

      if (error) throw error;
      initialSnapshotRef.current = JSON.stringify({
        ...storeSettings,
        subdomain: normalizedSlug || '',
      });
      setHasUnsavedChanges(false);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    }
    setSaving(false);
  };

  const handleGenerateStarterPages = async () => {
    try {
      setCreatingStarterPages(true);
      const ownerId = user?.id ? await ensureProfileIdForUser(user) : affiliateId;
      const effectiveAffiliateId = String(resolvedStoreAffiliateId || ownerId || affiliateId || '').trim();
      if (!effectiveAffiliateId) {
        alert('Missing profile id. Please refresh and try again.');
        return;
      }

      const { data: existingPages, error: existingError } = await supabase
        .from('custom_pages')
        .select('page_slug, display_order')
        .eq('owner_id', effectiveAffiliateId)
        .eq('owner_type', 'affiliate');
      if (existingError) throw existingError;

      const existingSlugs = new Set((existingPages || []).map((page: any) => page.page_slug));
      const maxOrder = Math.max(0, ...(existingPages || []).map((page: any) => page.display_order || 0));
      const inserts = starterPackTemplates
        .filter((template) => !existingSlugs.has(template.slug))
        .map((template, index) => ({
          owner_id: effectiveAffiliateId,
          owner_type: 'affiliate',
          page_slug: template.slug,
          page_title: template.title,
          page_content: blocksToHtml(template.createBlocks()),
          is_active: true,
          display_order: maxOrder + index + 1,
          updated_at: new Date().toISOString(),
        }));

      if (inserts.length === 0) {
        alert('Starter pages already exist.');
        return;
      }

      const { error: insertError } = await supabase
        .from('custom_pages')
        .insert(inserts);
      if (insertError) throw insertError;

      alert('Starter pages created. Visit Custom Pages to edit and publish.');
    } catch (error: any) {
      console.error('[AffiliateStoreCustomization] Failed to create starter pages:', error);
      alert(`Failed to create starter pages. ${error?.message || 'Please try again.'}`);
    } finally {
      setCreatingStarterPages(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setStoreSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialLinkChange = (platform: string, url: string) => {
    setStoreSettings(prev => ({
      ...prev,
      social_links: { ...prev.social_links, [platform]: url }
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setStoreSettings(prev => ({
      ...prev,
      favorite_categories: prev.favorite_categories?.includes(category)
        ? prev.favorite_categories.filter(c => c !== category)
        : [...(prev.favorite_categories || []), category]
    }));
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>;
  }

  const storeUrl = getStoreUrl(
    resolvedStoreAffiliateId || affiliateId,
    'affiliate',
    storeSettings.custom_domain || undefined,
    storeSettings.subdomain || undefined
  );
  const hasStoreIdentity = Boolean(String(storeSettings.store_name || '').trim()) && Boolean(String(storeSettings.subdomain || '').trim());
  const hasBranding =
    Boolean(String(storeSettings.store_logo || '').trim()) ||
    Boolean(String(storeSettings.store_banner || '').trim()) ||
    Boolean(String(storeSettings.layout_config?.background_image_url || '').trim());
  const curatedProductIds = new Set(curatedProducts.map((p: any) => p.product_id).filter(Boolean));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-extrabold mb-2 tracking-tight">Partner Store Customization</h2>
            <p className="text-lg text-purple-100">Personalize your affiliate store to attract more customers</p>
          </div>
          <div className="flex items-center gap-4">
            {hasUnsavedChanges && (
              <span className="text-sm font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-3 py-2 rounded-lg">
                Unsaved changes
              </span>
            )}
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 border border-purple-200 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold shadow transition-all"
            >
              <Eye className="w-5 h-5" />
              <span>Preview Store</span>
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-all shadow disabled:opacity-60"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-white to-pink-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-700">Your store URL</div>
            <div className="text-sm text-gray-600">Share this link. Checkout always stays on Beezio.</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-700">
              {storeUrl}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(storeUrl)}
              className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            >
              Copy
            </button>
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            >
              Open
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="border-b">
            <nav className="mx-auto flex w-max min-w-full items-center justify-center gap-3 overflow-x-auto px-4 sm:px-8">
              {[
                { id: 'quickstart', name: 'Quick Setup', icon: Zap },
                { id: 'builder', name: 'Builder', icon: Wand2 },
                { id: 'general', name: 'General', icon: Settings },
                { id: 'appearance', name: 'Branding', icon: Palette },
                { id: 'templates', name: 'Templates', icon: LayoutTemplate },
                { id: 'categories', name: 'Categories', icon: Heart },
                { id: 'products', name: 'Products', icon: PackagePlus },
                { id: 'pages', name: 'Pages', icon: FileText },
                { id: 'domain', name: 'Domain & Links', icon: Globe }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`shrink-0 flex items-center gap-2 px-2 py-5 border-b-4 font-bold text-base transition-all ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-700 bg-purple-50'
                      : 'border-transparent text-gray-500 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Quick Setup</h3>
                <p className="text-gray-700">
                  Build your partner store with a simple 4-step flow. Product purchases always stay on Beezio checkout.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">1. Set store name and URL</div>
                    <div className="text-sm text-gray-600">Name, slug, and store description.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${hasStoreIdentity ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {hasStoreIdentity ? 'Done' : 'Needs setup'}
                    </span>
                    <button onClick={() => setActiveTab('general')} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-semibold">
                      Open
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">2. Upload logo, banner, and theme</div>
                    <div className="text-sm text-gray-600">Controls the logo placement and banner shown on your custom store.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${hasBranding ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {hasBranding ? 'Done' : 'Needs setup'}
                    </span>
                    <button onClick={() => setActiveTab('appearance')} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-semibold">
                      Open
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">3. Add products (dashboard or marketplace)</div>
                    <div className="text-sm text-gray-600">Use Products tab or marketplace Add to My Store.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${curatedProducts.length > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {curatedProducts.length > 0 ? `${curatedProducts.length} added` : 'No products yet'}
                    </span>
                    <button onClick={() => setActiveTab('products')} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-semibold">
                      Open
                    </button>
                    <a href="/marketplace" className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-semibold">
                      Marketplace
                    </a>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">4. Save and preview</div>
                    <div className="text-sm text-gray-600">Publish changes and test your live storefront.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving} className="px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm font-semibold disabled:opacity-60">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-semibold">
                      Preview
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'builder' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Build your partner storefront</h3>
                <p className="text-gray-700">
                  Start with a storefront template, then customize pages and content to match your brand.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Storefront Template</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Pick a layout for your homepage and product grid.
                </p>
                <StoreTemplateSelector
                  category="storefront"
                  currentTemplateId={storeSettings.template_id || activeTemplate}
                  onSelectTemplate={(template: StoreTemplate) => {
                    setActiveTemplate(template.id);
                    setStoreSettings((prev) => ({
                      ...prev,
                      template_id: template.id,
                      store_theme: template.theme,
                      layout_config: {
                        ...template.layout,
                        grid_layout: mapTemplateGridToLayout(template.layout?.product_grid),
                      },
                    }));
                  }}
                />
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Starter pages</div>
                  <div>Create About, FAQ, Shipping, Returns, and Contact pages you can edit.</div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateStarterPages}
                  disabled={creatingStarterPages}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creatingStarterPages ? 'Creating...' : 'Generate starter pages'}
                </button>
              </div>
            </div>
          )}
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={storeSettings.store_name || ''}
                    onChange={(e) => handleInputChange('store_name', e.target.value)}
                    placeholder="Your Partner Store Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store URL Slug
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={storeSettings.subdomain || ''}
                      onChange={(e) => handleInputChange('subdomain', normalizeSlugInput(e.target.value))}
                      placeholder="yourstore"
                      className="flex-1 min-w-[220px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => handleInputChange('subdomain', normalizeSlugInput(storeSettings.store_name || ''))}
                      className="px-3 py-2 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
                    >
                      Use store name
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Creates links like https://beezio.co/store/yourstore</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Description
                </label>
                <textarea
                  value={storeSettings.store_description || ''}
                  onChange={(e) => handleInputChange('store_description', e.target.value)}
                  placeholder="Tell customers about your affiliate store and why they should shop with you..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business website (optional)
                </label>
                <input
                  type="url"
                  value={storeSettings.social_links?.website || ''}
                  onChange={(e) => handleSocialLinkChange('website', e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Store Branding</h3>
                <p className="text-sm leading-6 text-gray-700">
                  Upload a square logo for the storefront header and a wide banner for your store hero areas. All custom stores use one clean header with the logo on the left, the store name beside it, and navigation/actions on the right.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Theme
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: 'vibrant', name: 'Vibrant', color: 'bg-gradient-to-r from-pink-500 to-purple-500' },
                    { id: 'energetic', name: 'Energetic', color: 'bg-gradient-to-r from-orange-500 to-red-500' },
                    { id: 'nature', name: 'Nature', color: 'bg-gradient-to-r from-green-400 to-blue-500' },
                    { id: 'elegant', name: 'Elegant', color: 'bg-gradient-to-r from-purple-600 to-blue-600' },
                    { id: 'minimal', name: 'Minimal', color: 'bg-gradient-to-r from-gray-400 to-gray-600' },
                    { id: 'sunset', name: 'Sunset', color: 'bg-gradient-to-r from-yellow-400 to-pink-500' }
                  ].map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => handleInputChange('store_theme', theme.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        storeSettings.store_theme === theme.id
                          ? 'border-purple-500 shadow-md ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-full h-8 ${theme.color} rounded mb-2`}></div>
                      <div className="text-sm font-medium">{theme.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImageUploader
                  label="Store Banner Image"
                  currentImageUrl={storeSettings.store_banner}
                  onImageUpload={(url) => handleInputChange('store_banner', url)}
                  bucketName="store-banners"
                  folderPath={`${user?.id || affiliateId}/banner`}
                  aspectRatio="banner"
                />

                <ImageUploader
                  label="Store Logo"
                  currentImageUrl={storeSettings.store_logo}
                  onImageUpload={(url) => handleInputChange('store_logo', url)}
                  bucketName="profile-avatars"
                  folderPath={`${user?.id || affiliateId}/logo`}
                  aspectRatio="logo"
                />
              </div>

              <ImageUploader
                label="Store Background"
                currentImageUrl={storeSettings.layout_config?.background_image_url}
                onImageUpload={(url) => handleInputChange('layout_config', {
                  ...storeSettings.layout_config,
                  background_image_url: url,
                })}
                bucketName="store-banners"
                folderPath={`${user?.id || affiliateId}/background`}
                aspectRatio="banner"
              />
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose your storefront template</h3>
                <p className="text-gray-700">
                  Pick an ecommerce layout for your affiliate store. You can still customize colors and pages.
                </p>
              </div>
              <StoreTemplateSelector
                category="storefront"
                currentTemplateId={storeSettings.template_id || activeTemplate}
                onSelectTemplate={(template: StoreTemplate) => {
                  setActiveTemplate(template.id);
                  setStoreSettings((prev) => ({
                    ...prev,
                    template_id: template.id,
                    store_theme: template.theme,
                    layout_config: {
                      ...template.layout,
                      grid_layout: mapTemplateGridToLayout(template.layout?.product_grid),
                    },
                  }));
                }}
              />
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  <Heart className="w-4 h-4 inline mr-2" />
                  Favorite Product Categories
                </label>
                <p className="text-gray-600 mb-4">Select categories you're passionate about. These will be highlighted in your store.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[
                    'Electronics', 'Fashion', 'Home & Garden', 'Health & Beauty',
                    'Sports & Fitness', 'Books & Media', 'Food & Beverages', 'Toys & Games',
                    'Pet Supplies', 'Automotive', 'Art & Crafts', 'Music & Instruments',
                    'Travel & Experiences', 'Business & Industrial', 'Baby & Kids', 'Jewelry'
                  ].map(category => (
                    <button
                      key={category}
                      onClick={() => handleCategoryToggle(category)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        storeSettings.favorite_categories?.includes(category)
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      {storeSettings.favorite_categories?.includes(category) && (
                        <Heart className="w-4 h-4 inline mr-1 fill-current" />
                      )}
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-blue-900">
                  Add from this tab or directly from marketplace. Both routes now update your store products.
                </div>
                <a href="/marketplace" className="px-3 py-2 rounded-lg border border-blue-300 bg-white text-blue-700 hover:bg-blue-100 text-sm font-semibold">
                  Open Marketplace
                </a>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <PackagePlus className="w-5 h-5 text-purple-600" />
                  <div>
                    <h4 className="text-lg font-semibold text-purple-900">Curated Products</h4>
                    <p className="text-sm text-purple-700">Pick products from the marketplace to add to your storefront.</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-purple-200 bg-white/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-purple-900">Quick start: add your first 5 products</div>
                      <div className="text-xs text-purple-700">Select items below to see how your store looks with real products.</div>
                    </div>
                    <span className="text-xs font-semibold text-purple-600">Step 1 of 3</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {marketplaceProducts.slice(0, 5).map((mp: any) => {
                      const img = resolveProductImageFromList(mp.images, mp.id);
                      const alreadyAdded = curatedProductIds.has(mp.id);
                      return (
                        <div key={mp.id} className="flex items-center gap-3 rounded-lg border border-purple-100 bg-white p-3">
                          <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            {img ? (
                              <img src={img} alt={mp.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-gray-200" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{mp.title}</div>
                            <div className="text-xs text-gray-600">${getBuyerFacingProductPrice(mp || {}).toFixed(2)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (alreadyAdded) return;
                              if (!user) {
                                setProductActionMessage('Please log in as an affiliate to add products.');
                                return;
                              }
                              setProductActionLoading(true);
                              setProductActionMessage(null);
                              try {
                                await addCuratedProductById(String(mp.id));
                              } catch (e: any) {
                                const msg = e instanceof Error ? e.message : String(e || '');
                                setProductActionMessage(msg ? `Could not add that product. ${msg}` : 'Could not add that product.');
                              } finally {
                                setProductActionLoading(false);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              alreadyAdded ? 'bg-gray-200 text-gray-600' : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                            disabled={alreadyAdded || productActionLoading}
                          >
                            {alreadyAdded ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={marketplaceSearch}
                      onChange={(e) => setMarketplaceSearch(e.target.value)}
                      placeholder="Search marketplace products..."
                      className="md:col-span-2 w-full px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <select
                      value={marketplaceCategory}
                      onChange={(e) => setMarketplaceCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {marketplaceCategoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <select
                      value={marketplaceSort}
                      onChange={(e) => setMarketplaceSort(e.target.value as any)}
                      className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="price_desc">Price: high → low</option>
                      <option value="price_asc">Price: low → high</option>
                      <option value="commission_desc">Commission: high → low</option>
                      <option value="commission_asc">Commission: low → high</option>
                    </select>
                  </div>

                  {marketplaceLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    </div>
                  ) : marketplaceProducts.length === 0 ? (
                    <div className="text-sm text-purple-800 bg-white/60 border border-purple-100 rounded-lg p-4">
                      No marketplace products found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {marketplaceProducts.map((mp: any) => {
                        const img = resolveProductImageFromList(mp.images, mp.id);
                        const alreadyAdded = curatedProductIds.has(mp.id);
                        const price = getBuyerFacingProductPrice(mp || {});

                        const rawType = String(mp.affiliate_commission_type || mp.commission_type || 'percentage').toLowerCase();
                        const isFixed = rawType === 'fixed' || rawType === 'flat_rate' || rawType === 'flat';
                        const rawRate = Number(mp.affiliate_commission_rate ?? mp.commission_rate ?? 0);
                        const fixedAmount = Number(mp.affiliate_commission_rate ?? mp.flat_commission_amount ?? 0);
                        const pctRaw = rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate;
                        const pct = pctRaw > 0 ? pctRaw : 20; // Default to 20% when the DB doesn't store a rate.
                        const commissionAmount = isFixed ? fixedAmount : price * (pct / 100);
                        const commissionLabel = isFixed
                          ? `$${(Number.isFinite(commissionAmount) ? commissionAmount : 0).toFixed(2)}`
                          : `$${(Number.isFinite(commissionAmount) ? commissionAmount : 0).toFixed(2)} (${Number.isFinite(pct) ? pct.toFixed(0) : '0'}%)`;
                        return (
                          <div key={mp.id} className="bg-white rounded-xl border border-purple-100 p-3 flex gap-3">
                            <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                              {img ? (
                                <img
                                  src={img}
                                  alt={mp.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{mp.title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-purple-700">${price.toFixed(2)}</div>
                                <div className="text-xs font-semibold text-gray-700 bg-[#fff9da] border border-black/10 rounded-full px-2 py-0.5">
                                  Earn {commissionLabel}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <button
                                onClick={async () => {
                                  setProductActionLoading(true);
                                  setProductActionMessage(null);
                                  try {
                                    await addCuratedProductById(String(mp.id));
                                  } catch (e) {
                                    console.error('Error adding curated product:', e);
                                    setProductActionMessage('Could not add that product. Please try again.');
                                  } finally {
                                    setProductActionLoading(false);
                                  }
                                }}
                                disabled={productActionLoading || alreadyAdded}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                                  alreadyAdded
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                    : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                              >
                                {alreadyAdded ? 'Added' : 'Add'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {marketplaceTotal > MARKETPLACE_PAGE_SIZE && (
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div className="text-xs text-purple-800">
                        Page {marketplacePage} of {Math.max(1, Math.ceil(marketplaceTotal / MARKETPLACE_PAGE_SIZE))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMarketplacePage((p) => Math.max(1, p - 1))}
                          disabled={marketplacePage <= 1}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-purple-200 bg-white hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMarketplacePage((p) =>
                              Math.min(Math.max(1, Math.ceil(marketplaceTotal / MARKETPLACE_PAGE_SIZE)), p + 1)
                            )
                          }
                          disabled={marketplacePage >= Math.ceil(marketplaceTotal / MARKETPLACE_PAGE_SIZE)}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-purple-200 bg-white hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-semibold text-purple-900">
                    Advanced: add by product ID/slug
                  </summary>
                  <div className="mt-3 flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      value={newProductInput}
                      onChange={(e) => setNewProductInput(e.target.value)}
                      placeholder="Enter product ID or slug"
                      className="flex-1 px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleAddProduct}
                      disabled={productActionLoading}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                    >
                      <PackagePlus className="w-4 h-4" />
                      <span>{productActionLoading ? 'Adding...' : 'Add Product'}</span>
                    </button>
                  </div>
                </details>
              </div>

              {productActionMessage && (
                <div className="p-3 rounded-lg bg-purple-100 text-purple-900 text-sm font-medium">
                  {productActionMessage}
                </div>
              )}

              {curatedLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : curatedProducts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-purple-200 rounded-xl">
                  <p className="text-lg font-semibold text-gray-700 mb-2">No curated products yet</p>
                  <p className="text-gray-500">Add products above to start building your affiliate storefront.</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="affiliate-curated-products">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3 rounded-xl p-3 ${
                          snapshot.isDraggingOver ? 'bg-purple-50' : 'bg-transparent'
                        }`}
                      >
                        {[...curatedProducts]
                          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                          .map((product, index) => {
                            const productCard = product.products || {};
                            const heroImage = resolveProductImageFromList(productCard.images, productCard.id);
                            const displayTitle = product.custom_title || productCard.title || 'Product';
                            const priceValue = getBuyerFacingProductPrice(productCard || {});
                            const sellerName = productCard.profiles?.full_name || 'Seller';

                            return (
                              <Draggable key={product.id} draggableId={product.id} index={index}>
                                {(draggableProvided, draggableSnapshot) => (
                                  <div
                                    ref={draggableProvided.innerRef}
                                    {...draggableProvided.draggableProps}
                                    className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white ${
                                      draggableSnapshot.isDragging ? 'shadow-lg ring-2 ring-purple-400' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <button
                                        type="button"
                                        {...draggableProvided.dragHandleProps}
                                        className="text-purple-400 hover:text-purple-600 cursor-grab"
                                        aria-label="Drag to reorder"
                                      >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                        </svg>
                                      </button>
                                      {heroImage ? (
                                        <img
                                          src={heroImage}
                                          alt={displayTitle}
                                          className="w-16 h-16 rounded-lg object-cover border"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-16 h-16 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                                          {displayTitle.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-semibold text-gray-900">{displayTitle}</p>
                                        <p className="text-sm text-gray-500">{sellerName}</p>
                                        <p className="text-sm font-medium text-purple-700">${priceValue.toFixed(2)}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        onClick={() => handleMoveProduct(product.id, 'up')}
                                        disabled={index === 0 || productActionLoading}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg text-gray-600 hover:text-gray-900 disabled:opacity-40"
                                      >
                                        <ArrowUp className="w-4 h-4" />
                                        Up
                                      </button>
                                      <button
                                        onClick={() => handleMoveProduct(product.id, 'down')}
                                        disabled={index === curatedProducts.length - 1 || productActionLoading}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg text-gray-600 hover:text-gray-900 disabled:opacity-40"
                                      >
                                        <ArrowDown className="w-4 h-4" />
                                        Down
                                      </button>
                                      <button
                                        onClick={() => handleToggleFeatured(product.id, !product.is_featured)}
                                        disabled={productActionLoading}
                                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg ${product.is_featured ? 'text-yellow-600 border-yellow-400 bg-yellow-50' : 'text-gray-600'}`}
                                      >
                                        <Star className={`w-4 h-4 ${product.is_featured ? 'fill-current' : ''}`} />
                                        {product.is_featured ? 'Featured' : 'Feature'}
                                      </button>
                                      <button
                                        onClick={() => handleRemoveProduct(product.id)}
                                        disabled={productActionLoading}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          )}

          {/* Pages Tab */}
          {activeTab === 'pages' && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Custom Pages</h4>
                <p className="text-gray-600 text-sm">
                  Build About, FAQ, Contact, and promo pages with templates and drag-and-drop sections. These pages live at
                  <span className="font-mono"> /store/&lt;your-store-slug&gt;/&lt;page&gt;</span> and still use Beezio checkout for all purchases.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Starter pack pages</div>
                  <div>Auto-create About, FAQ, Shipping, Returns, and Contact pages you can edit.</div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateStarterPages}
                  disabled={creatingStarterPages}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creatingStarterPages ? 'Creating...' : 'Generate starter pages'}
                </button>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <CustomPageBuilder ownerType="affiliate" />
              </div>
            </div>
          )}

          {/* Domain Tab */}
          {activeTab === 'domain' && (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Shareable Links</h4>
                <p className="text-gray-600 text-sm">
                  Default link: <span className="font-mono break-all">{storeUrl}</span>
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  Claim a Beezio subdomain or connect your own branded domain for a seamless customer experience.
                </p>
              </div>
              <CustomDomainManager
                userId={affiliateId}
                role="affiliate"
                currentDomain={storeSettings.custom_domain}
                subdomain={storeSettings.subdomain}
                onUpdated={(next) => {
                  setStoreSettings((prev) => ({
                    ...prev,
                    ...(next.customDomain !== undefined ? { custom_domain: next.customDomain || '' } : {}),
                    ...(next.subdomain !== undefined ? { subdomain: next.subdomain || '' } : {}),
                  }));
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AffiliateStoreCustomization;

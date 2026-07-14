import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { ensureProfileIdForUser, resolveProfileIdForUser } from '../utils/resolveProfileId';
import {
  Save,
  Eye,
  Palette,
  Globe,
  Zap,
  FileText,
  ArrowUpDown,
  LayoutTemplate,
  Wand2,
  PackagePlus,
  GripVertical,
  Square,
  CheckSquare
} from 'lucide-react';
import CustomDomainManager from './CustomDomainManager';
import ImageUploader from './ImageUploader';
import CustomPageBuilder from './CustomPageBuilder';
import ProductOrderManager from './ProductOrderManager';
import ProductBrowserForSellers from './ProductBrowserForSellers';
import StoreOrganizationPanel from './StoreOrganizationPanel';
import StoreTemplateSelector, { type StoreTemplate } from './StoreTemplateSelector';
import { blocksToHtml, starterPackTemplates } from '../utils/storePageTemplates';
import { normalizeThemeName } from '../utils/themes';
import { normalizeStoreSlug } from '../utils/normalizeStoreSlug';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface StoreSettings {
  store_name?: string;
  store_description?: string;
  store_banner?: string;
  store_logo?: string;
  store_theme?: string;
  custom_domain?: string;
  subdomain?: string;
  template_id?: string;
  product_page_template?: string;
  layout_config?: {
    header_style?: string;
    product_grid?: string;
    sidebar?: boolean;
    footer_style?: string;
    grid_layout?: 'compact' | 'standard' | 'comfortable' | 'large';
    background_image_url?: string;
    show_search?: boolean;
    show_categories?: boolean;
    show_featured?: boolean;
    show_about?: boolean;
    show_contact?: boolean;
    show_policies?: boolean;
    storefront_sections?: string[];
  };
  color_scheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  custom_css?: string;
  custom_html_header?: string;
  custom_html_footer?: string;
  contact_page_enabled?: boolean;
  contact_email?: string;
  social_links?: {
    [key: string]: string | undefined;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  business_hours?: string;
  shipping_policy?: string;
  return_policy?: string;
}

type StoreFeatureToggle = {
  id: string;
  label: string;
  description: string;
};

const STOREFRONT_FEATURES: StoreFeatureToggle[] = [
  { id: 'hero', label: 'Hero Banner', description: 'Large first section with your name, logo, and call to action.' },
  { id: 'search', label: 'Search Bar', description: 'Lets shoppers search products inside your store.' },
  { id: 'categories', label: 'Category Filters', description: 'Shows category buttons so shoppers can narrow the catalog.' },
  { id: 'featured', label: 'Featured Products', description: 'Highlights products marked as featured before the full catalog.' },
  { id: 'about', label: 'About Section', description: 'Displays your store description in a cleaner intro block.' },
  { id: 'policies', label: 'Policies', description: 'Shows shipping and return information on the storefront.' },
  { id: 'contact', label: 'Contact Button', description: 'Keeps the contact action visible so shoppers can reach the store.' },
];

const colorPresets = [
  { name: 'Default', primary: '#f59e0b', secondary: '#3b82f6', accent: '#ef4444' },
  { name: 'Ocean', primary: '#0ea5e9', secondary: '#06b6d4', accent: '#0f766e' },
  { name: 'Forest', primary: '#166534', secondary: '#10b981', accent: '#f59e0b' },
  { name: 'Metro', primary: '#111827', secondary: '#6b7280', accent: '#f97316' },
  { name: 'Studio', primary: '#7c3aed', secondary: '#d946ef', accent: '#fb7185' },
  { name: 'Clay', primary: '#9a3412', secondary: '#c2410c', accent: '#facc15' },
];

const workspaceItems = [
  { id: 'overview', name: 'Overview', icon: Wand2, description: 'The simplified dashboard.' },
  { id: 'brand', name: 'Brand', icon: Palette, description: 'Name, logo, colors, and images.' },
  { id: 'layout', name: 'Layout', icon: LayoutTemplate, description: 'Templates, sections, and grid.' },
  { id: 'content', name: 'Content', icon: FileText, description: 'Products and custom pages.' },
  { id: 'publish', name: 'Publish', icon: Globe, description: 'Domain and final ordering.' }
] as const;

const StoreCustomization: React.FC<{ userId: string; role: 'seller' | 'affiliate' }> = ({ userId, role }) => {
  const { user } = useAuth();
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_theme: 'modern',
    social_links: {},
    layout_config: {
      grid_layout: 'standard',
      show_search: true,
      show_categories: true,
      show_featured: true,
      show_about: true,
      show_contact: true,
      show_policies: true,
      storefront_sections: ['hero', 'search', 'categories', 'featured', 'about', 'policies', 'contact']
    },
    color_scheme: {
      primary: '#f59e0b',
      secondary: '#3b82f6',
      accent: '#ef4444',
      background: '#ffffff',
      text: '#1f2937'
    }
  });
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeTemplate, setActiveTemplate] = useState<string>('modern');
  const [creatingStarterPages, setCreatingStarterPages] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const initialSnapshotRef = useRef<string>('');

  const bannedWords = [
    'porn', 'xxx', 'sex', 'nude', 'nsfw', 'escort', 'casino', 'bet', 'gambling',
    'hate', 'terror', 'abuse', 'violence', 'extremism', 'weapon', 'gun', 'knife'
  ];

  const themeOptions: Array<ReturnType<typeof normalizeThemeName> | 'minimalist'> = [
    'modern',
    'vibrant',
    'minimal',
    'dark',
    'classic',
    'elegant',
    'nature',
    'tech'
  ];

  const reservedSlugs = new Set([
    'home', 'marketplace', 'stores', 'affiliates', 'affiliate', 'partner', 'affiliate-signup', 'affiliate-dashboard-preview',
    'seller', 'sellers', 'store', 'products', 'product', 'dashboard', 'dashboard-preview', 'buyer-dashboard-preview',
    'admin', 'auth', 'login', 'signup', 'onboarding', 'messages', 'earnings', 'checkout', 'cart',
    'about', 'contact', 'privacy', 'terms', 'faq', 'search', 'how-it-works', 'get-started', 'start-earning',
    'add-product', 'add-product-old', 'profile', 'orders', 'order-confirmation', 'contact-support', 'write-review',
    'reset-password', 'change-password', 'revolutionary', 'api'
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

  const mapTemplateGridToLayout = (grid?: string): StoreSettings['layout_config']['grid_layout'] => {
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!userId) {
        setResolvedId('');
        setLoading(false);
        return;
      }
      const canonicalId = await resolveProfileIdForUser(userId);
      if (!cancelled) {
        setResolvedId(canonicalId || userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!resolvedId) return;
    initialSnapshotRef.current = '';
    setHasUnsavedChanges(false);
    void fetchStoreSettings(resolvedId);
  }, [resolvedId, role]);

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

  const fetchStoreSettings = async (ownerId: string) => {
    const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
    const timeoutId = window.setTimeout(() => setLoading(false), 8000);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(`${role}_id`, ownerId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[StoreCustomization] Failed to load store settings:', error);
      }

      if (data) {
        setStoreSettings((prev) => ({
          ...prev,
          ...data,
          store_theme: normalizeThemeName((data as any).store_theme || prev.store_theme),
          subdomain: normalizeSlugInput((data as any).subdomain || ''),
          social_links: data.social_links || prev.social_links || {},
          layout_config: {
            ...prev.layout_config,
            ...(data.layout_config || {})
          },
          color_scheme: data.color_scheme || prev.color_scheme
        }));
        if (data.template_id) {
          setActiveTemplate(data.template_id);
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const validateContent = () => {
    const textFields = [
      storeSettings.store_name,
      storeSettings.store_description,
      storeSettings.business_hours,
      storeSettings.shipping_policy,
      storeSettings.return_policy,
    ].filter(Boolean) as string[];

    const joined = textFields.join(' ').toLowerCase();
    const found = bannedWords.find((word) => joined.includes(word));
    if (found) {
      alert(`Please remove disallowed content (${found}) before saving.`);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateContent()) return;

    setSaving(true);
    const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
    const ownerId = user ? await ensureProfileIdForUser(user) : (resolvedId || userId);
    if (!ownerId) {
      alert('Missing profile id. Please refresh and try again.');
      setSaving(false);
      return;
    }
    if (ownerId !== resolvedId) {
      setResolvedId(ownerId);
    }

    const normalizedSlug = normalizeSlugInput(storeSettings.subdomain || '');
    if (!isValidSlug(normalizedSlug)) {
      alert('Store URL slug must be 3-32 characters, lowercase letters/numbers/hyphens only, and not reserved.');
      setSaving(false);
      return;
    }
    try {
      const slugAvailable = await checkSlugAvailability(normalizedSlug, ownerId);
      if (!slugAvailable) {
        alert('That store URL slug is already taken. Please choose another.');
        setSaving(false);
        return;
      }
    } catch (error) {
      console.error('[StoreCustomization] Failed to validate slug availability:', error);
      alert('Could not validate the store URL slug. Please try again.');
      setSaving(false);
      return;
    }

    const payload = {
      [`${role}_id`]: ownerId,
      store_name: storeSettings.store_name || null,
      store_description: storeSettings.store_description || null,
      store_banner: storeSettings.store_banner || null,
      store_logo: storeSettings.store_logo || null,
      store_theme: normalizeThemeName(storeSettings.store_theme || activeTemplate),
      custom_domain: storeSettings.custom_domain || null,
      subdomain: normalizedSlug || null,
      template_id: storeSettings.template_id || null,
      product_page_template: storeSettings.product_page_template || null,
      layout_config: storeSettings.layout_config || null,
      color_scheme: storeSettings.color_scheme || null,
      custom_css: storeSettings.custom_css || null,
      custom_html_header: storeSettings.custom_html_header || null,
      custom_html_footer: storeSettings.custom_html_footer || null,
      contact_page_enabled: storeSettings.contact_page_enabled ?? true,
      contact_email: storeSettings.contact_email || null,
      social_links: storeSettings.social_links || {},
      business_hours: storeSettings.business_hours || null,
      shipping_policy: storeSettings.shipping_policy || null,
      return_policy: storeSettings.return_policy || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(table).upsert(payload, { onConflict: `${role}_id` });

    if (error) {
      console.error('[StoreCustomization] Failed to save store settings:', error);
      alert(`Failed to save store settings. ${error.message || 'Please try again.'}`);
    } else {
      initialSnapshotRef.current = JSON.stringify({
        ...storeSettings,
        store_theme: normalizeThemeName(storeSettings.store_theme || activeTemplate),
        subdomain: normalizedSlug || '',
      });
      setHasUnsavedChanges(false);
      alert('Store settings saved successfully!');
    }
    setSaving(false);
  };

  const handleGenerateStarterPages = async () => {
    const ownerId = resolvedId || userId;
    if (!ownerId) {
      alert('Missing profile id. Please refresh and try again.');
      return;
    }

    try {
      setCreatingStarterPages(true);
      const { data: existingPages, error: existingError } = await supabase
        .from('custom_pages')
        .select('page_slug, display_order')
        .eq('owner_id', ownerId)
        .eq('owner_type', role);
      if (existingError) throw existingError;

      const existingSlugs = new Set((existingPages || []).map((page: any) => page.page_slug));
      const maxOrder = Math.max(0, ...(existingPages || []).map((page: any) => page.display_order || 0));
      const inserts = starterPackTemplates
        .filter((template) => !existingSlugs.has(template.slug))
        .map((template, index) => ({
          owner_id: ownerId,
          owner_type: role,
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
      console.error('[StoreCustomization] Failed to create starter pages:', error);
      alert(`Failed to create starter pages. ${error?.message || 'Please try again.'}`);
    } finally {
      setCreatingStarterPages(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setStoreSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setStoreSettings((prev) => ({
      ...prev,
      social_links: {
        ...prev.social_links,
        [platform]: value
      }
    }));
  };

  const handleLayoutChange = (field: string, value: any) => {
    setStoreSettings((prev) => ({
      ...prev,
      layout_config: {
        ...prev.layout_config,
        [field]: value
      }
    }));
  };

  const storefrontSections = useMemo(() => {
    const saved = storeSettings.layout_config?.storefront_sections || [];
    const validSaved = saved.filter((sectionId) => STOREFRONT_FEATURES.some((feature) => feature.id === sectionId));
    const missing = STOREFRONT_FEATURES
      .map((feature) => feature.id)
      .filter((featureId) => !validSaved.includes(featureId));
    return [...validSaved, ...missing];
  }, [storeSettings.layout_config?.storefront_sections]);

  const isFeatureEnabled = (featureId: string) => {
    switch (featureId) {
      case 'hero':
        return String(storeSettings.layout_config?.header_style || '').trim().toLowerCase() !== 'minimal';
      case 'search':
        return storeSettings.layout_config?.show_search !== false;
      case 'categories':
        return storeSettings.layout_config?.show_categories !== false;
      case 'featured':
        return storeSettings.layout_config?.show_featured !== false;
      case 'about':
        return storeSettings.layout_config?.show_about !== false;
      case 'policies':
        return storeSettings.layout_config?.show_policies !== false;
      case 'contact':
        return storeSettings.layout_config?.show_contact !== false;
      default:
        return true;
    }
  };

  const toggleFeature = (featureId: string) => {
    if (featureId === 'hero') {
      handleLayoutChange('header_style', isFeatureEnabled(featureId) ? 'minimal' : 'banner');
      return;
    }

    const fieldByFeature: Record<string, string> = {
      search: 'show_search',
      categories: 'show_categories',
      featured: 'show_featured',
      about: 'show_about',
      policies: 'show_policies',
      contact: 'show_contact',
    };

    const field = fieldByFeature[featureId];
    if (!field) return;
    handleLayoutChange(field, !isFeatureEnabled(featureId));
  };

  const handleFeatureDragEnd = (result: any) => {
    if (!result.destination) return;
    const nextSections = Array.from(storefrontSections);
    const [moved] = nextSections.splice(result.source.index, 1);
    nextSections.splice(result.destination.index, 0, moved);
    handleLayoutChange('storefront_sections', nextSections);
  };

  const handleColorSchemeChange = (field: string, value: string) => {
    setStoreSettings((prev) => ({
      ...prev,
      color_scheme: {
        ...prev.color_scheme,
        [field]: value
      }
    }));
  };

  const storePathPrefix = role === 'seller' ? 'store' : 'partner';
  const publicStoreUrl = storeSettings.custom_domain
    ? `https://${storeSettings.custom_domain}`
    : `${window.location.origin}/${storeSettings.subdomain ? `${storePathPrefix}/${storeSettings.subdomain}` : role === 'seller' ? `${storePathPrefix}/id/${resolvedId || userId}` : `${storePathPrefix}/${resolvedId || userId}`}`;
  const hasStoreIdentity = Boolean(String(storeSettings.store_name || '').trim()) && Boolean(String(storeSettings.subdomain || '').trim());
  const hasBranding =
    Boolean(String(storeSettings.store_logo || '').trim()) ||
    Boolean(String(storeSettings.store_banner || '').trim()) ||
    Boolean(String(storeSettings.layout_config?.background_image_url || '').trim());
  const hasPolicies = Boolean(String(storeSettings.shipping_policy || '').trim()) || Boolean(String(storeSettings.return_policy || '').trim());
  const completionChecklist = [
    { id: 'identity', label: 'Store name and URL', done: hasStoreIdentity },
    { id: 'branding', label: 'Brand images or background', done: hasBranding },
    { id: 'story', label: 'Description or policies', done: Boolean(String(storeSettings.store_description || '').trim()) || hasPolicies },
    { id: 'layout', label: 'Template and grid', done: Boolean(storeSettings.template_id || storeSettings.layout_config?.grid_layout) },
  ];
  const completedCount = completionChecklist.filter((item) => item.done).length;

  const previewColors = {
    primary: storeSettings.color_scheme?.primary || '#f59e0b',
    secondary: storeSettings.color_scheme?.secondary || '#d6d3d1',
    accent: storeSettings.color_scheme?.accent || '#ef4444',
    background: storeSettings.color_scheme?.background || '#fffbeb',
    text: storeSettings.color_scheme?.text || '#1f2937',
  };
  const previewStoreName = String(storeSettings.store_name || '').trim() || (role === 'seller' ? 'Northline Supply' : 'Northline Finds');
  const previewStoreDescription = String(storeSettings.store_description || '').trim() || 'Curated products, clear pricing, and a storefront that feels like your brand from the first click.';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
      <div className="mb-6 rounded-[28px] border border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_32%),linear-gradient(135deg,_#fff9ec_0%,_#ffffff_45%,_#f7f7f4_100%)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">
              <Zap className="h-3.5 w-3.5" />
              Simplified custom site
            </div>
            <h2 className="text-3xl font-black tracking-tight text-stone-950">One dashboard, live preview, cleaner store setup</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              This editor keeps the existing store/cart/payment behavior but removes the scattered tab experience. Brand the store, arrange the layout, edit content, and publish from one workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-700">
                Completion: <span className="font-semibold text-stone-950">{completedCount}/{completionChecklist.length}</span>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-700">
                Public URL: <span className="break-all font-semibold text-stone-950">{publicStoreUrl}</span>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-700">
                Checkout: <span className="font-semibold text-stone-950">Unchanged</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`rounded-full px-4 py-2 text-sm font-semibold ${hasUnsavedChanges ? 'border border-amber-300 bg-amber-100 text-amber-900' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
            </div>
            <a
              href={
                storeSettings.custom_domain
                  ? `https://${storeSettings.custom_domain}`
                  : storeSettings.subdomain
                    ? `/${storePathPrefix}/${storeSettings.subdomain}`
                    : role === 'seller'
                      ? `/${storePathPrefix}/id/${resolvedId || userId}`
                      : `/${storePathPrefix}/${resolvedId || userId}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
            >
              <Eye className="h-4 w-4" />
              Preview live store
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_420px]">
        <aside className="space-y-4">
          <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-stone-900">Simple builder</div>
            <div className="space-y-2">
              {[
                { id: 'builder-overview', step: '1', label: 'Start here', desc: 'See the setup flow' },
                { id: 'builder-brand', step: '2', label: 'Make it yours', desc: 'Name, logo, colors, story' },
                { id: 'builder-layout', step: '3', label: 'Pick the look', desc: 'Template and sections' },
                { id: 'builder-content', step: '4', label: 'Add content', desc: 'Products and pages' },
                { id: 'builder-publish', step: '5', label: 'Publish', desc: 'Order and domain' },
              ].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 transition hover:bg-stone-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">
                      {item.step}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-stone-950">{item.label}</div>
                      <div className="text-xs text-stone-500">{item.desc}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-stone-900">Launch checklist</div>
            <div className="space-y-3">
              {completionChecklist.map((item, index) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3">
                  <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${item.done ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-600'}`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{item.label}</div>
                    <div className={`text-xs ${item.done ? 'text-emerald-700' : 'text-stone-500'}`}>{item.done ? 'Ready' : 'Needs setup'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-6">
            <>
              <div id="builder-overview" className="scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-bold text-stone-950">Build your store in five easy steps</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  This builder stays in one flow: brand it, choose a look, add content, and publish. The preview stays visible so you always know what customers will see.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4 text-left">
                    <div className="text-sm font-semibold text-stone-950">Step 1: Brand</div>
                    <div className="mt-1 text-xs text-stone-500">Name, URL, logo, banner, and colors.</div>
                  </div>
                  <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4 text-left">
                    <div className="text-sm font-semibold text-stone-950">Step 2: Store look</div>
                    <div className="mt-1 text-xs text-stone-500">Pick the template and turn sections on or off.</div>
                  </div>
                  <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4 text-left">
                    <div className="text-sm font-semibold text-stone-950">Step 3: Products and pages</div>
                    <div className="mt-1 text-xs text-stone-500">Add products and create the pages customers need.</div>
                  </div>
                  <div className="rounded-2xl border border-stone-300 bg-stone-50 p-4 text-left">
                    <div className="text-sm font-semibold text-stone-950">Step 4: Publish</div>
                    <div className="mt-1 text-xs text-stone-500">Set product order, connect the URL, and go live.</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 text-sm font-semibold text-stone-500">Current storefront direction</div>
                  <div className="space-y-2 text-sm text-stone-700">
                    <div><span className="font-semibold text-stone-950">Store:</span> {previewStoreName}</div>
                    <div><span className="font-semibold text-stone-950">Theme:</span> {storeSettings.store_theme || 'modern'}</div>
                    <div><span className="font-semibold text-stone-950">Template:</span> {storeSettings.template_id || activeTemplate}</div>
                    <div><span className="font-semibold text-stone-950">Grid:</span> {storeSettings.layout_config?.grid_layout || 'standard'}</div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 text-sm font-semibold text-stone-500">Protected platform behavior</div>
                  <div className="space-y-2 text-sm text-stone-700">
                    <div>Cart and checkout paths remain the same.</div>
                    <div>Custom pages still use the safe link rules already in place.</div>
                    <div>This change is for dashboard and custom-site presentation.</div>
                  </div>
                </div>
              </div>
            </>

            <>
              <div id="builder-brand" className="scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-bold text-stone-950">Make the store yours</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">Start with the things people notice first: your name, your message, your logo, and your colors.</p>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-stone-700">Store name</label>
                    <input
                      type="text"
                      value={storeSettings.store_name || ''}
                      onChange={(e) => handleInputChange('store_name', e.target.value)}
                      placeholder={role === 'seller' ? 'Northline Supply' : 'Northline Finds'}
                      className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-stone-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-stone-700">Store URL slug</label>
                    <input
                      type="text"
                      value={storeSettings.subdomain || ''}
                      onChange={(e) => handleInputChange('subdomain', normalizeSlugInput(e.target.value))}
                      placeholder="your-store-name"
                      className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-stone-900 focus:outline-none"
                    />
                    <p className="mt-2 break-all text-xs text-stone-500">{publicStoreUrl}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-stone-700">Store description</label>
                  <textarea
                    value={storeSettings.store_description || ''}
                    onChange={(e) => handleInputChange('store_description', e.target.value)}
                    rows={4}
                    placeholder="Tell customers what makes your store different."
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-stone-900 focus:outline-none"
                  />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourstore' },
                    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourstore' },
                    { key: 'twitter', label: 'Twitter', placeholder: 'https://twitter.com/yourstore' },
                    { key: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' }
                  ].map((social) => (
                    <div key={social.key}>
                      <label className="mb-2 block text-sm font-semibold text-stone-700">{social.label}</label>
                      <input
                        type="url"
                        value={storeSettings.social_links?.[social.key] || ''}
                        onChange={(e) => handleSocialLinkChange(social.key, e.target.value)}
                        placeholder={social.placeholder}
                        className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-stone-900 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5 text-stone-700" />
                  <h4 className="text-lg font-semibold text-stone-950">Images and color palette</h4>
                </div>
                <div className="space-y-6">
                  <ImageUploader
                    label="Store Banner Image"
                    currentImageUrl={storeSettings.store_banner}
                    onImageUpload={(url) => handleInputChange('store_banner', url)}
                    bucketName="store-banners"
                    folderPath={`${user?.id || userId}/banner`}
                    aspectRatio="banner"
                  />
                  <ImageUploader
                    label="Store Logo"
                    currentImageUrl={storeSettings.store_logo}
                    onImageUpload={(url) => handleInputChange('store_logo', url)}
                    bucketName="profile-avatars"
                    folderPath={`${user?.id || userId}/logo`}
                    aspectRatio="logo"
                  />
                  <ImageUploader
                    label="Store Background"
                    currentImageUrl={storeSettings.layout_config?.background_image_url}
                    onImageUpload={(url) => handleLayoutChange('background_image_url', url)}
                    bucketName="store-banners"
                    folderPath={`${user?.id || userId}/background`}
                    aspectRatio="banner"
                  />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-stone-700">Theme</label>
                    <select
                      value={storeSettings.store_theme}
                      onChange={(e) => handleInputChange('store_theme', e.target.value)}
                      className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm focus:border-stone-900 focus:outline-none"
                    >
                      {themeOptions.map((theme) => (
                        <option key={theme} value={theme}>{theme.charAt(0).toUpperCase() + theme.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                    Theme selection changes the visual system. It does not change store logic, checkout, or cart behavior.
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[
                    { key: 'primary', label: 'Primary', default: '#f59e0b' },
                    { key: 'secondary', label: 'Secondary', default: '#3b82f6' },
                    { key: 'accent', label: 'Accent', default: '#ef4444' },
                    { key: 'background', label: 'Background', default: '#ffffff' },
                    { key: 'text', label: 'Text', default: '#1f2937' }
                  ].map((color) => (
                    <div key={color.key} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <label className="mb-3 block text-sm font-semibold text-stone-800">{color.label}</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={storeSettings.color_scheme?.[color.key as keyof typeof storeSettings.color_scheme] || color.default}
                          onChange={(e) => handleColorSchemeChange(color.key, e.target.value)}
                          className="h-12 w-14 rounded-xl border border-stone-300"
                        />
                        <input
                          type="text"
                          value={storeSettings.color_scheme?.[color.key as keyof typeof storeSettings.color_scheme] || color.default}
                          onChange={(e) => handleColorSchemeChange(color.key, e.target.value)}
                          className="flex-1 rounded-xl border border-stone-300 px-3 py-2 font-mono text-sm focus:border-stone-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="mb-3 text-sm font-semibold text-stone-700">Quick presets</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          handleColorSchemeChange('primary', preset.primary);
                          handleColorSchemeChange('secondary', preset.secondary);
                          handleColorSchemeChange('accent', preset.accent);
                        }}
                        className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-left hover:bg-stone-100"
                      >
                        <div className="flex gap-1">
                          <span className="h-5 w-5 rounded-full" style={{ backgroundColor: preset.primary }} />
                          <span className="h-5 w-5 rounded-full" style={{ backgroundColor: preset.secondary }} />
                          <span className="h-5 w-5 rounded-full" style={{ backgroundColor: preset.accent }} />
                        </div>
                        <span className="text-sm font-semibold text-stone-900">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>

            <>
              <div id="builder-layout" className="scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-bold text-stone-950">Choose the store look</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">Pick a layout, keep only the sections you need, and put them in the right order.</p>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <h4 className="mb-3 text-lg font-semibold text-stone-950">Storefront template</h4>
                <StoreTemplateSelector
                  category="storefront"
                  currentTemplateId={storeSettings.template_id || activeTemplate}
                  onSelectTemplate={(template: StoreTemplate) => {
                    setActiveTemplate(template.id);
                    handleInputChange('template_id', template.id);
                    handleInputChange('store_theme', template.theme);
                    handleInputChange('layout_config', {
                      ...template.layout,
                      grid_layout: mapTemplateGridToLayout(template.layout?.product_grid),
                    });
                  }}
                />
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-stone-950">Homepage sections</h4>
                    <p className="text-sm text-stone-600">No repeated controls. One list controls visibility and order.</p>
                  </div>
                </div>
                <DragDropContext onDragEnd={handleFeatureDragEnd}>
                  <Droppable droppableId="storefront-features">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                        {storefrontSections.map((featureId, index) => {
                          const feature = STOREFRONT_FEATURES.find((item) => item.id === featureId);
                          if (!feature) return null;
                          const enabled = isFeatureEnabled(feature.id);
                          return (
                            <Draggable key={feature.id} draggableId={feature.id} index={index}>
                              {(dragProvided) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`flex items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                                    enabled ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-stone-50'
                                  }`}
                                >
                                  <button type="button" className="mt-0.5 text-stone-400" {...dragProvided.dragHandleProps} aria-label={`Drag ${feature.label}`}>
                                    <GripVertical className="h-5 w-5" />
                                  </button>
                                  <button type="button" onClick={() => toggleFeature(feature.id)} className="mt-0.5 text-stone-700" aria-pressed={enabled}>
                                    {enabled ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="font-semibold text-stone-950">{feature.label}</div>
                                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
                                        {enabled ? 'Visible' : 'Hidden'}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-sm text-stone-600">{feature.description}</p>
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
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <h4 className="mb-4 text-lg font-semibold text-stone-950">Product grid</h4>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { value: 'compact', label: 'Compact', desc: 'More cards visible at once' },
                    { value: 'standard', label: 'Standard', desc: 'Balanced default layout' },
                    { value: 'comfortable', label: 'Comfortable', desc: 'Spacious with more copy' },
                    { value: 'large', label: 'Large', desc: 'Bigger cards and fewer columns' }
                  ].map((layout) => (
                    <button
                      key={layout.value}
                      type="button"
                      onClick={() => handleLayoutChange('grid_layout', layout.value)}
                      className={`rounded-2xl border px-4 py-5 text-left transition ${
                        storeSettings.layout_config?.grid_layout === layout.value
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100'
                      }`}
                    >
                      <div className="font-semibold">{layout.label}</div>
                      <div className={`mt-1 text-sm ${storeSettings.layout_config?.grid_layout === layout.value ? 'text-stone-300' : 'text-stone-500'}`}>{layout.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>

            <>
              <div id="builder-content" className="scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-bold text-stone-950">Add products and pages</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">Everything customers can browse lives here. Add products, create starter pages, and edit custom pages in one place.</p>
              </div>

              {role === 'seller' && (
                <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <PackagePlus className="h-5 w-5 text-stone-700" />
                      <div>
                        <h4 className="text-lg font-semibold text-stone-950">Products</h4>
                        <p className="text-sm text-stone-600">Add products from here or pull them from the marketplace.</p>
                      </div>
                    </div>
                    <a href="/marketplace" className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100">
                      Open marketplace
                    </a>
                  </div>
                  <ProductBrowserForSellers sellerId={resolvedId || userId} />
                </div>
              )}

              <StoreOrganizationPanel ownerId={resolvedId || userId} role={role} />

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-stone-950">Starter pages</h4>
                    <p className="text-sm text-stone-600">Auto-create About, FAQ, Shipping, Returns, and Contact pages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateStarterPages}
                    disabled={creatingStarterPages}
                    className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {creatingStarterPages ? 'Creating...' : 'Generate starter pages'}
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                    Suggested page pieces: hero, featured products, story block, social proof, FAQ, and support details.
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                    Links continue to flow through the existing page builder behavior.
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm">
                <CustomPageBuilder ownerType={role} />
              </div>
            </>

            <>
              <div id="builder-publish" className="scroll-mt-24 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-bold text-stone-950">Publish and launch</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">Finish with the live-store details: product order, URL, and domain setup.</p>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5 text-stone-700" />
                  <h4 className="text-lg font-semibold text-stone-950">Product order</h4>
                </div>
                <ProductOrderManager
                  sellerId={role === 'seller' ? resolvedId || userId : undefined}
                  ownerId={resolvedId || userId}
                  role={role}
                />
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <CustomDomainManager
                  userId={userId}
                  role={role}
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
            </>
        </main>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[28px] border border-stone-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-stone-950">Live preview</div>
                <div className="text-xs text-stone-500">Preview colors, imagery, section order, and overall tone.</div>
              </div>
              <div className="flex items-center rounded-full border border-stone-200 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${previewDevice === 'desktop' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500'}`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${previewDevice === 'mobile' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500'}`}
                >
                  Mobile
                </button>
              </div>
            </div>

            <div className={previewDevice === 'mobile' ? 'mx-auto max-w-[320px]' : ''}>
              <div
                className="overflow-hidden rounded-[26px] border border-stone-200"
                style={{
                  backgroundColor: previewColors.background,
                  backgroundImage: storeSettings.layout_config?.background_image_url
                    ? `linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.96)), url(${storeSettings.layout_config.background_image_url})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {storeSettings.store_logo ? (
                        <img src={storeSettings.store_logo} alt="Store logo preview" className="h-10 w-10 rounded-2xl border border-stone-200 bg-white object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: previewColors.primary }}>
                          {previewStoreName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: previewColors.accent }}>Live preview</div>
                        <div className="text-sm font-semibold" style={{ color: previewColors.text }}>{previewStoreName}</div>
                      </div>
                    </div>
                    <div className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${previewColors.primary}18`, color: previewColors.primary }}>
                      Checkout
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  {isFeatureEnabled('hero') && (
                    <div className="overflow-hidden rounded-[24px] border bg-white" style={{ borderColor: `${previewColors.secondary}80` }}>
                      {storeSettings.store_banner ? (
                        <div className="h-36 w-full bg-cover bg-center" style={{ backgroundImage: `url(${storeSettings.store_banner})` }} />
                      ) : (
                        <div className="h-36 w-full" style={{ background: `linear-gradient(135deg, ${previewColors.primary} 0%, ${previewColors.accent} 100%)` }} />
                      )}
                      <div className="space-y-2 p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: previewColors.accent }}>Featured collection</div>
                        <div className="text-xl font-black" style={{ color: previewColors.text }}>{previewStoreName}</div>
                        <p className="text-sm leading-6" style={{ color: previewColors.text }}>{previewStoreDescription}</p>
                        <div className="inline-flex rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: previewColors.primary }}>
                          Shop now
                        </div>
                      </div>
                    </div>
                  )}

                  {storefrontSections.map((featureId) => {
                    if (!isFeatureEnabled(featureId) || featureId === 'hero' || featureId === 'contact') return null;

                    if (featureId === 'search') {
                      return (
                        <div key={featureId} className="rounded-[22px] border bg-white p-3" style={{ borderColor: `${previewColors.secondary}80` }}>
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewColors.accent }}>Browse</div>
                          <div className="rounded-2xl border px-4 py-3 text-sm text-stone-400" style={{ borderColor: `${previewColors.secondary}80` }}>
                            Search this store
                          </div>
                        </div>
                      );
                    }

                    if (featureId === 'categories') {
                      return (
                        <div key={featureId} className="rounded-[22px] border bg-white p-3" style={{ borderColor: `${previewColors.secondary}80` }}>
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewColors.accent }}>Collections</div>
                          <div className="flex flex-wrap gap-2">
                            {['Featured', 'New', 'Popular'].map((label) => (
                              <div key={label} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: `${previewColors.secondary}80`, color: previewColors.text }}>
                                {label}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (featureId === 'featured') {
                      return (
                        <div key={featureId} className="rounded-[22px] border bg-white p-3" style={{ borderColor: `${previewColors.secondary}80` }}>
                          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewColors.accent }}>Featured products</div>
                          <div className={`grid gap-3 ${previewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {[1, 2].map((item) => (
                              <div key={item} className="rounded-2xl border p-3" style={{ borderColor: `${previewColors.secondary}60` }}>
                                <div className="h-20 rounded-xl" style={{ background: `linear-gradient(135deg, ${previewColors.secondary}33, ${previewColors.primary}26)` }} />
                                <div className="mt-3 text-sm font-semibold" style={{ color: previewColors.text }}>Featured item {item}</div>
                                <div className="mt-1 text-xs text-stone-500">Signature product</div>
                                <div className="mt-3 text-sm font-bold" style={{ color: previewColors.primary }}>$29.00</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (featureId === 'about') {
                      return (
                        <div key={featureId} className="rounded-[22px] border bg-white p-4" style={{ borderColor: `${previewColors.secondary}80` }}>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewColors.accent }}>About</div>
                          <p className="mt-2 text-sm leading-6" style={{ color: previewColors.text }}>{previewStoreDescription}</p>
                        </div>
                      );
                    }

                    if (featureId === 'policies') {
                      return (
                        <div key={featureId} className={`grid gap-3 ${previewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          <div className="rounded-[22px] border bg-white p-4" style={{ borderColor: `${previewColors.secondary}80` }}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewColors.accent }}>Shipping</div>
                            <p className="mt-2 text-sm text-stone-600">{storeSettings.shipping_policy || 'Shipping details appear here.'}</p>
                          </div>
                          <div className="rounded-[22px] border bg-white p-4" style={{ borderColor: `${previewColors.secondary}80` }}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewColors.accent }}>Returns</div>
                            <p className="mt-2 text-sm text-stone-600">{storeSettings.return_policy || 'Return details appear here.'}</p>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}

                  {isFeatureEnabled('contact') && (
                    <div className="rounded-[22px] border bg-white p-4 text-center" style={{ borderColor: `${previewColors.secondary}80` }}>
                      <div className="text-sm font-semibold" style={{ color: previewColors.text }}>Need help before checkout?</div>
                      <div className="mt-3 inline-flex rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: previewColors.accent }}>
                        Contact this store
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StoreCustomization;

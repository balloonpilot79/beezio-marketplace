import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, LogOut, Store, UserCircle } from 'lucide-react';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import ProductGrid from '../components/ProductGrid';

type OwnerType = 'seller' | 'affiliate';

interface CustomPage {
  id: string;
  owner_id: string;
  owner_type: OwnerType;
  page_slug: string;
  page_title: string;
  page_content: string;
  is_active: boolean;
  created_at: string;
}

interface OwnerProfile {
  id: string;
  full_name: string;
  username?: string;
  avatar_url?: string;
}

interface StoreCustomPageViewProps {
  ownerId: string;
  ownerType: OwnerType;
  pageSlug: string;
  backPath: string;
}

const StoreCustomPageView: React.FC<StoreCustomPageViewProps> = ({ ownerId, ownerType, pageSlug, backPath }) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState<CustomPage | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageProducts, setPageProducts] = useState<any[]>([]);
  const signedInLabel =
    String(profile?.full_name || '').trim() ||
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim() ||
    user?.email ||
    'Customer';

  const handleSignOut = async () => {
    await signOut();
    navigate(backPath || '/', { replace: true });
  };

  useEffect(() => {
    if (!ownerId || !ownerType || !pageSlug) {
      setError('Invalid page URL');
      setLoading(false);
      return;
    }

    const loadPage = async () => {
      try {
        setLoading(true);

        const { data: pageData, error: pageError } = await supabase
          .from('custom_pages')
          .select('*')
          .eq('owner_id', ownerId)
          .eq('owner_type', ownerType)
          .eq('page_slug', pageSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (pageError || !pageData) {
          setError('This page is not available');
          setLoading(false);
          return;
        }

        const { data: ownerData, error: ownerError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', ownerId)
          .maybeSingle();

        if (ownerError) {
          console.warn('[StoreCustomPageView] owner lookup failed:', ownerError);
        }

        const { data: placementRows, error: placementError } = await supabase
          .from('store_product_placements')
          .select('product_id,display_order')
          .eq('owner_id', ownerId)
          .eq('placement_type', 'page')
          .eq('custom_page_id', pageData.id)
          .eq('is_visible', true)
          .order('display_order', { ascending: true });

        if (placementError) {
          console.warn('[StoreCustomPageView] page product placement lookup failed:', placementError);
        }

        const productIds = (placementRows || []).map((row: any) => row.product_id).filter(Boolean);
        if (productIds.length) {
          const { data: productRows, error: productError } = await supabase
            .from('products')
            .select('*')
            .in('id', productIds);
          if (productError) {
            console.warn('[StoreCustomPageView] page products lookup failed:', productError);
          } else {
            const orderById = new Map((placementRows || []).map((row: any) => [row.product_id, row.display_order]));
            setPageProducts(
              (productRows || []).sort(
                (a: any, b: any) => Number(orderById.get(a.id) || 0) - Number(orderById.get(b.id) || 0)
              )
            );
          }
        } else {
          setPageProducts([]);
        }

        setPage(pageData as CustomPage);
        setOwner((ownerData as OwnerProfile) || null);
        setError('');
      } catch (err) {
        console.error('[StoreCustomPageView] Failed to load page:', err);
        setError('Unable to load this page');
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [ownerId, ownerType, pageSlug]);

  useEffect(() => {
    if (!ownerId) return;
    localStorage.setItem('beezio-store-scope', `store:${ownerType}:${ownerId}`);
    window.dispatchEvent(new Event('beezio-store-scope-changed'));
  }, [ownerId, ownerType]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-600">Loading page...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-14 h-14 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h2>
          <p className="text-gray-600 mb-6">{error || 'This page is unavailable.'}</p>
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to store
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Store className="w-4 h-4" />
              {owner?.full_name || 'Store'}
            </div>
            {user ? (
              <div className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
                <div className="flex min-w-0 items-center gap-2 px-1">
                  <UserCircle className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-xs font-semibold text-slate-900">{signedInLabel}</div>
                    {user.email && signedInLabel !== user.email ? (
                      <div className="truncate text-[0.68rem] text-slate-500">{user.email}</div>
                    ) : (
                      <div className="text-[0.68rem] text-slate-500">Signed in</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{page.page_title}</h1>
          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.page_content) }}
          />
        </div>

        {pageProducts.length > 0 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-2xl font-bold text-slate-900">Shop this page</h2>
            <ProductGrid
              products={pageProducts}
              hideAffiliateUI
              hideFilters
              hideShareUI
              hideSellerInfo
              ctaMode="storefront"
              forcePurchaseCtas
              productBasePath={`${backPath}/product`}
              storefrontBrand={{ name: owner?.full_name || 'Store' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreCustomPageView;

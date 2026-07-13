import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, RefreshCw, Search, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { deleteProductById } from '../utils/deleteProduct';
import {
  TEST_ITEM_AFFILIATE_AMOUNT,
  TEST_ITEM_BEEZIO_FEE,
  TEST_ITEM_INFLUENCER_FEE,
  TEST_ITEM_PRICE,
  TEST_ITEM_PROCESSING_FEE,
  TEST_ITEM_SELLER_AMOUNT,
  TEST_ITEM_TITLE,
} from '../../shared/testItemPricing';

type AdminProductRow = {
  id: string;
  title: string | null;
  seller_id: string | null;
  source_platform: string | null;
  cj_product_id: string | null;
  sku: string | null;
  price: number | null;
  is_active: boolean | null;
  created_at: string | null;
  seller_profile?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

const isRetiredSupplierProduct = (product: AdminProductRow) => {
  const source = String(product.source_platform || '').trim().toLowerCase();
  return ['cj', 'cjdropshipping', 'cj dropshipping', 'aliexpress'].includes(source) ||
    !!String(product.cj_product_id || '').trim();
};

const formatMoney = (value: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatDate = (value: string | null) => {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
};

const AdminProductHubPage: React.FC = () => {
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'current' | 'all' | 'retired'>('current');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingTestProduct, setSavingTestProduct] = useState(false);

  const fetchProducts = async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          id,
          title,
          seller_id,
          source_platform,
          cj_product_id,
          sku,
          price,
          is_active,
          created_at,
          seller_profile:profiles!products_seller_id_fkey(full_name,email)
        `)
        .order('created_at', { ascending: false })
        .limit(250);

      if (fetchError) throw fetchError;

      setProducts((data || []) as AdminProductRow[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchProducts();
  }, []);

  const resolveAdminProfileId = async (): Promise<string | null> => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) return null;

    const userId = String(authData.user.id).trim();
    const userEmail = String(authData.user.email || '').trim();

    const { data: profileById } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (profileById?.id) return String(profileById.id);

    if (userEmail) {
      const { data: profileByEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();
      if (profileByEmail?.id) return String(profileByEmail.id);
    }

    return null;
  };

  const handleCreateOrRefreshTestProduct = async () => {
    try {
      setSavingTestProduct(true);
      setError(null);
      setStatusMessage(null);

      const sellerProfileId = await resolveAdminProfileId();
      if (!sellerProfileId) {
        throw new Error('Unable to resolve the admin profile for the test product.');
      }

      const title = `${TEST_ITEM_TITLE} - paypal live split check`;
      const payload = {
        title,
        description: 'Admin-only PayPal live card-processing test product for validating BeeZio payouts and split tracking.',
        price: TEST_ITEM_PRICE,
        calculated_customer_price: TEST_ITEM_PRICE,
        seller_amount: TEST_ITEM_SELLER_AMOUNT,
        seller_ask: TEST_ITEM_SELLER_AMOUNT,
        seller_ask_price: TEST_ITEM_SELLER_AMOUNT,
        commission_rate: 0,
        commission_type: 'flat_rate',
        flat_commission_amount: TEST_ITEM_AFFILIATE_AMOUNT,
        affiliate_commission_type: 'flat',
        affiliate_commission_value: TEST_ITEM_AFFILIATE_AMOUNT,
        platform_fee: TEST_ITEM_BEEZIO_FEE,
        processing_fee: TEST_ITEM_PROCESSING_FEE,
        affiliate_enabled: true,
        category: 'Admin Test',
        stock_quantity: 999,
        images: [],
        tags: [
          'Beezio Admin Test',
          'PayPal Live Test',
          `Seller ${TEST_ITEM_SELLER_AMOUNT.toFixed(2)}`,
          `Affiliate ${TEST_ITEM_AFFILIATE_AMOUNT.toFixed(2)}`,
          `Influencers ${(TEST_ITEM_INFLUENCER_FEE * 2).toFixed(2)}`,
          `Beezio ${TEST_ITEM_BEEZIO_FEE.toFixed(2)}`,
        ],
        shipping_options: [],
        shipping_price: 0,
        shipping_cost: 0,
        requires_shipping: false,
        is_digital: false,
        is_subscription: false,
        status: 'active',
        is_promotable: true,
        is_active: true,
        seller_id: sellerProfileId,
      };

      const { data: existing, error: existingError } = await supabase
        .from('products')
        .select('id')
        .eq('seller_id', sellerProfileId)
        .ilike('title', `${TEST_ITEM_TITLE}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      const result = existing?.id
        ? await supabase.from('products').update(payload).eq('id', existing.id).select('id').single()
        : await supabase.from('products').insert([payload]).select('id').single();

      if (result.error) throw result.error;

      setStatusMessage(
        existing?.id
          ? `Refreshed the admin PayPal test product at $${TEST_ITEM_PRICE.toFixed(2)}.`
          : `Created the admin PayPal test product at $${TEST_ITEM_PRICE.toFixed(2)}.`
      );
      await fetchProducts(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to create the PayPal test product.');
    } finally {
      setSavingTestProduct(false);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesSource =
      sourceFilter === 'all'
        ? true
        : sourceFilter === 'retired'
          ? isRetiredSupplierProduct(product)
          : !isRetiredSupplierProduct(product);

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? product.is_active === true
          : product.is_active === false;

    if (!matchesSource || !matchesStatus) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      product.title,
      product.sku,
      product.id,
      product.seller_id,
      product.source_platform,
      product.cj_product_id,
      product.seller_profile?.full_name,
      product.seller_profile?.email,
    ]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');

    return haystack.includes(normalizedSearch);
  });

  const handleDelete = async (product: AdminProductRow) => {
    const sellerLabel =
      product.seller_profile?.email ||
      product.seller_profile?.full_name ||
      product.seller_id ||
      'unknown seller';
    const title = product.title || product.id;
    const sourceLabel = isRetiredSupplierProduct(product) ? 'retired supplier' : 'current supplier or seller';
    const confirmed = window.confirm(
      `Delete listing "${title}" from ${sellerLabel}?\n\nSource: ${sourceLabel}\nProduct ID: ${product.id}\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(product.id);
      setStatusMessage(null);
      const result = await deleteProductById({ productId: product.id });
      setProducts((current) => current.filter((entry) => entry.id !== product.id));
      setStatusMessage(
        result.mode === 'archived'
          ? `Archived ${title} because it has order history and cannot be hard-deleted.`
          : result.deletedOrders || result.deletedOrderItems
            ? `Deleted ${title} and purged ${result.deletedOrderItems || 0} linked order item(s) and ${result.deletedOrders || 0} empty order(s).`
          : `Deleted ${title}.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to delete product.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#101820] text-white py-6">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">Admin Product Hub</h1>
          <p className="text-gray-300">
            Manage current listings and review retired supplier records without deleting order history.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Listing Manager</h2>
              <p className="text-gray-700">
                Current products are shown by default. Retired supplier products stay archived for historical orders and tracking.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleCreateOrRefreshTestProduct()}
                disabled={savingTestProduct}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#101820] px-4 py-3 font-semibold text-[#ffcb05] hover:bg-black disabled:opacity-50"
              >
                <FlaskConical className="h-4 w-4" />
                {savingTestProduct ? 'Saving Test Product...' : 'Create/Refresh PayPal Test Product'}
              </button>
              <button
                type="button"
                onClick={() => void fetchProducts(true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_0.7fr_0.7fr]">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search title, SKU, seller email, product id..."
                className="w-full bg-transparent text-sm text-gray-900 outline-none"
              />
            </label>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'current' | 'all' | 'retired')}
              className="rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none"
            >
              <option value="current">Current sources</option>
              <option value="all">All sources</option>
              <option value="retired">Retired suppliers</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
            <span>Total loaded: {products.length}</span>
            <span>Visible: {filteredProducts.length}</span>
            <span>Retired supplier records: {filteredProducts.filter(isRetiredSupplierProduct).length}</span>
            <span>Current source records: {filteredProducts.filter((product) => !isRetiredSupplierProduct(product)).length}</span>
          </div>

          {statusMessage && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {statusMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="mt-6 text-sm text-gray-600">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-600">
              No products matched the current filters.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Listing</th>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900">{product.title || 'Untitled product'}</div>
                        <div className="mt-1 text-xs text-gray-500">ID: {product.id}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          SKU: {product.sku || 'n/a'}
                          {product.cj_product_id ? ` | Legacy source ID: ${product.cj_product_id}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <div>{product.seller_profile?.full_name || 'Unknown seller'}</div>
                        <div className="text-xs text-gray-500">{product.seller_profile?.email || product.seller_id || 'n/a'}</div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            isRetiredSupplierProduct(product)
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isRetiredSupplierProduct(product) ? 'RETIRED' : (product.source_platform || 'manual').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatMoney(product.price)}</td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            product.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatDate(product.created_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => void handleDelete(product)}
                            disabled={deletingId === product.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingId === product.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Printful Store Import</h2>
            <p className="text-gray-700 mb-4">
              Connect Beezio&apos;s Printful store, register the webhook, and import synced print-on-demand products directly into the admin catalog.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/printful"
                className="inline-flex items-center px-5 py-3 rounded-lg bg-[#ffcb05] text-black font-semibold hover:bg-[#e0b000] transition-colors"
              >
                Open Printful Import
              </Link>
              <Link
                to="/dashboard?section=admin"
                className="inline-flex items-center px-5 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
              >
                Open Admin Dashboard
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">EggRacks URL Import</h2>
            <p className="text-gray-700 mb-4">
              Paste an EggRacks product URL to pull over the title, description, item code, images, and variant options, then save it as a draft marketplace item for pricing review.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/eggracks-import"
                className="inline-flex items-center px-5 py-3 rounded-lg bg-[#101820] text-white font-semibold hover:bg-black transition-colors"
              >
                Open EggRacks Import
              </Link>
              <Link
                to="/admin/products"
                className="inline-flex items-center px-5 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
              >
                Stay In Product Hub
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Bulk Add Products (Spreadsheet)</h2>
            <p className="text-gray-700 mb-4">
              Upload many products at once and set affiliate commission per item. Use this for seller-managed or approved supplier products.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/bulk-products"
                className="inline-flex items-center px-5 py-3 rounded-lg bg-[#101820] text-[#ffcb05] font-semibold hover:bg-black transition-colors"
              >
                Bulk Upload
              </Link>
              <Link
                to="/add-product"
                className="inline-flex items-center px-5 py-3 rounded-lg border border-gray-300 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
              >
                Add Products Manually
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Approved Product Sources</h2>
          <p className="text-gray-700">
            Printful has a dedicated admin import flow, Printify remains available in integrations, and EggRacks uses a draft-first URL import flow. New sources should be reviewed before being enabled.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminProductHubPage;

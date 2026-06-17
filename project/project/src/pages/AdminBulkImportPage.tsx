import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { parseCsvPreview } from '../utils/cjBulkImportUtils';

type ImportSummary = {
  products_total: number;
  products_created: number;
  products_updated: number;
  variants_total: number;
  variants_created: number;
  variants_updated: number;
  errors: number;
};

type ImportResponse = {
  ok: boolean;
  dry_run: boolean;
  summary: ImportSummary;
  errors?: Array<{ cj_product_id?: string; cj_variant_id?: string; message: string }>;
  preview?: Array<Record<string, string>>;
};

const AdminBulkImportPage: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.primary_role === 'admin';
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<'draft' | 'active'>('draft');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [bulkInventoryValue, setBulkInventoryValue] = useState('');

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [inventoryEdits, setInventoryEdits] = useState<Record<string, string>>({});
  const [syncingInventory, setSyncingInventory] = useState(false);
  const [syncInventoryMessage, setSyncInventoryMessage] = useState<string | null>(null);

  const getAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error('Missing session token');
    return token;
  };

  const callApi = async (url: string, options?: RequestInit) => {
    const token = await getAccessToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || `Request failed (${res.status})`);
    }
    return payload;
  };

  useEffect(() => {
    if (!file) {
      setPreviewRows([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : parsed?.products ?? parsed?.items ?? [];
          setPreviewRows(list.slice(0, 20));
        } catch {
          setPreviewRows([]);
        }
      } else {
        setPreviewRows(parseCsvPreview(text).slice(0, 20));
      }
    };
    reader.readAsText(file);
  }, [file]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('id, name');
      if (!error && data) {
        setCategories(data as any);
      }
    } catch {
      setCategories([]);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      let query = supabase
        .from('products')
        .select('id, title, status, in_stock, total_inventory, cj_product_id, beezio_category_id, primary_image_url, updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (stockFilter === 'in') query = query.eq('in_stock', true);
      if (stockFilter === 'out') query = query.eq('in_stock', false);
      if (categoryFilter !== 'all') query = query.eq('beezio_category_id', categoryFilter);
      if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      setProducts((data as any[]) || []);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadVariants = async (productId: string) => {
    setLoadingVariants(true);
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, sku, cj_variant_id, inventory, inventory_policy, is_active, in_stock')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setVariants((data as any[]) || []);
    } catch {
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadCategories();
    loadProducts();
  }, [isAdmin]);

  const handleImport = async (dryRun: boolean) => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = await getAccessToken();
      const res = await fetch(`/api/import/cj/bulk?dry_run=${dryRun ? 'true' : 'false'}&default_status=${defaultStatus}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = (await res.json().catch(() => ({}))) as ImportResponse;
      if (!res.ok) throw new Error(payload?.errors?.[0]?.message || payload?.summary ? 'Import failed' : 'Import failed');
      setImportResult(payload);
      if (!dryRun) loadProducts();
    } catch (err) {
      setImportResult({
        ok: false,
        dry_run: dryRun,
        summary: {
          products_total: 0,
          products_created: 0,
          products_updated: 0,
          variants_total: 0,
          variants_created: 0,
          variants_updated: 0,
          errors: 1,
        },
        errors: [{ message: err instanceof Error ? err.message : 'Import failed' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const selectProduct = async (product: any) => {
    setSelectedProduct(product);
    setSelectedVariantIds([]);
    await loadVariants(product.id);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const toggleVariantSelection = (variantId: string) => {
    setSelectedVariantIds((prev) =>
      prev.includes(variantId) ? prev.filter((id) => id !== variantId) : [...prev, variantId]
    );
  };

  const selectAllFilteredProducts = () => {
    setSelectedProductIds(filteredProducts.map((product) => product.id));
  };

  const clearSelections = () => {
    setSelectedProductIds([]);
    setSelectedVariantIds([]);
  };

  const runProductBulkAction = async (action: 'activate' | 'archive') => {
    if (!selectedProductIds.length) return;
    await callApi('/api/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, ids: selectedProductIds }),
    });
    clearSelections();
    loadProducts();
  };

  const runVariantBulkAction = async (action: 'enable' | 'disable' | 'set_inventory' | 'set_inventory_zero') => {
    if (!selectedVariantIds.length) return;
    const payload: any = { action, ids: selectedVariantIds };
    if (action === 'set_inventory') {
      const numeric = Number(bulkInventoryValue);
      if (!Number.isFinite(numeric) || numeric < 0) return;
      payload.inventory = numeric;
    }
    await callApi('/api/variants/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setBulkInventoryValue('');
    setSelectedVariantIds([]);
    if (selectedProduct) await loadVariants(selectedProduct.id);
    loadProducts();
  };

  const updateInventory = async (variantId: string) => {
    const raw = inventoryEdits[variantId];
    if (!raw) return;
    const inventory = Number(raw);
    if (!Number.isFinite(inventory) || inventory < 0) return;
    await callApi(`/api/variants/${variantId}/inventory`, {
      method: 'POST',
      body: JSON.stringify({ inventory }),
    });
    if (selectedProduct) await loadVariants(selectedProduct.id);
    loadProducts();
  };

  const syncCjInventory = async () => {
    setSyncingInventory(true);
    setSyncInventoryMessage(null);
    try {
      const payload = await callApi('/api/inventory/cj/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const updatedProducts = Number(payload?.updated_products || 0);
      const updatedVariants = Number(payload?.updated_variants || 0);
      const failedVariants = Number(payload?.failed_variants || 0);
      setSyncInventoryMessage(
        `CJ sync complete. Products updated: ${updatedProducts}, variants updated: ${updatedVariants}, failed variants: ${failedVariants}.`
      );

      await loadProducts();
      if (selectedProduct?.id) await loadVariants(selectedProduct.id);
    } catch (err) {
      setSyncInventoryMessage(err instanceof Error ? err.message : 'CJ inventory sync failed.');
    } finally {
      setSyncingInventory(false);
    }
  };

  const filteredProducts = useMemo(() => products, [products]);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Access denied. Admins only.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">CJ Bulk Import</h1>
        <p className="text-sm text-gray-600">
          Upload a CSV or JSON file to bulk import CJ products and variants. Use dry-run to preview results.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <input
              type="file"
              accept=".csv,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-gray-300 p-3"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Default status</label>
            <select
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value as 'draft' | 'active')}
              className="w-full rounded-lg border border-gray-300 p-2"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => handleImport(true)}
            disabled={!file || importing}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-900 hover:border-amber-500"
          >
            Dry Run
          </button>
          <button
            onClick={() => handleImport(false)}
            disabled={!file || importing}
            className="px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-600"
          >
            Import
          </button>
          <a
            href="/templates/cj-bulk-import-template.csv"
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-900 hover:border-amber-500"
            download
          >
            Download CSV Template
          </a>
          <a
            href="/templates/cj-bulk-import-template.json"
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-900 hover:border-amber-500"
            download
          >
            Download JSON Template
          </a>
        </div>

        {previewRows.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Preview (first 20 rows)</h2>
            <div className="overflow-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-xs text-gray-700">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewRows[0]).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-semibold">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      {Object.values(row).map((val, colIdx) => (
                        <td key={`${idx}-${colIdx}`} className="px-3 py-2">
                          {String(val || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importResult && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <div className="font-semibold text-gray-900 mb-2">
              {importResult.ok ? 'Import complete' : 'Import finished with errors'}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>Products: {importResult.summary.products_total}</div>
              <div>Created: {importResult.summary.products_created}</div>
              <div>Updated: {importResult.summary.products_updated}</div>
              <div>Variants: {importResult.summary.variants_total}</div>
              <div>Variant created: {importResult.summary.variants_created}</div>
              <div>Variant updated: {importResult.summary.variants_updated}</div>
            </div>
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-3 text-red-700">
                {importResult.errors.slice(0, 5).map((err, idx) => (
                  <div key={idx}>
                    {err.cj_product_id ? `${err.cj_product_id}: ` : ''}
                    {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Manage Imported Products</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 p-2"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-gray-300 p-2"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="rounded-lg border border-gray-300 p-2"
          >
            <option value="all">All stock</option>
            <option value="in">In stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 p-2"
          >
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={loadProducts}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-900 hover:border-amber-500"
          >
            Refresh list
          </button>
          <button
            onClick={syncCjInventory}
            disabled={syncingInventory}
            className="px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-600 disabled:opacity-60"
          >
            {syncingInventory ? 'Syncing CJ inventory...' : 'One-click sync CJ inventory'}
          </button>
        </div>

        {syncInventoryMessage && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            {syncInventoryMessage}
          </div>
        )}

        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-semibold text-gray-900">
              Selected products: {selectedProductIds.length}
            </div>
            <button
              onClick={selectAllFilteredProducts}
              className="px-3 py-1 rounded border border-gray-300"
            >
              Select all filtered
            </button>
            <button
              onClick={clearSelections}
              className="px-3 py-1 rounded border border-gray-300"
            >
              Clear selection
            </button>
            <button
              onClick={() => runProductBulkAction('activate')}
              disabled={!selectedProductIds.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >
              Bulk activate
            </button>
            <button
              onClick={() => runProductBulkAction('archive')}
              disabled={!selectedProductIds.length}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >
              Bulk archive
            </button>
          </div>
        </div>

        {loadingProducts ? (
          <div className="text-sm text-gray-600">Loading products...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  className={`w-full text-left border rounded-lg p-3 ${
                    selectedProduct?.id === product.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="font-semibold text-gray-900">{product.title}</div>
                      </div>
                      <div className="text-xs text-gray-500">CJ: {product.cj_product_id || '—'}</div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {product.status} · {product.in_stock ? 'in stock' : 'out'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Total inventory: {product.total_inventory ?? 0}</div>
                </button>
              ))}
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              {!selectedProduct ? (
                <div className="text-sm text-gray-600">Select a product to manage variants.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{selectedProduct.title}</div>
                      <div className="text-xs text-gray-500">Status: {selectedProduct.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => callApi(`/api/products/${selectedProduct.id}/activate`, { method: 'POST' }).then(loadProducts)}
                        className="px-3 py-1 rounded border border-gray-300 text-xs"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => callApi(`/api/products/${selectedProduct.id}/archive`, { method: 'POST' }).then(loadProducts)}
                        className="px-3 py-1 rounded border border-gray-300 text-xs"
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this product? This cannot be undone.')) {
                            callApi(`/api/products/${selectedProduct.id}/delete`, { method: 'POST' }).then(() => {
                              setSelectedProduct(null);
                              setVariants([]);
                              loadProducts();
                            });
                          }
                        }}
                        className="px-3 py-1 rounded border border-red-300 text-xs text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Variants</div>
                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-gray-900">
                          Selected variants: {selectedVariantIds.length}
                        </div>
                        <button
                          onClick={() => setSelectedVariantIds(variants.map((v) => v.id))}
                          className="px-2 py-1 rounded border border-gray-300"
                        >
                          Select all
                        </button>
                        <button
                          onClick={() => setSelectedVariantIds([])}
                          className="px-2 py-1 rounded border border-gray-300"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => runVariantBulkAction('enable')}
                          disabled={!selectedVariantIds.length}
                          className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                        >
                          Bulk enable
                        </button>
                        <button
                          onClick={() => runVariantBulkAction('disable')}
                          disabled={!selectedVariantIds.length}
                          className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                        >
                          Bulk disable
                        </button>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={bulkInventoryValue}
                            onChange={(e) => setBulkInventoryValue(e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1"
                            placeholder="Qty"
                          />
                          <button
                            onClick={() => runVariantBulkAction('set_inventory')}
                            disabled={!selectedVariantIds.length}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                          >
                            Bulk set qty
                          </button>
                        </div>
                        <button
                          onClick={() => runVariantBulkAction('set_inventory_zero')}
                          disabled={!selectedVariantIds.length}
                          className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
                        >
                          Set qty to 0
                        </button>
                      </div>
                    </div>
                    {loadingVariants ? (
                      <div className="text-sm text-gray-600">Loading variants...</div>
                    ) : variants.length === 0 ? (
                      <div className="text-sm text-gray-600">No variants found.</div>
                    ) : (
                      <div className="space-y-2">
                        {variants.map((variant) => (
                          <div key={variant.id} className="border border-gray-200 rounded-lg p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedVariantIds.includes(variant.id)}
                                    onChange={() => toggleVariantSelection(variant.id)}
                                  />
                                  <div className="font-semibold text-gray-900">
                                    {variant.sku || variant.cj_variant_id}
                                  </div>
                                </div>
                                <div className="text-gray-500">Inventory: {variant.inventory ?? 0}</div>
                              </div>
                              <div className="text-gray-500">
                                {variant.is_active ? 'active' : 'disabled'} · {variant.in_stock ? 'in stock' : 'out'}
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  callApi(`/api/variants/${variant.id}/enable`, { method: 'POST' }).then(() =>
                                    loadVariants(selectedProduct.id)
                                  )
                                }
                                className="px-2 py-1 rounded border border-gray-300"
                              >
                                Enable
                              </button>
                              <button
                                onClick={() =>
                                  callApi(`/api/variants/${variant.id}/disable`, { method: 'POST' }).then(() =>
                                    loadVariants(selectedProduct.id)
                                  )
                                }
                                className="px-2 py-1 rounded border border-gray-300"
                              >
                                Disable
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Delete this variant?')) {
                                    callApi(`/api/variants/${variant.id}/delete`, { method: 'POST' }).then(() =>
                                      loadVariants(selectedProduct.id)
                                    );
                                  }
                                }}
                                className="px-2 py-1 rounded border border-red-300 text-red-700"
                              >
                                Delete
                              </button>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={inventoryEdits[variant.id] ?? ''}
                                  onChange={(e) =>
                                    setInventoryEdits((prev) => ({ ...prev, [variant.id]: e.target.value }))
                                  }
                                  className="w-20 rounded border border-gray-300 px-2 py-1"
                                  placeholder="Qty"
                                />
                                <button
                                  onClick={() => updateInventory(variant.id)}
                                  className="px-2 py-1 rounded border border-gray-300"
                                >
                                  Update
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBulkImportPage;

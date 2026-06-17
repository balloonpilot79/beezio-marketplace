import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Package, RefreshCw, ShieldCheck, Store, Unplug } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

type IntegrationRecord = {
  id: string;
  platform: string;
  status: string;
  is_active: boolean;
  api_key?: string | null;
  store_url?: string | null;
  webhook_url?: string | null;
  last_sync?: string | null;
  settings?: {
    store_id?: number;
    store_name?: string | null;
    webhook_url?: string | null;
    webhook_error?: string | null;
    auto_sync?: boolean;
  } | null;
};

type ImportPreviewItem = {
  product_id?: string | null;
  external_id: string;
  title: string;
  image?: string | null;
  status: 'created' | 'updated' | 'skipped';
  platform: 'printful' | 'printify';
};

const DEFAULT_COMMISSION_RATE = 25;

interface AdminPrintfulImportPageProps {
  embedded?: boolean;
}

const AdminPrintfulImportPage: React.FC<AdminPrintfulImportPageProps> = ({ embedded = false }) => {
  const { profile } = useAuth();
  const [integration, setIntegration] = useState<IntegrationRecord | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION_RATE);
  const [autoSync, setAutoSync] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[]>([]);
  const [importSummary, setImportSummary] = useState<{
    created: number;
    updated: number;
    skipped: number;
    variants_updated: number;
  } | null>(null);

  const isConnected = Boolean(integration?.is_active);
  const connectedStoreName = integration?.settings?.store_name || 'Connected Printful store';
  const webhookUrl = integration?.webhook_url || integration?.settings?.webhook_url || null;
  const webhookError = integration?.settings?.webhook_error || null;

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? `Bearer ${token}` : '';
  };

  const loadPageState = async (showRefreshingState = false) => {
    if (showRefreshingState) setRefreshing(true);
    else setPageLoading(true);

    setErrorMessage(null);

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) {
        throw new Error('You need to be signed in as the Beezio admin account to manage Printful.');
      }

      const response = await fetch('/api/integrations/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load integrations.');
      }

      const integrations = Array.isArray(payload?.integrations) ? payload.integrations : [];
      const printfulIntegration = integrations.find((item: IntegrationRecord) => item.platform === 'printful') || null;
      setIntegration(printfulIntegration);
      setAutoSync(Boolean(printfulIntegration?.settings?.auto_sync));

      if (profile?.id) {
        const { count, error } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', profile.id)
          .eq('source_platform', 'printful');

        if (error) {
          console.warn('[AdminPrintfulImportPage] product count failed:', error);
          setProductCount(0);
        } else {
          setProductCount(count || 0);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load Printful admin tools.');
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPageState();
  }, [profile?.id]);

  const handleConnect = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setErrorMessage('Paste the Printful API token first.');
      return;
    }

    setConnecting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) throw new Error('Missing session. Sign in again and retry.');

      const response = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          platform: 'printful',
          apiKey: trimmedKey,
          autoSync,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to connect Printful.');
      }

      if (payload?.integration) {
        setIntegration(payload.integration as IntegrationRecord);
      }
      setApiKey('');
      setStatusMessage('Printful connected. The Beezio store is ready to import products.');
      await loadPageState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect Printful.');
    } finally {
      setConnecting(false);
    }
  };

  const handleImport = async () => {
    if (!isConnected) {
      setErrorMessage('Connect Printful before importing products.');
      return;
    }

    setImporting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setImportPreview([]);
    setImportSummary(null);

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) throw new Error('Missing session. Sign in again and retry.');

      const response = await fetch('/api/integrations/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          platform: 'printful',
          commissionRate,
          autoSync,
          markAsAffiliate: false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to import Printful products.');
      }

      const results = payload?.results || {};
      setImportSummary({
        created: Number(results?.created || 0),
        updated: Number(results?.updated || 0),
        skipped: Number(results?.skipped || 0),
        variants_updated: Number(results?.variants_updated || 0),
      });
      setImportPreview(Array.isArray(results?.preview) ? results.preview : []);
      setStatusMessage('Printful import finished. Review the summary below, then open the marketplace products list if needed.');
      await loadPageState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import Printful products.');
    } finally {
      setImporting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isConnected) return;

    setDisconnecting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const authHeader = await getAuthHeader();
      if (!authHeader) throw new Error('Missing session. Sign in again and retry.');

      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ platform: 'printful' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to disconnect Printful.');
      }

      setStatusMessage('Printful disconnected. Imported products remain in Beezio until you edit or remove them.');
      setIntegration(null);
      await loadPageState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to disconnect Printful.');
    } finally {
      setDisconnecting(false);
    }
  };

  const lastSyncText = useMemo(() => {
    if (!integration?.last_sync) return 'Not synced yet';
    return new Date(integration.last_sync).toLocaleString();
  }, [integration?.last_sync]);

  return (
    <div
      className={
        embedded
          ? ''
          : 'min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,203,5,0.16),_transparent_38%),linear-gradient(180deg,#fff8dc_0%,#f7f7f5_28%,#f4f4f1_100%)]'
      }
    >
      <div className={embedded ? '' : 'bg-[#101820] text-white py-8'}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.32em] ${embedded ? 'text-amber-700' : 'text-[#ffcb05]'}`}>Admin Integration</p>
              <h1 className={`mt-2 text-3xl font-bold ${embedded ? 'text-gray-900' : ''}`}>Printful Import for Beezio</h1>
              <p className={`mt-2 max-w-3xl text-sm ${embedded ? 'text-gray-600' : 'text-gray-300'}`}>
                Connect the Beezio Printful store, import synced products into marketplace inventory, and keep fulfillment tied to Printful.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!embedded && (
                <Link
                  to="/admin/products"
                  className="inline-flex items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Back to Product Hub
                </Link>
              )}
              <button
                type="button"
                onClick={() => void loadPageState(true)}
                disabled={refreshing || pageLoading}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                  embedded
                    ? 'border border-amber-300 bg-amber-50 text-gray-900 hover:bg-amber-100'
                    : 'bg-[#ffcb05] text-black hover:bg-[#e0b000]'
                }`}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-6xl mx-auto px-4 ${embedded ? 'py-6' : 'py-8'} space-y-6`}>
        {(statusMessage || errorMessage) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              errorMessage
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {errorMessage || statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#101820]/10 bg-white/95 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Status</div>
            <div className="mt-3 flex items-center gap-2 text-lg font-bold text-[#101820]">
              {isConnected ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
              {isConnected ? 'Connected' : 'Waiting'}
            </div>
          </div>
          <div className="rounded-2xl border border-[#101820]/10 bg-white/95 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Store</div>
            <div className="mt-3 text-lg font-bold text-[#101820]">{isConnected ? connectedStoreName : 'Not linked'}</div>
          </div>
          <div className="rounded-2xl border border-[#101820]/10 bg-white/95 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Imported</div>
            <div className="mt-3 text-lg font-bold text-[#101820]">{productCount} products</div>
          </div>
          <div className="rounded-2xl border border-[#101820]/10 bg-white/95 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Last Sync</div>
            <div className="mt-3 text-sm font-semibold text-[#101820]">{lastSyncText}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-[#101820]/10 bg-white/95 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#101820]">Connect Beezio&apos;s Printful Store</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Paste the Printful API token for the Beezio store. The backend already discovers the first store on that token and registers the webhook when site settings allow it.
                </p>
              </div>
              <Store className="h-8 w-8 text-[#101820]" />
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="printful-api-key" className="block text-sm font-semibold text-gray-800">
                  Printful API token
                </label>
                <input
                  id="printful-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Paste the Beezio Printful token"
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#ffcb05] focus:ring-4 focus:ring-[#ffcb05]/20"
                />
                <p className="mt-2 text-xs text-gray-500">
                  The token is sent to the secured integration endpoint and stored server-side in encrypted form. It is not written into this frontend code.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(event) => setAutoSync(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#101820] focus:ring-[#ffcb05]"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Keep auto sync enabled</span>
                  <span className="block text-xs text-gray-600">
                    New imports will update existing Printful products when sync runs again.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || pageLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#101820] px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {isConnected ? 'Reconnect Printful' : 'Connect Printful'}
                </button>
                {isConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Disconnect
                  </button>
                )}
                <a
                  href="https://www.printful.com/dashboard/store"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#ffcb05]/60 bg-[#fff8dc] px-5 py-3 text-sm font-semibold text-[#101820] hover:bg-[#fff1b8]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Printful
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#101820]/10 bg-[#101820] p-6 text-white shadow-sm">
            <h2 className="text-xl font-bold">Connection Notes</h2>
            <div className="mt-4 space-y-4 text-sm text-gray-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold text-[#ffcb05]">What this does</div>
                <p className="mt-2">Imports Printful synced products into Beezio products, creates mapped variants, and keeps Printful as the fulfillment source.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold text-[#ffcb05]">Webhook</div>
                <p className="mt-2 break-all">{webhookUrl || 'Webhook will appear here after a successful connection if the site URL is configured.'}</p>
                {webhookError && <p className="mt-2 text-amber-300">Webhook warning: {webhookError}</p>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-semibold text-[#ffcb05]">After import</div>
                <p className="mt-2">Review shipping, pricing, and storefront visibility on imported listings before promoting them.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#101820]/10 bg-white/95 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[#101820]">Import Printful Products</h2>
              <p className="mt-2 text-sm text-gray-600">
                This pulls the current Printful catalog for the connected Beezio store into the marketplace product table.
              </p>
            </div>
            <Package className="h-8 w-8 text-[#101820]" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-4">
              <div>
                <label htmlFor="commission-rate" className="block text-sm font-semibold text-gray-800">
                  Affiliate commission rate (%)
                </label>
                <input
                  id="commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(event) => setCommissionRate(Number(event.target.value || DEFAULT_COMMISSION_RATE))}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#ffcb05] focus:ring-4 focus:ring-[#ffcb05]/20"
                />
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Imported POD products currently default to `shipping_cost = 0` in the integration backend. Adjust shipping on listings afterward if Beezio should charge it separately.
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!isConnected || importing || pageLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#ffcb05] px-5 py-3 text-sm font-semibold text-black hover:bg-[#e0b000] disabled:opacity-60"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  Import From Printful
                </button>
                <Link
                  to="/dashboard?section=admin"
                  className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Open Admin Dashboard
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Created</div>
                  <div className="mt-2 text-2xl font-bold text-[#101820]">{importSummary?.created ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Updated</div>
                  <div className="mt-2 text-2xl font-bold text-[#101820]">{importSummary?.updated ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Skipped</div>
                  <div className="mt-2 text-2xl font-bold text-[#101820]">{importSummary?.skipped ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Variants</div>
                  <div className="mt-2 text-2xl font-bold text-[#101820]">{importSummary?.variants_updated ?? 0}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Latest import preview</div>
                {pageLoading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading import state...
                  </div>
                ) : importPreview.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">Run an import to see the latest created, updated, or skipped Printful items here.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {importPreview.map((item, index) => (
                      <div key={`${item.external_id}-${index}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-14 w-14 rounded-xl border border-gray-200 object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-[11px] text-gray-400">
                            No image
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">{item.title}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">{item.status} · {item.platform}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPrintfulImportPage;

import React, { useEffect, useState } from 'react';
import { Download, FileText, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Entitlement = {
  id: string;
  title: string;
  filename: string;
  fileSizeBytes: number | null;
  remainingDownloads: number;
  instructions: string | null;
  returnPolicyNotice: string | null;
};

interface DigitalDownloadPanelProps {
  orderId?: string;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const DigitalDownloadPanel: React.FC<DigitalDownloadPanelProps> = ({ orderId }) => {
  const [items, setItems] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        setItems([]);
        setError('Sign in to access your digital downloads.');
        return;
      }

      const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
      const response = await fetch(`/api/digital-downloads${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String((payload as any)?.error || 'Failed to load digital downloads'));
      setItems(Array.isArray((payload as any)?.entitlements) ? (payload as any).entitlements : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load digital downloads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const handleRedeem = async (entitlementId: string) => {
    setRedeemingId(entitlementId);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Sign in to download your files.');

      const response = await fetch('/api/digital-downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entitlementId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String((payload as any)?.error || 'Download failed'));
      const url = String((payload as any)?.url || '').trim();
      if (url) window.location.assign(url);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading) return <div className="text-sm text-gray-600">Loading digital downloads...</div>;
  if (!items.length && !error) return <div className="text-sm text-gray-600">No digital downloads available.</div>;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Digital Delivery</h3>
          <p className="mt-1 text-sm text-amber-900">
            Each paid download can be redeemed only the number of times purchased. After download, refunds are not available unless the file is corrupted, inaccessible, or materially different from what was sold.
          </p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const fileSize = formatFileSize(item.fileSizeBytes);
          return (
            <div key={item.id} className="rounded-lg border border-white bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-gray-900">
                    <FileText className="h-4 w-4 text-amber-700" />
                    <span className="truncate font-semibold">{item.title}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {item.filename}
                    {fileSize ? ` • ${fileSize}` : ''}
                    {` • ${item.remainingDownloads} download${item.remainingDownloads === 1 ? '' : 's'} left`}
                  </div>
                  {item.instructions && <div className="mt-2 text-sm text-gray-700">{item.instructions}</div>}
                  {item.returnPolicyNotice && <div className="mt-2 text-xs font-medium text-amber-800">{item.returnPolicyNotice}</div>}
                </div>
                <button
                  type="button"
                  disabled={item.remainingDownloads <= 0 || redeemingId === item.id}
                  onClick={() => handleRedeem(item.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {redeemingId === item.id ? 'Preparing...' : item.remainingDownloads > 0 ? 'Download once' : 'Downloaded'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DigitalDownloadPanel;

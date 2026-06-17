import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Copy, Share } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { ensureProfileIdForUser } from '../utils/resolveProfileId';

interface StoreLinksProps {
  userRole: 'seller' | 'affiliate';
  className?: string;
}

const StoreLinks: React.FC<StoreLinksProps> = ({ userRole, className = '' }) => {
  const { user, profile } = useAuth();

  const fallbackProfileId = profile?.id || user?.id || '';
  const [canonicalProfileId, setCanonicalProfileId] = useState<string>('');
  const profileId = canonicalProfileId || fallbackProfileId;

  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const resolve = async () => {
      if (!user?.id) {
        setCanonicalProfileId('');
        return;
      }
      try {
        const resolved = await ensureProfileIdForUser(user);
        if (alive) setCanonicalProfileId(String(resolved || ''));
      } catch {
        if (alive) setCanonicalProfileId('');
      }
    };
    void resolve();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const ownerId = String(profileId || '').trim();
      if (!ownerId) return;
      try {
        const table = userRole === 'seller' ? 'store_settings' : 'affiliate_store_settings';
        const idField = userRole === 'seller' ? 'seller_id' : 'affiliate_id';
        const { data, error } = await supabase
          .from(table)
          .select('custom_domain, subdomain')
          .eq(idField, ownerId)
          .maybeSingle();
        if (!alive) return;
        if (error && error.code !== 'PGRST116') {
          console.warn('[StoreLinks] Store settings lookup error (non-fatal):', error);
        }
        setCustomDomain(data?.custom_domain ? String(data.custom_domain) : null);
        setSubdomain(data?.subdomain ? String(data.subdomain) : null);
      } catch {
        if (!alive) return;
        setCustomDomain(null);
        setSubdomain(null);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [profileId, userRole]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const resolvedHref = useMemo(() => {
    const cleanDomain = String(customDomain || '').trim();
    if (cleanDomain) {
      return `https://${cleanDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
    }

    const cleanSlug = String(subdomain || '').trim().toLowerCase();
    if (cleanSlug) {
      return `${origin}/store/${cleanSlug}`;
    }

    const id = String(profileId || '').trim();
    if (!id) return '';
    return userRole === 'affiliate'
      ? `${origin}/partner/${id}`
      : `${origin}/store/${id}`;
  }, [customDomain, origin, profileId, subdomain, userRole]);

  const resolvedPath = useMemo(() => {
    const cleanDomain = String(customDomain || '').trim();
    if (cleanDomain) return resolvedHref;

    const cleanSlug = String(subdomain || '').trim().toLowerCase();
    if (cleanSlug) {
      return `/store/${cleanSlug}`;
    }

    const id = String(profileId || '').trim();
    if (!id) return 'Profile still loading';
    return userRole === 'affiliate'
      ? `/partner/${id}`
      : `/store/${id}`;
  }, [customDomain, profileId, resolvedHref, subdomain, userRole]);

  const storeUrl = resolvedHref;
  const storePath = resolvedPath;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareStore = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My ${userRole === 'seller' ? 'Custom' : 'Partner'} Store`,
          url: storeUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard(storeUrl);
    }
  };

  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          My {userRole === 'seller' ? 'Custom' : 'Partner'} Store
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => Boolean(storeUrl) && copyToClipboard(storeUrl)}
            className={`p-2 rounded-lg transition-colors ${storeUrl ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
            title="Copy store URL"
            disabled={!storeUrl}
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => Boolean(storeUrl) && shareStore()}
            className={`p-2 rounded-lg transition-colors ${storeUrl ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
            title="Share store"
            disabled={!storeUrl}
          >
            <Share className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Store URL</label>
          <div className="flex items-center space-x-2">
            <code className="flex-1 bg-gray-50 px-3 py-2 rounded-lg text-sm font-mono border">
              {storePath}
            </code>
            {storeUrl && (
              <a
                href={storePath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Visit</span>
              </a>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {userRole === 'seller' ? (
            <>
              Share this link to showcase your products with your custom branding and themes.
            </>
          ) : (
            <>
              Share this link to earn commissions on every sale from your personalized store.
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreLinks;

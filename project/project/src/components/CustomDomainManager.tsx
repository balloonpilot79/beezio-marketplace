import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import { normalizeStoreSlug } from '../utils/normalizeStoreSlug';

interface CustomDomainManagerProps {
  userId: string;
  role: 'seller' | 'affiliate';
  currentDomain?: string;
  subdomain?: string;
  onUpdated?: (next: { customDomain?: string | null; subdomain?: string | null }) => void;
}

const CustomDomainManager: React.FC<CustomDomainManagerProps> = ({ userId, role, currentDomain, subdomain, onUpdated }) => {
  const [domain, setDomain] = useState(currentDomain || '');
  const normalizeSubdomainInput = (input: string) =>
    normalizeStoreSlug(input)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

  const [subdomainInput, setSubdomainInput] = useState(normalizeSubdomainInput(subdomain || ''));
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(userId);
  const slugLocked = false;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!userId) {
        setResolvedUserId('');
        return;
      }
      const canonicalId = await resolveProfileIdForUser(userId);
      if (!cancelled) {
        setResolvedUserId(canonicalId || userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (currentDomain) {
      setDomain(currentDomain);
      verifyDomain(currentDomain);
    }
  }, [currentDomain]);

  const validateSubdomain = (input: string): boolean => {
    const clean = normalizeSubdomainInput(input);
    if (!/^[a-z0-9-]{3,32}$/.test(clean)) return false;
    if (clean.includes('beezio') || clean.includes('bzo')) return false;
    const reserved = new Set([
      'home','marketplace','stores','affiliates','affiliate','partner','affiliate-signup','affiliate-dashboard-preview',
      'seller','sellers','store','products','product','dashboard','dashboard-preview','buyer-dashboard-preview',
      'admin','auth','login','signup','onboarding','messages','earnings','checkout','cart',
      'about','contact','privacy','terms','faq','search','how-it-works','get-started','start-earning',
      'add-product','add-product-old','profile','orders','order-confirmation','contact-support','write-review',
      'reset-password','change-password','test','testing','revolutionary','api'
    ]);
    if (reserved.has(clean)) return false;
    return true;
  };

  const validateDomain = (input: string): boolean => {
    // Remove protocol if present
    const cleanDomain = input.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Basic domain validation
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainRegex.test(cleanDomain);
  };

  const verifyDomain = async (domainToVerify: string) => {
    setVerifying(true);
    try {
      if (!validateDomain(domainToVerify)) {
        setVerificationStatus('failed');
        return;
      }

      const cleanDomain = domainToVerify.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
      const isRootDomain = cleanDomain.split('.').length === 2;
      const expectedCname = 'beezio-marketplace.netlify.app';
      const expectedRootIp = '104.198.14.52';

      const fetchDns = async (name: string, type: string) => {
        const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
        const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
        if (!res.ok) return null;
        return res.json() as Promise<{ Answer?: Array<{ data: string }> }>;
      };

      if (isRootDomain) {
        const [aRecords, cnameRecords] = await Promise.all([
          fetchDns(cleanDomain, 'A'),
          fetchDns(`www.${cleanDomain}`, 'CNAME')
        ]);
        const hasRootA = aRecords?.Answer?.some((record) => record.data === expectedRootIp);
        const hasWwwCname = cnameRecords?.Answer?.some((record) => record.data.replace(/\.$/, '') === expectedCname);
        setVerificationStatus(hasRootA && hasWwwCname ? 'verified' : 'pending');
      } else {
        const cnameRecords = await fetchDns(cleanDomain, 'CNAME');
        const hasCname = cnameRecords?.Answer?.some((record) => record.data.replace(/\.$/, '') === expectedCname);
        setVerificationStatus(hasCname ? 'verified' : 'pending');
      }
    } catch (err) {
      setVerificationStatus('pending');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!domain) {
      setError('Please enter a domain name');
      return;
    }

    if (!validateDomain(domain)) {
      setError('Please enter a valid domain (e.g., mystore.com or shop.mydomain.com)');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const table = role === 'seller'
        ? 'store_settings'
        : 'affiliate_store_settings';
      const idField = role === 'seller'
        ? 'seller_id'
        : 'affiliate_id';
      if (!resolvedUserId) {
        setError('Missing profile id. Please refresh and try again.');
        return;
      }

      // Clean the domain
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
      if (cleanDomain === 'beezio.co' || cleanDomain === 'www.beezio.co') {
        setError('That domain is reserved.');
        return;
      }

      // Ensure uniqueness across seller + affiliate tables (not just within one table).
      const [
        { data: sellerMatch, error: sellerCheckError },
        { data: affiliateMatch, error: affiliateCheckError }
      ] = await Promise.all([
        supabase.from('store_settings').select('seller_id').eq('custom_domain', cleanDomain).maybeSingle(),
        supabase.from('affiliate_store_settings').select('affiliate_id').eq('custom_domain', cleanDomain).maybeSingle(),
      ]);
      if (sellerCheckError && sellerCheckError.code !== 'PGRST116') throw sellerCheckError;
      if (affiliateCheckError && affiliateCheckError.code !== 'PGRST116') throw affiliateCheckError;

      if (sellerMatch?.seller_id && !(role === 'seller' && String(sellerMatch.seller_id) === String(resolvedUserId))) {
        setError('This domain is already in use by another store');
        return;
      }
      if (affiliateMatch?.affiliate_id && !(role === 'affiliate' && String(affiliateMatch.affiliate_id) === String(resolvedUserId))) {
        setError('This domain is already in use by another store');
        return;
      }

      // Use upsert so brand-new stores can claim a domain before any other settings exist.
      const { error: updateError } = await supabase
        .from(table)
        .upsert(
          {
            [idField]: resolvedUserId,
            custom_domain: cleanDomain,
            updated_at: new Date().toISOString(),
          },
          { onConflict: idField }
        );

      if (updateError) {
        if (updateError.code === '23505') {
          setError('This domain is already in use by another store');
        } else {
          setError('Failed to save domain. Please try again.');
        }
      } else {
        setDomain(cleanDomain);
        await verifyDomain(cleanDomain);
        alert('Custom domain saved! Follow the DNS setup instructions below.');
        setShowInstructions(true);
        onUpdated?.({ customDomain: cleanDomain });
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveSubdomain = async () => {
    const clean = normalizeSubdomainInput(subdomainInput);
    if (!validateSubdomain(clean)) {
      setError('Store URL must be 3-32 characters, letters/numbers/hyphen only, and not a reserved word.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const [
        { data: sellerMatch, error: sellerCheckError },
        { data: affiliateMatch, error: affiliateCheckError }
      ] = await Promise.all([
        supabase.from('store_settings').select('seller_id').eq('subdomain', clean).maybeSingle(),
        supabase.from('affiliate_store_settings').select('affiliate_id').eq('subdomain', clean).maybeSingle(),
      ]);

      if (sellerCheckError && sellerCheckError.code !== 'PGRST116') throw sellerCheckError;
      if (affiliateCheckError && affiliateCheckError.code !== 'PGRST116') throw affiliateCheckError;

      if (sellerMatch?.seller_id && !(role === 'seller' && String(sellerMatch.seller_id) === String(resolvedUserId))) {
        setError('That store URL is already taken. Please choose another.');
        setSaving(false);
        return;
      }
      if (affiliateMatch?.affiliate_id && !(role === 'affiliate' && String(affiliateMatch.affiliate_id) === String(resolvedUserId))) {
        setError('That store URL is already taken. Please choose another.');
        setSaving(false);
        return;
      }

      const table = role === 'seller'
        ? 'store_settings'
        : 'affiliate_store_settings';
      const idField = role === 'seller'
        ? 'seller_id'
        : 'affiliate_id';

      const { error: updateError } = await supabase
        .from(table)
        .upsert(
          {
            [idField]: resolvedUserId,
            subdomain: clean,
            updated_at: new Date().toISOString()
          },
          { onConflict: idField }
        );

      if (updateError) {
        setError('Failed to save store URL. Try another value.');
      } else {
        setSubdomainInput(clean);
        setError('');
        const prefix = role === 'seller' ? 'store' : 'partner';
        alert(`Store URL saved! Your new link is https://beezio.co/${prefix}/${clean}`);
        onUpdated?.({ subdomain: clean });
      }
    } catch (err) {
      console.error('Subdomain save error', err);
      setError('Failed to save store URL. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your custom domain?')) {
      return;
    }

    setSaving(true);
    try {
      const table = role === 'seller'
        ? 'store_settings'
        : 'affiliate_store_settings';
      const idField = role === 'seller'
        ? 'seller_id'
        : 'affiliate_id';

      const { error: updateError } = await supabase
        .from(table)
        .update({ custom_domain: null })
        .eq(idField, resolvedUserId);

      if (!updateError) {
        setDomain('');
        setVerificationStatus('pending');
        setShowInstructions(false);
        alert('Custom domain removed successfully');
        onUpdated?.({ customDomain: null });
      }
    } catch (err) {
      setError('Failed to remove domain');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const fallbackPath = role === 'seller'
    ? `store/${resolvedUserId || userId}`
    : `partner/${resolvedUserId || userId}`;
  const slugPrefix = 'store';
  const defaultStoreUrl = subdomainInput
    ? `https://beezio.co/${slugPrefix}/${subdomainInput}`
    : `https://beezio.co/${fallbackPath}`;
  const subdomainUrl = subdomainInput ? `https://beezio.co/${slugPrefix}/${subdomainInput}` : null;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Custom Domain</h3>
      </div>

      {/* Store URL (path-based slug) */}
      {subdomainUrl && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Your Beezio store link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded text-sm font-semibold text-purple-700">
              {subdomainUrl}
            </code>
            <button
              onClick={() => copyToClipboard(subdomainUrl)}
              className="p-2 hover:bg-purple-100 rounded transition-colors"
              title="Copy URL"
            >
              <Copy className="w-4 h-4 text-gray-600" />
            </button>
            <a
              href={subdomainUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-purple-100 rounded transition-colors"
              title="Open store"
            >
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </a>
          </div>
          <p className="text-xs text-purple-600 mt-2">
            Share this link with customers.
          </p>
        </div>
      )}

      {/* Store URL slug setup */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Store URL Slug</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={subdomainInput}
            onChange={(e) => setSubdomainInput(normalizeSubdomainInput(e.target.value))}
            placeholder="yourstore"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            disabled={slugLocked}
          />
          <button
            onClick={saveSubdomain}
            disabled={saving || slugLocked}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save URL'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Creates links like https://beezio.co/{slugPrefix}/yourstore</p>
        {slugLocked && (
          <p className="text-xs text-gray-600 mt-2">
            Store URL slugs are locked after creation. Contact support to request a change.
          </p>
        )}
      </div>

      {/* Current Store URL */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-2">Alternative Store URL:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-white border rounded text-sm text-blue-600">
            {defaultStoreUrl}
          </code>
          <button
            onClick={() => copyToClipboard(defaultStoreUrl)}
            className="p-2 hover:bg-blue-100 rounded transition-colors"
            title="Copy URL"
          >
            <Copy className="w-4 h-4 text-gray-600" />
          </button>
          <a
            href={defaultStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-blue-100 rounded transition-colors"
            title="Open store"
          >
            <ExternalLink className="w-4 h-4 text-gray-600" />
          </a>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This URL always works for your store.
        </p>
      </div>

      {/* Custom Domain Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Custom Domain (Optional)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="mystore.com or shop.mydomain.com"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {currentDomain && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        <div className="font-semibold text-gray-900 mb-2">How to connect your domain</div>
        <div className="space-y-2 break-words">
          <div>1) Save your domain here.</div>
          <div>2) In your DNS provider, add the record(s) below:</div>
          <div className="mt-2">
            <div className="font-medium text-gray-800">Root domain (example.com)</div>
            <div>A @ → 104.198.14.52</div>
            <div>CNAME www → beezio-marketplace.netlify.app</div>
          </div>
          <div className="mt-2">
            <div className="font-medium text-gray-800">Subdomain (shop.example.com)</div>
            <div>CNAME shop → beezio-marketplace.netlify.app</div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            DNS can take 5-30 minutes (up to 48 hours). Use the "Re-check now" button once it propagates.
          </div>
        </div>
      </div>

      {/* Verification Status */}
      {domain && (
        <div className="mb-6 p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {verifying ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Verifying domain...</span>
              </>
            ) : verificationStatus === 'verified' ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-600 font-medium">DNS records verified</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-600 font-medium">DNS not detected yet</span>
              </>
            )}
          </div>
          {!verifying && (
            <button
              onClick={() => verifyDomain(domain)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Re-check now
            </button>
          )}
          {!verifying && (
            <p className="text-xs text-gray-500">
              DNS must point to your store before the domain will work.
            </p>
          )}
        </div>
      )}

      {/* DNS Setup Instructions */}
      {domain && (
        <div className="border-t pt-6">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center justify-between w-full text-left font-medium text-gray-900 mb-4"
          >
            <span>DNS Setup Instructions</span>
            <svg
              className={`w-5 h-5 transition-transform ${showInstructions ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showInstructions && (
            <div className="bg-bzo-yellow-light rounded-xl p-6 space-y-6">
              <div className="flex items-start gap-3">
                <div className="bg-bzo-yellow-primary rounded-full p-2">
                  <Globe className="w-5 h-5 text-bzo-black" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-bzo-black mb-2">Connect your domain</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    This works with GoDaddy, Namecheap, Google Domains, Cloudflare, etc. You just point DNS to your store.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-bzo-yellow-primary/30 p-4 space-y-2 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">Step-by-step</div>
                <div>1) Log into your domain provider and open DNS management.</div>
                <div>2) Delete any existing A/CNAME records that conflict with your root domain or subdomain.</div>
                <div>3) Add the record(s) below and save.</div>
                <div>4) Wait for DNS to propagate (5-30 minutes, up to 48 hours).</div>
              </div>

              {/* DNS Records */}
              <div className="space-y-4">
                <div className="bg-bzo-white p-4 rounded-lg border border-bzo-yellow-primary/30">
                  <h5 className="font-medium text-bzo-black mb-2">Required DNS Records</h5>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-4 gap-2 font-medium text-gray-700 border-b pb-2">
                      <span>Type</span>
                      <span>Name</span>
                      <span>Value</span>
                      <span>TTL</span>
                    </div>
                    
                    {/* CNAME for subdomain OR A record for root domain */}
                    {domain.includes('.') && !domain.startsWith('www.') && domain.split('.').length === 2 ? (
                      // Root domain (e.g., mystore.com)
                      <>
                        <div className="grid grid-cols-4 gap-2 text-gray-800">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">A</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">@</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">104.198.14.52</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">3600</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-gray-800">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">CNAME</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">www</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">beezio-marketplace.netlify.app</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">3600</span>
                        </div>
                      </>
                    ) : (
                      // Subdomain (e.g., shop.mydomain.com)
                      <div className="grid grid-cols-4 gap-2 text-gray-800">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">CNAME</span>
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">{domain.split('.')[0]}</span>
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">beezio-marketplace.netlify.app</span>
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">3600</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Root domains use the A record. Subdomains (like shop.yourdomain.com) use the CNAME record.
                      Keep only one A record for @ and one CNAME for the same host.
                    </div>
                  </div>
                </div>

                {/* Provider-specific instructions */}
                <div className="bg-bzo-white p-4 rounded-lg border border-bzo-yellow-primary/30">
                  <h5 className="font-medium text-bzo-black mb-2">Popular DNS Providers</h5>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-700">Cloudflare:</p>
                      <p className="text-gray-600">DNS - Records - Add record</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">GoDaddy:</p>
                      <p className="text-gray-600">DNS Management - Add Record</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Namecheap:</p>
                      <p className="text-gray-600">Advanced DNS - Add New Record</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Google Domains:</p>
                      <p className="text-gray-600">DNS - Custom records</p>
                    </div>
                  </div>
                </div>

                {/* SSL Certificate info */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-green-800 mb-1">Free SSL Certificate</h5>
                      <p className="text-sm text-green-700">
                        Beezio automatically provides free SSL certificates for all custom domains. 
                        Your store will be accessible via HTTPS once DNS propagation is complete.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                      <h5 className="font-medium text-blue-800 mb-1">Propagation Time</h5>
                      <p className="text-sm text-blue-700">
                        DNS changes typically take 5-30 minutes to propagate, but can take up to 48 hours. 
                        Your domain will work once propagation is complete.
                      </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Troubleshooting */}
            <div className="bg-white rounded-lg border border-bzo-yellow-primary/30 p-4 space-y-2 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">Troubleshooting</div>
              <div>Make sure your domain is added in your DNS provider (not just in the registrar settings).</div>
              <div>Remove extra A/CNAME records that conflict with the same host (only one per host).</div>
              <div>If you set a CNAME, do not set an A record for that same host.</div>
              <div>After changes, wait for propagation and refresh this page to re-check status.</div>
            </div>

            {/* Help section */}
            <div className="border-t border-bzo-yellow-primary/30 pt-4">
              <p className="text-sm text-gray-600">
                Need help? Contact our support team with your domain name and we'll assist with the setup.
              </p>
                <a
                  href="/contact-support"
                  className="mt-2 inline-block text-sm text-bzo-yellow-primary hover:text-bzo-yellow-secondary font-medium"
                >
                  Contact Support
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Benefits */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">Why Use a Custom Domain?</h4>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>Professional branding for your store</li>
          <li>Easier to remember and share</li>
          <li>Better SEO and search visibility</li>
          <li>Builds customer trust and credibility</li>
        </ul>
      </div>
    </div>
  );
};

export default CustomDomainManager;

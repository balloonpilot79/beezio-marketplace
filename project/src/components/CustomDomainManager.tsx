import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CustomDomainManagerProps {
  userId: string;
  role: 'seller' | 'affiliate';
  currentDomain?: string;
  subdomain?: string;
}

const CustomDomainManager: React.FC<CustomDomainManagerProps> = ({ userId, role, currentDomain, subdomain }) => {
  const [domain, setDomain] = useState(currentDomain || '');
  const [subdomainInput, setSubdomainInput] = useState(subdomain || '');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (currentDomain) {
      setDomain(currentDomain);
      verifyDomain(currentDomain);
    }
  }, [currentDomain]);

  const validateSubdomain = (input: string): boolean => {
    const clean = input.trim().toLowerCase();
    return /^[a-z0-9-]{3,32}$/.test(clean);
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
      // In production, you'd verify DNS records point to your site
      // For now, just check if domain is valid format
      if (validateDomain(domainToVerify)) {
        setVerificationStatus('verified');
      } else {
        setVerificationStatus('failed');
      }
    } catch (err) {
      setVerificationStatus('failed');
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
      const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
      const idField = role === 'seller' ? 'seller_id' : 'affiliate_id';

      // Clean the domain
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

      const { error: updateError } = await supabase
        .from(table)
        .update({ custom_domain: cleanDomain })
        .eq(idField, userId);

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
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveSubdomain = async () => {
    const clean = subdomainInput.trim().toLowerCase();
    if (!validateSubdomain(clean)) {
      setError('Subdomain must be 3-32 characters, letters/numbers/hyphen only.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // ensure uniqueness across seller + affiliate tables
      const tables = ['store_settings', 'affiliate_store_settings'];
      for (const table of tables) {
        const { data: existing, error: checkError } = await supabase
          .from(table)
          .select('subdomain')
          .eq('subdomain', clean)
          .maybeSingle();
        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
        if (existing && table !== (role === 'seller' ? 'store_settings' : 'affiliate_store_settings')) {
          setError('That subdomain is already taken. Please choose another.');
          setSaving(false);
          return;
        }
      }

      const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
      const idField = role === 'seller' ? 'seller_id' : 'affiliate_id';

      const { error: updateError } = await supabase
        .from(table)
        .upsert({
          [idField]: userId,
          subdomain: clean,
          updated_at: new Date().toISOString()
        });

      if (updateError) {
        setError('Failed to save subdomain. Try another value.');
      } else {
        setSubdomainInput(clean);
        setError('');
        alert(`Subdomain saved! Your new link is https://${clean}.beezio.co or beezio.co/store/${clean}`);
      }
    } catch (err) {
      console.error('Subdomain save error', err);
      setError('Failed to save subdomain. Please try again.');
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
      const table = role === 'seller' ? 'store_settings' : 'affiliate_store_settings';
      const idField = role === 'seller' ? 'seller_id' : 'affiliate_id';

      const { error: updateError } = await supabase
        .from(table)
        .update({ custom_domain: null })
        .eq(idField, userId);

      if (!updateError) {
        setDomain('');
        setVerificationStatus('pending');
        setShowInstructions(false);
        alert('Custom domain removed successfully');
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

  const defaultStoreUrl = role === 'seller' 
    ? `https://beezio.co/store/${subdomainInput || userId}`
    : `https://beezio.co/affiliate/${subdomainInput || userId}`;
  
  const subdomainUrl = subdomainInput ? `https://${subdomainInput}.beezio.co` : null;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Custom Domain</h3>
      </div>

      {/* Subdomain URL (auto-generated from email) */}
      {subdomainUrl && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Your Beezio subdomain</p>
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
            Share this link with customers. You can also use the path link below.
          </p>
        </div>
      )}

      {/* Beezio subdomain setup */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Beezio Subdomain</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={subdomainInput}
            onChange={(e) => setSubdomainInput(e.target.value.toLowerCase())}
            placeholder="yourstore"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={saveSubdomain}
            disabled={saving}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Subdomain'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Creates links like https://yourstore.beezio.co and beezio.co/store/yourstore</p>
      </div>

      {/* Current Store URL (fallback path) */}
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
          This URL also works, but the subdomain above is shorter and more professional.
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
                <span className="text-sm text-green-600 font-medium">Domain format valid</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-600 font-medium">DNS configuration pending</span>
              </>
            )}
          </div>
          {!verifying && (
            <p className="text-xs text-gray-500">
              Configure your domain's DNS settings to point to Beezio for it to work.
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
                  <h4 className="font-semibold text-bzo-black mb-2">DNS Configuration for {domain}</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    To use your custom domain with Beezio, configure these DNS records with your domain provider:
                  </p>
                </div>
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
                  </div>
                </div>

                {/* Provider-specific instructions */}
                <div className="bg-bzo-white p-4 rounded-lg border border-bzo-yellow-primary/30">
                  <h5 className="font-medium text-bzo-black mb-2">Popular DNS Providers</h5>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-700">Cloudflare:</p>
                      <p className="text-gray-600">DNS → Records → Add record</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">GoDaddy:</p>
                      <p className="text-gray-600">DNS Management → Add Record</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Namecheap:</p>
                      <p className="text-gray-600">Advanced DNS → Add New Record</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Google Domains:</p>
                      <p className="text-gray-600">DNS → Custom records</p>
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

              {/* Help section */}
              <div className="border-t border-bzo-yellow-primary/30 pt-4">
                <p className="text-sm text-gray-600">
                  Need help? Contact our support team with your domain name and we'll assist with the setup.
                </p>
                <button className="mt-2 text-sm text-bzo-yellow-primary hover:text-bzo-yellow-secondary font-medium">
                  Contact Support →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Benefits */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">Why Use a Custom Domain?</h4>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>✅ Professional branding for your store</li>
          <li>✅ Easier to remember and share</li>
          <li>✅ Better SEO and search visibility</li>
          <li>✅ Builds customer trust and credibility</li>
        </ul>
      </div>
    </div>
  );
};

export default CustomDomainManager;

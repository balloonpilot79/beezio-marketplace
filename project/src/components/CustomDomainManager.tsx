import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CustomDomainManagerProps {
  userId: string;
  role: 'seller' | 'affiliate';
  currentDomain?: string;
}

const CustomDomainManager: React.FC<CustomDomainManagerProps> = ({ userId, role, currentDomain }) => {
  const [domain, setDomain] = useState(currentDomain || '');
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

  const validateDomain = (input: string): boolean => {
    // Remove protocol if present
    let cleanDomain = input.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
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
    ? `https://beezio.co/seller/${userId}`
    : `https://beezio.co/affiliate/${userId}`;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-6 h-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Custom Domain</h3>
      </div>

      {/* Current Store URL */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-2">Your Default Store URL:</p>
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
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Step 1: Access Your Domain Provider</h4>
                <p className="text-sm text-gray-600">
                  Log in to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Step 2: Add DNS Records</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Add the following DNS records:
                </p>
                
                <div className="bg-white border rounded p-3 mb-2">
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500 mb-2">
                    <div>Type</div>
                    <div>Name</div>
                    <div>Value</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="font-mono">CNAME</div>
                    <div className="font-mono">{domain.includes('.') ? domain.split('.')[0] : '@'}</div>
                    <div className="font-mono text-blue-600">beezio-marketplace.netlify.app</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Step 3: Wait for DNS Propagation</h4>
                <p className="text-sm text-gray-600">
                  DNS changes can take 5-48 hours to fully propagate. Your custom domain will be active once DNS is configured correctly.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Contact support at support@beezio.co if you need help setting up your custom domain.
                </p>
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

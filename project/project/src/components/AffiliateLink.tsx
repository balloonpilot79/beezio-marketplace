import React, { useState } from 'react';
import { Copy, ExternalLink, TrendingUp, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';


interface AffiliateLinkProps {
  productId?: string;
  commissionRate?: number;
  commissionType?: 'percentage' | 'flat_rate';
  flatCommissionAmount?: number;
  price?: number;
  siteWide?: boolean;
}

const AffiliateLink: React.FC<AffiliateLinkProps> = ({
  productId,
  commissionRate,
  commissionType,
  flatCommissionAmount,
  price,
  siteWide = false
}) => {
  const { user, profile } = useAuth();
  const [affiliateLink, setAffiliateLink] = useState<string>('');
  const [linkCode, setLinkCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAffiliateLink = async () => {
    if (!user || !profile) {
      setError('Please sign in to generate affiliate links');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let code = '';
      let fullLink = '';

      if (siteWide) {
        // Site-wide affiliate link
        // Check if site-wide link exists
        const { data: existingLink } = await supabase
          .from('affiliate_links')
          .select('link_code')
          .eq('affiliate_id', profile.id)
          .eq('product_id', null)
          .single();

        if (existingLink) {
          code = existingLink.link_code;
        } else {
          code = `${profile.id.slice(0, 8)}-site-${Date.now().toString(36)}`;
          const { error: insertError } = await supabase
            .from('affiliate_links')
            .insert({
              affiliate_id: profile.id,
              product_id: null,
              link_code: code,
              clicks_count: 0,
              conversions_count: 0
            });
          if (insertError) throw insertError;
        }
        fullLink = `${window.location.origin}/?ref=${profile.id}&code=${encodeURIComponent(code)}`;
      } else if (productId) {
        // Product-specific affiliate link
        const { data: existingLink } = await supabase
          .from('affiliate_links')
          .select('link_code')
          .eq('affiliate_id', profile.id)
          .eq('product_id', productId)
          .single();

        if (existingLink) {
          code = existingLink.link_code;
        } else {
          code = `${profile.id.slice(0, 8)}-${productId.slice(0, 8)}-${Date.now().toString(36)}`;
          const { error: insertError } = await supabase
            .from('affiliate_links')
            .insert({
              affiliate_id: profile.id,
              product_id: productId,
              link_code: code,
              clicks_count: 0,
              conversions_count: 0
            });
          if (insertError) throw insertError;
        }
        fullLink = `${window.location.origin}/product/${productId}?ref=${profile.id}&code=${encodeURIComponent(code)}`;
      } else {
        throw new Error('No productId or siteWide specified');
      }

      setAffiliateLink(fullLink);
      setLinkCode(code);
    } catch (err: any) {
      console.error('Error generating affiliate link:', err);
      setError(err.message || 'Failed to generate affiliate link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const calculateEarnings = () => {
    if (siteWide) return 0;
    if (commissionType === 'flat_rate') {
      return flatCommissionAmount || 0;
    }
    return (price && commissionRate) ? (price * commissionRate) / 100 : 0;
  };

  const openProductPage = () => {
    if (affiliateLink) {
      window.open(affiliateLink, '_blank');
    }
  };

  if (!user) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-amber-800 text-sm text-center">
          Sign in to generate your affiliate link and start earning commissions
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-6 space-y-6 shadow-xl max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-orange-600" />
          <span className="text-xl font-extrabold text-orange-800 tracking-tight">Affiliate Opportunity</span>
        </div>
        {!siteWide && (
          <div className="text-right">
            <div className="text-sm text-orange-600">Earn per sale:</div>
            <div className="text-2xl font-bold text-orange-800">
              {commissionType === 'flat_rate' 
                ? `$${calculateEarnings().toFixed(2)}` 
                : `${commissionRate}% ($${calculateEarnings().toFixed(2)})`
              }
            </div>
          </div>
        )}
        {siteWide && (
          <div className="text-right">
            <div className="text-sm text-orange-600 font-semibold">Earn commission on any product you share!</div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl text-base font-medium">
          {error}
        </div>
      )}

      {!affiliateLink ? (
        <button
          onClick={generateAffiliateLink}
          disabled={loading}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow disabled:opacity-60 flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Generating Link...</span>
            </>
          ) : (
            <>
              <TrendingUp className="h-5 w-5" />
              <span>Generate Affiliate Link</span>
            </>
          )}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-1 font-semibold">Your Affiliate Link:</div>
              <div className="text-sm text-gray-800 break-all font-mono bg-gray-50 p-2 rounded">
                {affiliateLink}
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={copyToClipboard}
              className="flex-1 bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center space-x-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            
            <button
              onClick={openProductPage}
              className="flex-1 bg-primary-500 text-white py-2 px-4 rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Preview</span>
            </button>
          </div>
          
          <div className="text-xs text-gray-600 text-center">
            Link Code: <span className="font-mono">{linkCode}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateLink;

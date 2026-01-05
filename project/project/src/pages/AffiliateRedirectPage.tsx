import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AffiliateRedirectPage: React.FC = () => {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!code) {
        navigate('/', { replace: true });
        return;
      }

      try {
        let data: any = null;
        let error: any = null;

        // Prefer link_code (current schema)
        ({ data, error } = await supabase
          .from('affiliate_links')
          .select('*')
          .eq('link_code', code)
          .maybeSingle());

        // Fallback: legacy schemas used referral_code
        if (!data) {
          ({ data, error } = await supabase
            .from('affiliate_links')
            .select('*')
            .eq('referral_code', code)
            .maybeSingle());
        }

        if (!mounted) return;

        if (error) {
          console.warn('[AffiliateRedirectPage] lookup failed (non-fatal):', error);
        }

        const affiliateId = (data as any)?.affiliate_id ? String((data as any).affiliate_id) : null;
        const productId = (data as any)?.product_id ? String((data as any).product_id) : null;
        const fullUrl = (data as any)?.full_url ? String((data as any).full_url) : null;

        // Prefer a persisted full_url.
        if (fullUrl && fullUrl.startsWith('http')) {
          window.location.assign(fullUrl);
          return;
        }

        // Fallback: build a canonical attribution URL.
        const origin = window.location.origin;
        const target = productId
          ? `${origin}/product/${productId}?ref=${encodeURIComponent(affiliateId || '')}&code=${encodeURIComponent(code)}`
          : `${origin}/?ref=${encodeURIComponent(affiliateId || '')}&code=${encodeURIComponent(code)}`;

        // If we don't have an affiliate id, just go home.
        if (!affiliateId) {
          navigate('/', { replace: true });
          return;
        }

        window.location.assign(target);
      } catch (e) {
        console.warn('[AffiliateRedirectPage] redirect failed:', e);
        if (mounted) navigate('/', { replace: true });
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [code, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
        <div className="text-lg font-semibold text-gray-900">Redirecting…</div>
        <div className="mt-2 text-sm text-gray-600">Taking you to the shared product page.</div>
      </div>
    </div>
  );
};

export default AffiliateRedirectPage;

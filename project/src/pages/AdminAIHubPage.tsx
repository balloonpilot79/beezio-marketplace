import React from 'react';
import { ShieldCheck, Sparkles, Wand2, Bot, MessageSquare, Zap, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';

const AdminAIHubPage: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1026] via-[#0f1735] to-[#0b132b] text-white py-12 px-4 sm:px-6 lg:px-10">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
            <Sparkles className="w-8 h-8 text-[#f6d243]" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#f6d243] font-semibold">Beezio Admin</p>
            <h1 className="text-3xl sm:text-4xl font-black">AI Hub — platform-only tools</h1>
            <p className="text-white/80 mt-2 max-w-3xl">
              Central place for platform pricing, product generation, support answers, and affiliate content. Uses the GPT proxy (server-side) and the Beezio pricing helper.
            </p>
            {profile?.email && (
              <p className="text-xs text-white/60 mt-1">Signed in as {profile.email}</p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="w-6 h-6 text-[#f6d243]" />
              <div>
                <h2 className="text-xl font-semibold">Pricing Assistant</h2>
                <p className="text-sm text-white/70">Deterministic helper that adds markup, affiliate %, platform share, referrer, and Stripe 2.9% + $0.60.</p>
              </div>
            </div>
            <div className="text-sm text-white/70">
              Hook up to `src/utils/beezioPlatformPricing.ts` in your forms. This card is a placeholder; wire to GPT proxy mode `pricing_assistant` when ready.
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <Wand2 className="w-6 h-6 text-[#f6d243]" />
              <div>
                <h2 className="text-xl font-semibold">Product Builder</h2>
                <p className="text-sm text-white/70">Vendor-agnostic import + GPT copy + pricing breakdown.</p>
              </div>
            </div>
            <div className="text-sm text-white/70">
              Calls the Netlify function `product-builder` (supplier adapter + GPT copy). Add UI here to submit supplier key and product ID/SKU when ready.
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <Bot className="w-6 h-6 text-[#f6d243]" />
              <div>
                <h2 className="text-xl font-semibold">Support Bot</h2>
                <p className="text-sm text-white/70">FAQ + commissions + payouts answers.</p>
              </div>
            </div>
            <div className="text-sm text-white/70">
              Use GPT proxy mode `support_bot`. For now this is a placeholder; connect your chat widget here for admin preview.
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-6 h-6 text-[#f6d243]" />
              <div>
                <h2 className="text-xl font-semibold">Affiliate Content</h2>
                <p className="text-sm text-white/70">Captions, hashtags, and pitches for campaigns.</p>
              </div>
            </div>
            <div className="text-sm text-white/70">
              Use GPT proxy mode `affiliate_content` with product details. Placeholder until wired to product lookup.
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="w-6 h-6 text-[#f6d243]" />
              <div>
                <h2 className="text-xl font-semibold">Ordering Hooks (preview)</h2>
                <p className="text-sm text-white/70">Supplier mapping + post-checkout ordering.</p>
              </div>
            </div>
            <div className="text-sm text-white/70">
              Products should save `api_integration` with supplier id/sku/cost. Webhooks can call `getSupplierAdapter` and `createOrder` after Stripe success.
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-6 h-6 text-[#f6d243]" />
              <div>
                <h2 className="text-xl font-semibold">Future Seller/Store Helpers</h2>
                <p className="text-sm text-white/70">Store creation, seller copy, product ideas.</p>
              </div>
            </div>
            <div className="text-sm text-white/70">
              Reserve GPT proxy modes `seller_product_helper` and `store_creation_helper` for later. Add UI here once ready.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAIHubPage;

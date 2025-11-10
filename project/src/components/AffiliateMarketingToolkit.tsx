import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Download, ExternalLink, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  commission_rate: number;
}

interface AffiliateLink {
  id: string;
  product_id: string;
  referral_code: string;
  clicks: number;
  conversions: number;
  total_sales: number;
  total_commission: number;
}

export default function AffiliateMarketingToolkit() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      loadAffiliateProducts();
    }
  }, [profile]);

  const loadAffiliateProducts = async () => {
    if (!profile) return;

    try {
      // Get products affiliate has added to their store
      const { data: affiliateProducts, error: apError } = await supabase
        .from('affiliate_products')
        .select('product_id')
        .eq('affiliate_id', profile.id);

      if (apError) throw apError;

      const productIds = affiliateProducts?.map(ap => ap.product_id) || [];

      if (productIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get product details
      const { data: productsData, error: pError} = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (pError) throw pError;

      // Get affiliate links
      const { data: linksData, error: lError } = await supabase
        .from('affiliate_links')
        .select('*')
        .eq('affiliate_id', profile.id);

      if (lError) throw lError;

      setProducts(productsData || []);
      setAffiliateLinks(linksData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading affiliate products:', error);
      setLoading(false);
    }
  };

  const getAffiliateLink = (productId: string): string => {
    const link = affiliateLinks.find(l => l.product_id === productId);
    if (!link) return '';
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/product/${productId}?ref=${link.referral_code}`;
  };

  const getStoreLink = (): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/affiliate-store/${profile?.id}`;
  };

  const copyToClipboard = async (text: string, code: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadQRCode = (productId: string, productName: string) => {
    const canvas = document.getElementById(`qr-${productId}`);
    if (!canvas) return;

    const svg = canvas.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${productName.replace(/\s+/g, '-')}.svg`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const shareProduct = async (product: Product) => {
    const affiliateLink = getAffiliateLink(product.id);
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} - $${product.price}`,
      url: affiliateLink
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      copyToClipboard(affiliateLink, product.id);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading your marketing tools...</div>;
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Share2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
        <p className="text-gray-600">
          Add products from the marketplace to start generating affiliate links!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Store-Wide Link */}
      <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-400 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          Your Affiliate Store Link
        </h3>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={getStoreLink()}
            readOnly
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white"
          />
          <button
            onClick={() => copyToClipboard(getStoreLink(), 'store')}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copiedCode === 'store' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Share this link to promote all your products at once!
        </p>

        {/* Store QR Code */}
        <div className="mt-4 flex items-start gap-4">
          <div className="bg-white p-3 rounded-lg border-2 border-gray-200" id="qr-store">
            <QRCodeSVG value={getStoreLink()} size={128} />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-2">Store QR Code</h4>
            <p className="text-sm text-gray-600 mb-3">
              Download and use this QR code on business cards, flyers, or social media posts.
            </p>
            <button
              onClick={() => downloadQRCode('store', 'affiliate-store')}
              className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-900 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download QR
            </button>
          </div>
        </div>
      </div>

      {/* Individual Product Links */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Product-Specific Links</h3>
        <div className="grid gap-6">
          {products.map(product => {
            const affiliateLink = getAffiliateLink(product.id);
            const linkData = affiliateLinks.find(l => l.product_id === product.id);

            return (
              <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex gap-6">
                  {/* Product Image */}
                  <img
                    src={product.images?.[0] || '/placeholder.png'}
                    alt={product.name}
                    className="w-24 h-24 object-cover rounded-lg"
                  />

                  {/* Product Info & Links */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{product.name}</h4>
                      <p className="text-sm text-gray-600">
                        ${product.price} • {product.commission_rate}% commission
                      </p>
                    </div>

                    {/* Affiliate Link */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Affiliate Link
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={affiliateLink}
                          readOnly
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50"
                        />
                        <button
                          onClick={() => copyToClipboard(affiliateLink, product.id)}
                          className="px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm"
                        >
                          {copiedCode === product.id ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => shareProduct(product)}
                          className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    {linkData && (
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-gray-600">Clicks:</span>
                          <span className="ml-2 font-semibold text-gray-900">{linkData.clicks}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Sales:</span>
                          <span className="ml-2 font-semibold text-gray-900">{linkData.conversions}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Earned:</span>
                          <span className="ml-2 font-semibold text-green-600">
                            ${linkData.total_commission.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-white p-2 border-2 border-gray-200 rounded-lg" id={`qr-${product.id}`}>
                      <QRCodeSVG value={affiliateLink} size={100} />
                    </div>
                    <button
                      onClick={() => downloadQRCode(product.id, product.name)}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      QR
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

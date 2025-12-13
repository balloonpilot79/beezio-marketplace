import React, { useState, useEffect, useRef } from 'react';
import { Link as LinkIcon, QrCode, Copy, Download, Check, ExternalLink, TrendingUp, Eye, DollarSign, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import QRCodeStyling from 'qr-code-styling';

interface AffiliateLinkGeneratorProps {
  affiliateId: string;
}

interface AffiliateLink {
  id: string;
  product_id: string;
  link_code: string;
  custom_name: string;
  link_url: string;
  clicks: number;
  conversions: number;
  revenue_generated: number;
  is_active: boolean;
  created_at: string;
  product?: any;
}

const AffiliateLinkGenerator: React.FC<AffiliateLinkGeneratorProps> = ({ affiliateId }) => {
  const { profile } = useAuth();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedLinkForQR, setSelectedLinkForQR] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCodeRef = useRef<any>(null);

  useEffect(() => {
    loadData();
  }, [affiliateId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load affiliate's products
      const { data: productsData, error: productsError } = await supabase
        .from('affiliate_products')
        .select(`
          product_id,
          products (
            id,
            title,
            price,
            images,
            seller_id
          )
        `)
        .eq('affiliate_id', affiliateId);

      if (productsError) throw productsError;
      
      const productList = productsData?.map(ap => ap.products).filter(Boolean) || [];
      setProducts(productList);

      // Load existing affiliate links
      const { data: linksData, error: linksError } = await supabase
        .from('affiliate_links')
        .select('*')
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      if (linksError) throw linksError;

      // Enrich links with product data
      const enrichedLinks = await Promise.all((linksData || []).map(async (link) => {
        if (link.product_id) {
          const { data: productData } = await supabase
            .from('products')
            .select('id, title, price, images')
            .eq('id', link.product_id)
            .single();
          
          return { ...link, product: productData };
        }
        return link;
      }));

      setLinks(enrichedLinks);
    } catch (error) {
      console.error('Error loading affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    setGenerating(true);
    try {
      // Generate unique code
      const linkCode = generateRandomCode();
      const baseUrl = window.location.origin;
      const linkUrl = `${baseUrl}/af/${linkCode}`;

      const { data, error } = await supabase
        .from('affiliate_links')
        .insert({
          affiliate_id: affiliateId,
          product_id: selectedProduct,
          link_code: linkCode,
          custom_name: customName || `Link for ${products.find(p => p.id === selectedProduct)?.title}`,
          link_url: linkUrl,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Reload links
      await loadData();
      
      // Reset form
      setSelectedProduct('');
      setCustomName('');
      
      alert('✅ Link generated successfully!');
    } catch (error: any) {
      console.error('Error generating link:', error);
      alert(`Failed to generate link: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const copyToClipboard = async (text: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const generateQRCode = (link: AffiliateLink) => {
    setSelectedLinkForQR(link.id);
    
    setTimeout(() => {
      if (qrRef.current) {
        qrRef.current.innerHTML = '';
        
        qrCodeRef.current = new QRCodeStyling({
          width: 300,
          height: 300,
          data: link.link_url,
          margin: 10,
          qrOptions: {
            typeNumber: 0,
            mode: 'Byte',
            errorCorrectionLevel: 'H'
          },
          imageOptions: {
            hideBackgroundDots: true,
            imageSize: 0.4,
            margin: 5
          },
          dotsOptions: {
            color: '#6366f1',
            type: 'rounded'
          },
          backgroundOptions: {
            color: '#ffffff'
          },
          cornersSquareOptions: {
            color: '#4f46e5',
            type: 'extra-rounded'
          },
          cornersDotOptions: {
            color: '#4f46e5',
            type: 'dot'
          }
        });

        qrCodeRef.current.append(qrRef.current);
      }
    }, 100);
  };

  const downloadQRCode = () => {
    if (qrCodeRef.current) {
      qrCodeRef.current.download({
        name: `affiliate-qr-${selectedLinkForQR}`,
        extension: 'png'
      });
    }
  };

  const toggleLinkStatus = async (linkId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('affiliate_links')
        .update({ is_active: !currentStatus })
        .eq('id', linkId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error toggling link status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
            <LinkIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Affiliate Links & QR Codes</h2>
            <p className="text-blue-100">Generate custom links to promote products anywhere</p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{links.length}</div>
            <div className="text-sm text-blue-100">Active Links</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">{links.reduce((sum, l) => sum + l.clicks, 0)}</div>
            <div className="text-sm text-blue-100">Total Clicks</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-2xl font-bold">${links.reduce((sum, l) => sum + Number(l.revenue_generated || 0), 0).toFixed(2)}</div>
            <div className="text-sm text-blue-100">Revenue</div>
          </div>
        </div>
      </div>

      {/* Generate New Link */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded-lg">
            <RefreshCw className="w-5 h-5 text-blue-600" />
          </div>
          Generate New Link
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a product...</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.title} - ${product.price}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Name (Optional)
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g., Instagram Summer Promo"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={generateLink}
            disabled={generating || !selectedProduct}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating...
              </>
            ) : (
              <>
                <LinkIcon className="w-5 h-5" />
                Generate Link
              </>
            )}
          </button>
        </div>
      </div>

      {/* Links List */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Your Links</h3>
        
        {links.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <LinkIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No links yet</h4>
            <p className="text-gray-600">Generate your first affiliate link to start promoting products</p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map(link => (
              <div key={link.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-gray-900">{link.custom_name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        link.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {link.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {link.product && (
                      <p className="text-sm text-gray-600 mb-3">
                        Product: <span className="font-semibold">{link.product.title}</span>
                      </p>
                    )}
                    
                    <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm break-all mb-3">
                      {link.link_url}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(link.link_url, link.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-semibold"
                      >
                        {copiedId === link.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => generateQRCode(link)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-semibold"
                      >
                        <QrCode className="w-4 h-4" />
                        Generate QR Code
                      </button>

                      <button
                        onClick={() => toggleLinkStatus(link.id, link.is_active)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-semibold"
                      >
                        {link.is_active ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  <div className="text-right ml-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          Clicks
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{link.clicks}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          Sales
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{link.conversions}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          Revenue
                        </div>
                        <div className="text-2xl font-bold text-green-600">${Number(link.revenue_generated || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {selectedLinkForQR && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">QR Code</h3>
              <button
                onClick={() => setSelectedLinkForQR(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <div ref={qrRef} className="flex justify-center mb-4 bg-gray-50 rounded-lg p-4"></div>

            <div className="flex gap-3">
              <button
                onClick={downloadQRCode}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download QR Code
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Print this QR code on flyers, business cards, or share digitally
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateLinkGenerator;

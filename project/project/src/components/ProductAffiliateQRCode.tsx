import React, { useRef } from 'react';
// import SimpleQRCode from './SimpleQRCode';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  videos: string[];
  description?: string;
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  seller_id: string;
  profiles?: {
    full_name: string;
    location?: string;
  };
  shipping_cost?: number;
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
}

interface ProductAffiliateQRCodeProps {
  product: Product;
  profile: any;
}

const ProductAffiliateQRCode: React.FC<ProductAffiliateQRCodeProps> = ({ product, profile }) => {
  const qrRef = useRef<HTMLDivElement>(null);
  // Avoid SSR/undefined window
  const [origin, setOrigin] = React.useState('');
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);
  const qrValue = origin
    ? `${origin}/product/${product.id}${profile?.id ? `?ref=${profile.id}` : ''}`
    : '';

  const handleDownload = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `affiliate-product-${product.id}-qr.png`;
      link.click();
    }
  };

  return (
    <div className="flex items-center space-x-2 mt-2">
      <div ref={qrRef}>
        <div className="w-16 h-16 bg-gray-200 border border-gray-300 flex items-center justify-center text-xs text-gray-500">QR Disabled</div>
      </div>
      <button
        className="ml-2 px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600"
        onClick={handleDownload}
        id={`download-qr-product-${product.id}`}
        disabled={!qrValue}
      >
        Download QR
      </button>
    </div>
  );
};

export default ProductAffiliateQRCode;

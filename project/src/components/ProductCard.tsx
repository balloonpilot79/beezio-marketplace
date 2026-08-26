import React from 'react';
import { useLocation } from 'react-router-dom';
import ProductCardCanonical from '../../../project/project/src/components/ProductCardCanonical';
import ProductPromoterCountBadge from './ProductPromoterCountBadge';

interface ProductCardProps {
  product: any;
  viewMode: 'grid' | 'list';
  affiliateRef?: string | null;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, affiliateRef }) => {
  const location = useLocation();
  const affiliateUid = new URLSearchParams(location.search).get('uid');

  return (
    <div className="relative">
      <ProductCardCanonical
        product={product}
        viewMode={viewMode}
        affiliateRef={affiliateRef}
        affiliateUid={affiliateUid}
      />
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <ProductPromoterCountBadge productId={String(product?.id || '')} />
      </div>
    </div>
  );
};

export default ProductCard;

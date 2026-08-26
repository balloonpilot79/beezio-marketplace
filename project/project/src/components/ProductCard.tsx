import React from 'react';
import { useLocation } from 'react-router-dom';
import ProductCardCanonical from './ProductCardCanonical';
import ProductPromoterCountBadge from './ProductPromoterCountBadge';
import type { CanonicalProductCardProduct } from './ProductCardCanonical';

interface ProductCardProps {
  product: CanonicalProductCardProduct;
  viewMode: 'grid' | 'list';
  affiliateRef?: string | null;
  affiliateUid?: string | null;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, affiliateRef, affiliateUid }) => {
  const location = useLocation();
  const uid = affiliateUid ?? new URLSearchParams(location.search).get('uid');

  return (
    <div className="relative">
      <ProductCardCanonical
        product={product}
        viewMode={viewMode}
        affiliateRef={affiliateRef}
        affiliateUid={uid}
      />
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <ProductPromoterCountBadge productId={String(product?.id || '')} />
      </div>
    </div>
  );
};

export default ProductCard;

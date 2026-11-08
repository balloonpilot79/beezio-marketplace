import { isPublicStoreProduct } from '../../shared/publicProductVisibility';
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
  compact?: boolean;
  businessView?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, affiliateRef, affiliateUid, compact = false, businessView = false }) => {
  const location = useLocation();
  const uid = affiliateUid ?? new URLSearchParams(location.search).get('uid');

  if (!isPublicStoreProduct(product)) return null;

  return (
    <div className="relative">
      <ProductCardCanonical
        product={product}
        viewMode={viewMode}
        affiliateRef={affiliateRef}
        affiliateUid={uid}
        compact={compact}
        businessView={businessView}
        promoterBadge={<ProductPromoterCountBadge productId={String(product?.id || '')} />}
      />
    </div>
  );
};

export default ProductCard;

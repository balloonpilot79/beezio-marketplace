import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { resolveProductImage } from '../../utils/imageHelpers';
import { getProductIdentifierLines } from '../../utils/productIdentifiers';

export interface ProductCardProps {
  id?: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  sellerName?: string;
  href?: string;
  sku?: string | null;
  cj_product_sku?: string | null;
  cj_spu?: string | null;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  title,
  price,
  imageUrl,
  sellerName,
  href,
  sku,
  cj_product_sku,
  cj_spu,
}) => {
  const fallbackSeed = id || title;
  const resolvedImage = useMemo(
    () => resolveProductImage(imageUrl ?? undefined, fallbackSeed),
    [imageUrl, fallbackSeed],
  );
  const fallbackImage = useMemo(
    () => resolveProductImage(undefined, fallbackSeed),
    [fallbackSeed],
  );
  const [currentImage, setCurrentImage] = useState(resolvedImage);
  const identifierLines = getProductIdentifierLines({ sku, cj_product_sku, cj_spu });

  useEffect(() => {
    setCurrentImage(resolvedImage);
  }, [resolvedImage]);

  const handleImageError = useCallback(() => {
    setCurrentImage(fallbackImage);
  }, [fallbackImage]);

  const content = (
    <Card className="h-full hover:-translate-y-1 transition-transform">
      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-bz-surfaceAlt mb-4">
        <img
          src={currentImage}
          alt={title}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-bz-text line-clamp-2">{title}</p>
        </div>
        {identifierLines.length > 0 && (
          <div className="space-y-1">
            {identifierLines.map((line) => (
              <p key={line} className="text-[11px] font-medium text-amber-700">
                {line}
              </p>
            ))}
          </div>
        )}
        {sellerName && <p className="text-xs text-bz-muted">by {sellerName}</p>}
        <p className="text-lg font-semibold text-bz-text">${price.toFixed(2)}</p>
      </div>
    </Card>
  );

  if (href || id) {
    return (
      <Link to={href || `/product/${id}`} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
};

export default ProductCard;

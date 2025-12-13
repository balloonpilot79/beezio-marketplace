import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import Badge from '../ui/Badge';
import { resolveProductImage } from '../../utils/imageHelpers';

export interface ProductCardProps {
  id?: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  sellerName?: string;
  isFundraiser?: boolean;
  href?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  title,
  price,
  imageUrl,
  sellerName,
  isFundraiser,
  href,
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
          {isFundraiser && <Badge variant="info">Fundraiser</Badge>}
        </div>
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

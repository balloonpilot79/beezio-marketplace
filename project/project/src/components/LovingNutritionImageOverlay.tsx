import React from 'react';

type ProductLike = {
  source_platform?: string | null;
  dropship_provider?: string | null;
  source?: string | null;
  inventory_source?: string | null;
  lineage?: string | null;
  profiles?: { full_name?: string | null } | null;
};

type Props = {
  product?: ProductLike | null;
  compact?: boolean;
  thumbnail?: boolean;
};

const text = (value: unknown) => String(value ?? '').trim().toLowerCase();

export function isLovingNutritionProduct(product?: ProductLike | null): boolean {
  if (!product) return false;
  const identity = [
    product.source_platform,
    product.dropship_provider,
    product.source,
    product.inventory_source,
    product.lineage,
    product.profiles?.full_name,
  ]
    .map(text)
    .filter(Boolean)
    .join(' ');

  return identity.includes('supliful') || identity.includes('loving nutrition');
}

const LovingNutritionImageOverlay: React.FC<Props> = ({ product, compact = false, thumbnail = false }) => {
  if (!isLovingNutritionProduct(product)) return null;

  const sizeClass = thumbnail
    ? 'w-[58%] p-0.5 rounded-[4px]'
    : compact
      ? 'w-[52%] p-1 sm:p-1.5 rounded-md'
      : 'w-[46%] max-w-[240px] p-2 sm:p-3 rounded-xl';

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-[52%] z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-white bg-white shadow-md ${sizeClass}`}
      aria-hidden="true"
    >
      <img
        src="/loving-nutrition-logo.png"
        alt=""
        className="block h-auto w-full object-contain"
        draggable={false}
        loading="eager"
      />
    </div>
  );
};

export default LovingNutritionImageOverlay;

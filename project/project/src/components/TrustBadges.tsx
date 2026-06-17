import React from 'react';
import { Lock, RefreshCw, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  className?: string;
  compact?: boolean;
  termsHref?: string | null;
  termsLabel?: string;
};

export default function TrustBadges({
  className,
  compact,
  termsHref = '/terms',
  termsLabel = 'Refunds & terms',
}: Props) {
  return (
    <div className={className || ''}>
      <div className={`flex flex-wrap items-center gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
        <div className="flex items-center gap-2 text-gray-700">
          <Lock className="w-4 h-4 text-green-600" />
          <span className="font-medium">Secure checkout</span>
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <Truck className="w-4 h-4 text-gray-700" />
          <span>Shipping shown at checkout</span>
        </div>
        {termsHref && (
          <div className="flex items-center gap-2 text-gray-700">
            <RefreshCw className="w-4 h-4 text-gray-700" />
            <Link to={termsHref} className="underline underline-offset-2 hover:text-gray-900">
              {termsLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

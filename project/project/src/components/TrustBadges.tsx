import React from 'react';
import { Lock, RefreshCw, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  className?: string;
  compact?: boolean;
};

export default function TrustBadges({ className, compact }: Props) {
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
        <div className="flex items-center gap-2 text-gray-700">
          <RefreshCw className="w-4 h-4 text-gray-700" />
          <Link to="/terms" className="underline underline-offset-2 hover:text-gray-900">
            Refunds & terms
          </Link>
        </div>
      </div>
    </div>
  );
}


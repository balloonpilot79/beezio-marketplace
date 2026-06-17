import React, { useMemo } from 'react';
import { Gift } from 'lucide-react';

type BuyerRewardsProps = {
  productPrice: number;
  commissionRate: number;
};

const BuyerRewards: React.FC<BuyerRewardsProps> = ({ productPrice, commissionRate }) => {
  const rewardText = useMemo(() => {
    const price = Number(productPrice);
    const commission = Number(commissionRate);
    if (!Number.isFinite(price) || price <= 0) return 'Earn rewards on this purchase.';
    if (!Number.isFinite(commission) || commission <= 0) return 'Earn rewards on this purchase.';
    return `Earn rewards and support creators — this item includes a ${commission}% creator commission.`;
  }, [commissionRate, productPrice]);

  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="bg-amber-100 p-2 rounded-full">
          <Gift className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-amber-900">Buyer Rewards</div>
          <div className="text-sm text-amber-800 mt-1">{rewardText}</div>
          <div className="text-xs text-amber-700 mt-2">
            Rewards and discounts can change over time and may vary by store.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerRewards;

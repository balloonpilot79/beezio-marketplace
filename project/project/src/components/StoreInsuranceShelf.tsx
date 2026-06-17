import React from 'react';

type InsuranceListing = {
  id: string;
  slug: string;
  agency_name: string;
  bio: string;
  hero_subtitle?: string;
  verticals: string[];
  states_served: string[];
  lead_price: number;
  affiliate_payout: number;
  is_local_match?: boolean;
  lead_delivery_enabled?: boolean;
  promotable_by_affiliates?: boolean;
  activation_label?: string;
  agency_profile?: {
    response_time?: string;
    trust_points?: string[];
  };
};

const StoreInsuranceShelf: React.FC<{
  listings: InsuranceListing[];
  storeLabel: string;
  ownerState?: string | null;
}> = () => null;

export default StoreInsuranceShelf;

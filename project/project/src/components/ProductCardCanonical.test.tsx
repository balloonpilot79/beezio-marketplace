import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CanonicalProductCard from './ProductCardCanonical';

const account = vi.hoisted(() => ({ role: 'buyer' }));
vi.mock('../contexts/AuthContextMultiRole', () => ({
  useAuth: () => ({
    user: { id: 'account-id' },
    currentRole: account.role,
    hasRole: (role: string) => role === account.role,
  }),
}));
vi.mock('../contexts/CartContext', () => ({ useCart: () => ({ addToCart: vi.fn() }) }));
vi.mock('../lib/supabase', () => ({ supabase: {}, supabaseUrl: 'https://test.supabase.co' }));
vi.mock('./AddToAffiliateStoreButton', () => ({ default: () => <button>Add to affiliate store</button> }));
vi.mock('./AddToSellerStoreButton', () => ({ default: () => <button>Add to seller store</button> }));

const product = {
  id: 'product-id',
  title: 'Vintage lamp',
  price: 29.99,
  is_active: true,
  is_promotable: true,
  affiliate_enabled: true,
  commission_type: 'flat_rate' as const,
  flat_commission_amount: 8,
};

function renderCard(businessView: boolean, overrides = {}) {
  return renderToStaticMarkup(
    <StaticRouter location="/marketplace">
      <CanonicalProductCard product={{ ...product, ...overrides }} viewMode="grid" businessView={businessView} />
    </StaticRouter>,
  );
}

describe('marketplace card account views', () => {
  beforeEach(() => {
    account.role = 'buyer';
    vi.stubGlobal('window', { location: { origin: 'https://beezio.co' } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps business options hidden from a buyer even if the view is requested', () => {
    const markup = renderCard(true);
    expect(markup).toContain('Add to Cart');
    expect(markup).toContain('Copy post');
    expect(markup).not.toContain('per sale');
    expect(markup).not.toContain('Promote this product');
    expect(markup).not.toContain('Add to affiliate store');
  });

  it('shows affiliate tools only when the affiliate opens the business view', () => {
    account.role = 'affiliate';
    expect(renderCard(false)).not.toContain('per sale');
    const markup = renderCard(true);
    expect(markup).toContain('Earn $8.00 per sale');
    expect(markup).toContain('Promote this product');
    expect(markup).toContain('Add to affiliate store');
  });

  it('honors a seller’s affiliate opt-out in the business view', () => {
    account.role = 'affiliate';
    const markup = renderCard(true, { affiliate_enabled: false });
    expect(markup).not.toContain('per sale');
    expect(markup).not.toContain('Promote this product');
    expect(markup).not.toContain('Add to affiliate store');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProductForm from './ProductForm';

vi.mock('../contexts/AuthContextMultiRole', () => ({ useAuth: () => ({ user: { id: 'seller-user' }, profile: { id: 'seller-profile', role: 'seller' }, userRoles: ['seller'], currentRole: 'seller' }) }));
vi.mock('../lib/supabase', () => ({ supabase: {}, supabaseUrl: 'https://test.supabase.co' }));

describe('new seller listing price review', () => {
  it('renders the empty form before pricing has been configured', () => {
    const markup = renderToStaticMarkup(<StaticRouter location="/products/new"><ProductForm /></StaticRouter>);
    expect(markup).toContain('Your seller ask');
    expect(markup).not.toContain('I reviewed the buyer total');
  });
});

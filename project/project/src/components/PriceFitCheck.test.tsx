import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import PriceFitCheck from './PriceFitCheck';

describe('seller price fit control', () => {
  it('requires a target before offering any payout change, then applies only the seller payout', () => {
    const apply = vi.fn();
    let view!: TestRenderer.ReactTestRenderer;
    act(() => { view = TestRenderer.create(<PriceFitCheck sellerPayout={40} affiliatePayout={10} shipping={5} productCost={12} onApplySellerPayout={apply} />); });
    expect(view.root.findAllByType('button')).toHaveLength(0);
    act(() => view.root.findByType('input').props.onChange({ target: { value: '49.99' } }));
    expect(JSON.stringify(view.toJSON())).toContain('above your target');
    expect(view.root.findByType('button').props.disabled).toBe(false);
    act(() => view.root.findByType('button').props.onClick());
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0]).toBeGreaterThan(12);
    expect(apply.mock.calls[0][0]).toBeLessThan(40);
    act(() => view.unmount());
  });
  it('prevents applying a payout below the known product cost', () => {
    let view!: TestRenderer.ReactTestRenderer;
    act(() => { view = TestRenderer.create(<PriceFitCheck sellerPayout={40} affiliatePayout={10} shipping={5} productCost={35} onApplySellerPayout={vi.fn()} />); });
    act(() => view.root.findByType('input').props.onChange({ target: { value: '39.99' } }));
    expect(view.root.findByType('button').props.disabled).toBe(true);
    expect(JSON.stringify(view.toJSON())).toContain('below the entered product cost');
    act(() => view.unmount());
  });
  it('removes the apply action when the budget cannot cover shipping and commission', () => {
    let view!: TestRenderer.ReactTestRenderer;
    act(() => { view = TestRenderer.create(<PriceFitCheck sellerPayout={20} affiliatePayout={10} shipping={5} productCost={0} onApplySellerPayout={vi.fn()} />); });
    act(() => view.root.findByType('input').props.onChange({ target: { value: '10' } }));
    expect(view.root.findAllByType('button')).toHaveLength(0);
    expect(JSON.stringify(view.toJSON())).toContain('cannot cover');
    act(() => view.unmount());
  });
});

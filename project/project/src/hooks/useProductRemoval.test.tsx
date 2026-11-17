import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveProductById } from '../utils/archiveProduct';
import { useProductRemoval } from './useProductRemoval';

vi.mock('../utils/archiveProduct', () => ({ archiveProductById: vi.fn() }));
const archive = vi.mocked(archiveProductById);
const removed = vi.fn();
let renderer: ReactTestRenderer;

function Harness() {
  const { requestRemoval, removalDialog } = useProductRemoval();
  return <>
    <button onClick={() => requestRemoval({ productId: 'product-1', title: 'Digital guide', sellerId: 'seller-1', onRemoved: removed })}>Remove</button>
    {removalDialog}
  </>;
}

const button = (label: string) => renderer.root.findAllByType('button').find(node => node.children.join('') === label)!;
const open = async () => { await act(async () => { button('Remove').props.onClick(); }); };

beforeEach(async () => {
  vi.clearAllMocks();
  archive.mockResolvedValue(undefined);
  vi.stubGlobal('window', { confirm: () => { throw new Error('Browser popup must not be used'); } });
  await act(async () => { renderer = create(<Harness />); });
});
afterEach(async () => { await act(async () => renderer.unmount()); vi.unstubAllGlobals(); });

describe('seller product removal confirmation', () => {
  it('opens a visible dialog without archiving and lets the seller cancel', async () => {
    await open();
    expect(renderer.root.findByProps({ role: 'dialog' })).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain('Digital guide');
    expect(archive).not.toHaveBeenCalled();
    await act(async () => { button('Cancel').props.onClick(); });
    expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
    expect(removed).not.toHaveBeenCalled();
  });

  it('archives the selected product only after confirmation and updates the product list', async () => {
    await open();
    await act(async () => { await button('Remove product').props.onClick(); });
    expect(archive).toHaveBeenCalledExactlyOnceWith({ productId: 'product-1', sellerId: 'seller-1' });
    expect(removed).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
  });

  it('shows server errors, keeps the product and supports retry', async () => {
    archive.mockRejectedValueOnce(new Error('Archive failed (503)'));
    await open();
    await act(async () => { await button('Remove product').props.onClick(); });
    expect(renderer.root.findByProps({ role: 'alert' }).children.join('')).toBe('Archive failed (503)');
    expect(removed).not.toHaveBeenCalled();
    await act(async () => { await button('Remove product').props.onClick(); });
    expect(removed).toHaveBeenCalledOnce();
  });

  it('blocks duplicate requests and cancellation while the archive is running', async () => {
    let resolve!: () => void;
    archive.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    await open();
    const confirm = button('Remove product').props.onClick;
    let completion!: Promise<void>;
    await act(async () => { completion = confirm(); void confirm(); });
    expect(archive).toHaveBeenCalledOnce();
    expect(button('Cancel').props.disabled).toBe(true);
    expect(button('Removing…').props.disabled).toBe(true);
    await act(async () => { resolve(); await completion; });
    expect(removed).toHaveBeenCalledOnce();
  });

  it('dismisses with Escape before submission', async () => {
    await open();
    await act(async () => { renderer.root.findByProps({ role: 'dialog' }).props.onKeyDown({ key: 'Escape' }); });
    expect(renderer.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
    expect(archive).not.toHaveBeenCalled();
  });
});

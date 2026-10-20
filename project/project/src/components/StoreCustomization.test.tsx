import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StoreCustomization from './StoreCustomization';
import { themes } from '../utils/themes';

const db = vi.hoisted(() => ({
  settings: {} as Record<string, any>,
  upsert: vi.fn(),
  from: vi.fn(),
  alert: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabase: { from: db.from } }));
vi.mock('../contexts/AuthContextMultiRole', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../utils/resolveProfileId', () => ({
  resolveProfileIdForUser: async () => 'owner-1',
  ensureProfileIdForUser: async () => 'owner-1',
}));
// These children own unrelated network effects; exercise the real editor and Save handler.
vi.mock('./CustomDomainManager', () => ({ default: () => null }));
vi.mock('./ImageUploader', () => ({ default: () => null }));
vi.mock('./CustomPageBuilder', () => ({ default: () => null }));
vi.mock('./ProductOrderManager', () => ({ default: () => null }));
vi.mock('./ProductBrowserForSellers', () => ({ default: () => null }));
vi.mock('./StoreOrganizationPanel', () => ({ default: () => null }));
vi.mock('./StoreTemplateSelector', () => ({ default: () => null }));
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) => children({ innerRef: () => {}, droppableProps: {}, placeholder: null }),
  Draggable: ({ children }: any) => children({ innerRef: () => {}, draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));

let editor: ReactTestRenderer;
const node = (label: string) => editor.root.findByProps({ 'aria-label': label });
const text = (item: ReactTestInstance): string => item.children.map(child => typeof child === 'string' ? child : text(child)).join('');
const button = (label: string) => editor.root.findAllByType('button').find(item => text(item) === label)!;
const palette = (label: string) => editor.root.findByProps({ 'aria-label': 'Interactive storefront design playground' }).findAllByType('button').find(item => text(item) === label)!;
const select = (label: string) => editor.root.findAllByType('label').find(item => text(item).startsWith(label))!.findByType('select');
const change = async (label: string, value: string) => {
  await act(async () => { select(label).props.onChange({ target: { value } }); });
};
const mount = async (role: 'seller' | 'affiliate' = 'seller') => {
  await act(async () => { editor = create(<StoreCustomization userId="user-1" role={role} />); });
};
const save = async () => {
  await act(async () => { await button('Save changes').props.onClick(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  db.settings = {
    store_name: 'Preview Shop', store_description: 'Existing store description.', subdomain: 'preview-shop',
    store_theme: 'modern', template_id: 'existing-template',
    layout_config: { grid_layout: 'standard', sidebar: true, show_categories: false, background_image_url: 'https://example.invalid/background.jpg' },
    color_scheme: { primary: '#123456', secondary: '#abcdef', accent: '#765432', background: '#fffaf0', text: '#112233' },
    social_links: { website: 'https://example.invalid' }, custom_css: '.existing { color: red; }',
    shipping_policy: 'Shipping per product.', return_policy: 'Returns per product.',
  };
  db.from.mockImplementation((table: string) => {
    expect(['store_settings', 'affiliate_store_settings']).toContain(table);
    let columns = '';
    const query = {
      select: (value: string) => { columns = value; return query; },
      eq: () => query,
      maybeSingle: async () => ({ data: columns === '*' ? structuredClone(db.settings) : null, error: null }),
      upsert: db.upsert,
    };
    return query;
  });
  db.upsert.mockImplementation(async (payload) => { db.settings = structuredClone(payload); return { error: null }; });
  vi.stubGlobal('alert', db.alert);
  vi.stubGlobal('window', { location: { origin: 'https://example.invalid' }, setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(async () => {
  if (editor!) await act(async () => { editor.unmount(); });
  vi.unstubAllGlobals();
});

describe('storefront draft preview and Save boundary', () => {
  it('shows all six brand palettes immediately without saving or losing custom colors', async () => {
    await mount();
    for (const [name, primary] of Object.entries({ Bronze: '#B57B46', Forest: '#396451', Midnight: '#283B60', Rose: '#B66E7E', Charcoal: '#343434', Ocean: '#287F9B' })) {
      await act(async () => { palette(name).props.onClick(); });
      expect(palette(name).props['aria-pressed']).toBe(true);
      const styles = node('Storefront live preview').findAllByType('div').map(item => item.props.style);
      expect(styles.some(style => style?.backgroundColor === primary)).toBe(true);
      expect(node('Storefront live preview').props.style.backgroundColor).toBe('#fffaf0');
    }
    expect(db.upsert).not.toHaveBeenCalled();
    expect(button('Save changes').props.disabled).toBe(false);
  });

  it.each(['Desktop', 'Mobile'])('makes every spacing choice visibly distinct in %s preview', async (device) => {
    await mount();
    await act(async () => { button(device).props.onClick(); });
    const gaps: number[] = [];
    for (const spacing of ['compact', 'standard', 'comfortable', 'large']) {
      await change('Product spacing', spacing);
      const grid = node('Preview products');
      gaps.push(grid.props.style.gap);
      const columns = device === 'Mobile' ? (spacing === 'compact' ? 2 : 1) : (spacing === 'large' ? 1 : 2);
      expect(grid.props.style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
      expect(grid.findAllByType('div')[1].props.style.padding).toBeGreaterThan(0);
    }
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
    expect(new Set(gaps).size).toBe(4);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('applies each theme locally while retaining explicit brand colors and background', async () => {
    await mount();
    for (const [name, theme] of Object.entries(themes)) {
      await change('Store theme', name);
      const preview = node('Storefront live preview');
      expect(preview.props.style.fontFamily).toBe(theme.fonts.body);
      expect(preview.props.style.backgroundColor).toBe('#fffaf0');
      expect(preview.findAllByType('div')[1].props.style.backgroundColor).toBe(theme.colors.background);
      expect(node('Preview products').findAllByType('div')[1].props.className).toContain(theme.cardStyle);
    }
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it.each(['seller', 'affiliate'] as const)('preserves the %s Save payload, persists only on Save, and reloads selections', async (role) => {
    await mount(role);
    await save();
    const baseline = structuredClone(db.upsert.mock.calls[0][0]);
    expect(db.upsert.mock.calls[0][1]).toEqual({ onConflict: `${role}_id` });
    expect(baseline[`${role}_id`]).toBe('owner-1');
    db.upsert.mockClear();
    const storedBeforeEdits = structuredClone(db.settings);
    await change('Product spacing', 'comfortable');
    await change('Store theme', 'dark');
    await act(async () => { palette('Forest').props.onClick(); });
    expect(db.settings).toEqual(storedBeforeEdits);
    expect(db.upsert).not.toHaveBeenCalled();
    await save();
    expect(db.upsert).toHaveBeenCalledTimes(1);
    expect(db.upsert.mock.calls[0][0]).toEqual({
      ...baseline, updated_at: expect.any(String), store_theme: 'dark',
      layout_config: { ...baseline.layout_config, grid_layout: 'comfortable' },
      color_scheme: { ...baseline.color_scheme, primary: '#396451', secondary: '#396451', accent: '#396451' },
    });
    expect(text(editor.root)).toContain('All changes saved');
    await act(async () => { editor.unmount(); });
    await mount(role);
    expect(select('Product spacing').props.value).toBe('comfortable');
    expect(select('Store theme').props.value).toBe('dark');
    expect(palette('Forest').props['aria-pressed']).toBe(true);
    expect(node('Preview products').props.style.gap).toBe(20);
    expect(db.upsert).toHaveBeenCalledTimes(1);
  });

  it('discards unsaved choices when the editor is reopened', async () => {
    await mount();
    await change('Store theme', 'dark');
    await change('Product spacing', 'large');
    await act(async () => { palette('Ocean').props.onClick(); });
    await act(async () => { editor.unmount(); });
    await mount();
    expect(select('Store theme').props.value).toBe('modern');
    expect(select('Product spacing').props.value).toBe('standard');
    expect(node('Storefront live preview').props.style.backgroundColor).toBe('#fffaf0');
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('normalizes legacy themes and handles an unrecognized saved grid without writing', async () => {
    db.settings.store_theme = 'minimalist';
    db.settings.layout_config.grid_layout = 'legacy-grid';
    await mount();
    expect(select('Store theme').props.value).toBe('minimal');
    expect(node('Preview products').props.style.gap).toBe(12);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.settings.layout_config.grid_layout).toBe('legacy-grid');
  });

  it('keeps the draft dirty after a Save failure', async () => {
    await mount();
    await change('Product spacing', 'large');
    db.upsert.mockResolvedValueOnce({ error: { message: 'Test save failure' } });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    await save();
    expect(text(editor.root)).toContain('Unsaved changes');
    expect(db.alert).toHaveBeenCalledWith('Failed to save store settings. Test save failure');
    errorLog.mockRestore();
  });
});

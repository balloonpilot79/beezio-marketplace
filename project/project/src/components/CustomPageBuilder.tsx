import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { Save, Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import DOMPurify from 'dompurify';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import {
  blocksToHtml,
  defaultPageTemplate,
  makeId,
  pageTemplates,
  type PageBlock,
  type PageTemplate,
} from '../utils/storePageTemplates';
import { ensureProfileIdForUser } from '../utils/resolveProfileId';

interface CustomPage {
  id: string;
  page_slug: string;
  page_title: string;
  page_content: string;
  is_active: boolean;
  display_order: number;
}

interface CustomPageBuilderProps {
  ownerType: 'seller' | 'affiliate';
}

type PageEditorMode = 'builder' | 'html';
const tryParseBlocksFromHtml = (html: string): PageBlock[] | null => {
  if (typeof window === 'undefined') return null;
  const raw = String(html || '').trim();
  if (!raw) return [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/html');
    const nodes = Array.from(doc.querySelectorAll('.bzo-block'));
    if (nodes.length === 0) return null;

    const blocks: PageBlock[] = [];
    for (const node of nodes) {
      const cls = node.className || '';
      if (cls.includes('bzo-block-heading')) {
        const h = node.querySelector('h1,h2,h3');
        const tag = (h?.tagName || 'H2').toUpperCase();
        const level = tag === 'H1' ? 1 : tag === 'H3' ? 3 : 2;
        blocks.push({ id: makeId(), type: 'heading', level, text: h?.textContent?.trim() || '' });
      } else if (cls.includes('bzo-block-text')) {
        const p = node.querySelector('p');
        blocks.push({ id: makeId(), type: 'text', text: p?.textContent || '' });
      } else if (cls.includes('bzo-block-image')) {
        const img = node.querySelector('img');
        blocks.push({
          id: makeId(),
          type: 'image',
          src: img?.getAttribute('src') || '',
          alt: img?.getAttribute('alt') || '',
        });
      } else if (cls.includes('bzo-block-button')) {
        const a = node.querySelector('a');
        blocks.push({
          id: makeId(),
          type: 'button',
          label: a?.textContent?.trim() || 'Shop now',
          href: a?.getAttribute('href') || '/',
        });
      } else if (cls.includes('bzo-block-divider')) {
        blocks.push({ id: makeId(), type: 'divider' });
      }
    }

    return blocks;
  } catch {
    return null;
  }
};

const getDefaultBlocks = (): PageBlock[] => defaultPageTemplate.createBlocks();
const ALLOWED_PLATFORM_PATH_PREFIXES = [
  '/marketplace',
  '/products',
  '/product/',
  '/store/',
  '/partner/',
  '/checkout',
  '/cart',
  '/about',
  '/contact',
  '/faq',
  '/shipping',
  '/returns',
  '/privacy',
  '/terms',
];

const isAllowedPlatformPath = (pathname: string): boolean => {
  const path = String(pathname || '/').toLowerCase();
  if (path === '/') return true;
  return ALLOWED_PLATFORM_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
};

export default function CustomPageBuilder({ ownerType }: CustomPageBuilderProps) {
  const { user, profile } = useAuth();
  const [ownerId, setOwnerId] = useState<string>('');
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [isNewPage, setIsNewPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [editorMode, setEditorMode] = useState<PageEditorMode>('builder');
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [editingSnapshot, setEditingSnapshot] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user?.id) {
        if (!cancelled) setOwnerId('');
        return;
      }
      const resolved = await ensureProfileIdForUser(user);
      if (!cancelled) setOwnerId(resolved || '');
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    void loadPages();
  }, [ownerId, ownerType]);

  useEffect(() => {
    if (!editingPage) return;

    const parsed = tryParseBlocksFromHtml(editingPage.page_content);
    if (parsed !== null) {
      setBlocks(parsed.length ? parsed : getDefaultBlocks());
      setEditorMode('builder');
      return;
    }

    // Legacy HTML without builder markers: keep in HTML mode by default.
    setEditorMode('html');
    setBlocks([]);
  }, [editingPage?.id]);

  const loadPages = async () => {
    if (!ownerId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('custom_pages')
        .select('*')
        .eq('owner_id', ownerId)
        .eq('owner_type', ownerType)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPages(data || []);
    } catch (err) {
      console.error('Error loading pages:', err);
      setError('Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  const startEditingWithBlocks = (template: PageTemplate, overrides?: { slug?: string; title?: string }) => {
    const initialBlocks = template.createBlocks();
    const nextPage = {
      id: '',
      page_slug: overrides?.slug ?? template.slug ?? '',
      page_title: overrides?.title ?? template.title ?? '',
      page_content: blocksToHtml(initialBlocks),
      is_active: true,
      display_order: pages.length
    };
    setEditingPage(nextPage);
    setIsNewPage(true);
    setPreviewMode(false);
    setEditorMode('builder');
    setBlocks(initialBlocks);
    setEditingSnapshot(JSON.stringify({
      page_slug: nextPage.page_slug,
      page_title: nextPage.page_title,
      page_content: nextPage.page_content,
      is_active: nextPage.is_active,
    }));
  };

  const handleNewPage = () => {
    startEditingWithBlocks(defaultPageTemplate, { slug: '', title: '' });
  };

  const handleEditPage = (page: CustomPage) => {
    setEditingPage(page);
    setIsNewPage(false);
    setPreviewMode(false);
    setEditingSnapshot(JSON.stringify({
      page_slug: page.page_slug,
      page_title: page.page_title,
      page_content: page.page_content,
      is_active: page.is_active,
    }));
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const { error } = await supabase
        .from('custom_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;
      
      setSuccess('Page deleted successfully');
      loadPages();
      setEditingPage(null);
    } catch (err) {
      console.error('Error deleting page:', err);
      setError('Failed to delete page');
    }
  };

  const sanitizeHTML = (html: string): string => {
    // Configure DOMPurify to ensure all checkout/product links go through our platform and block external checkouts
    const allowedHosts = ['beezio.co', window.location.host];

    const config = {
      ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'img', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'code', 'pre', 'hr', 'section', 'article', 'button'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'id', 'target', 'rel'],
      ALLOWED_STYLES: {
        '*': {
          'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
          'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
          'font-size': [/^\d+px$/, /^\d+rem$/, /^\d+em$/],
          'margin': [/^\d+px$/, /^\d+rem$/, /^auto$/],
          'padding': [/^\d+px$/, /^\d+rem$/],
          'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
          'font-weight': [/^\d+$/, /^bold$/, /^normal$/],
          'display': [/^block$/, /^inline$/, /^inline-block$/, /^flex$/, /^grid$/],
          'width': [/^\d+%$/, /^\d+px$/, /^auto$/],
          'height': [/^\d+px$/, /^auto$/],
          'border': [/.*/],
          'border-radius': [/^\d+px$/]
        }
      },
      KEEP_CONTENT: true
    };

    DOMPurify.removeAllHooks();
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        const href = node.getAttribute('href') || '';
        const isMailTel = href.startsWith('mailto:') || href.startsWith('tel:');
        const isHashOnly = href.startsWith('#');
        const isRelative = href.startsWith('/');
        let isAllowedHost = false;
        let isAllowedPath = false;
        try {
          const url = new URL(href, window.location.origin);
          isAllowedHost = allowedHosts.some(h => url.host.endsWith(h));
          isAllowedPath = isAllowedPlatformPath(url.pathname);
        } catch (e) {
          // ignore parse errors
        }
        const allow = isMailTel || isHashOnly || (isRelative && isAllowedPath) || (isAllowedHost && isAllowedPath);
        if (!allow) {
          node.removeAttribute('href');
          node.setAttribute('data-blocked', 'external-checkout-blocked');
          node.textContent = node.textContent || 'Link blocked';
        }
      }
    });

    return DOMPurify.sanitize(html, config);
  };

  const getCurrentEditorContent = (): string => {
    if (!editingPage) return '';
    return editorMode === 'builder' ? blocksToHtml(blocks) : editingPage.page_content;
  };

  const hasUnsavedChanges = Boolean(
    editingPage && editingSnapshot !== JSON.stringify({
      page_slug: editingPage.page_slug,
      page_title: editingPage.page_title,
      page_content: getCurrentEditorContent(),
      is_active: editingPage.is_active,
    })
  );

  const switchToPage = (pageId: string) => {
    const target = pages.find((page) => page.id === pageId);
    if (!target || (editingPage && target.id === editingPage.id)) return;
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Switch pages anyway?')) return;
    handleEditPage(target);
  };

  const handleSavePage = async () => {
    if (!ownerId || !editingPage) return;

    // Validate
    if (!editingPage.page_title.trim()) {
      setError('Page title is required');
      return;
    }

    if (!editingPage.page_slug.trim()) {
      setError('Page URL slug is required');
      return;
    }

    // Validate slug format (URL-friendly)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(editingPage.page_slug)) {
      setError('URL slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const contentForSave = editorMode === 'builder' ? blocksToHtml(blocks) : editingPage.page_content;
      const sanitizedContent = sanitizeHTML(contentForSave);
      
      const pageData = {
        owner_id: ownerId,
        owner_type: ownerType,
        page_slug: editingPage.page_slug,
        page_title: editingPage.page_title,
        page_content: sanitizedContent,
        is_active: editingPage.is_active,
        display_order: editingPage.display_order,
        updated_at: new Date().toISOString()
      };

      if (isNewPage) {
        const { error } = await supabase
          .from('custom_pages')
          .insert(pageData);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_pages')
          .update(pageData)
          .eq('id', editingPage.id);

        if (error) throw error;
      }

      setSuccess('Page saved successfully');
      loadPages();
      setEditingSnapshot(JSON.stringify({
        page_slug: editingPage.page_slug,
        page_title: editingPage.page_title,
        page_content: sanitizedContent,
        is_active: editingPage.is_active,
      }));
      setEditingPage(null);
      setIsNewPage(false);
    } catch (err: any) {
      console.error('Error saving page:', err);
      if (err.message?.includes('unique')) {
        setError('A page with this URL slug already exists');
      } else {
        setError('Failed to save page');
      }
    } finally {
      setSaving(false);
    }
  };

  const getDefaultTemplate = (): string => {
    return `<div style="max-width: 1200px; margin: 0 auto; padding: 40px 20px;">
  <h1 style="color: #000; font-size: 2.5rem; margin-bottom: 20px;">Welcome to My Custom Page</h1>
  
  <p style="font-size: 1.1rem; color: #333; margin-bottom: 30px;">
    Use this page to promote your business, share your story, or showcase special offers.
  </p>

  <section style="background-color: #f9f9f9; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
    <h2 style="color: #ffcc00; font-size: 2rem; margin-bottom: 15px;">About Us</h2>
    <p style="color: #333; line-height: 1.6;">
      Add your compelling business story here. Tell customers why they should choose you.
    </p>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #000; font-size: 2rem; margin-bottom: 15px;">Featured Products</h2>
    <p style="color: #333; margin-bottom: 15px;">
      Check out our amazing products! <a href="/products" style="color: #ffcc00; text-decoration: underline;">Browse all products</a>
    </p>
  </section>

  <div style="background-color: #ffcc00; padding: 40px; text-align: center; border-radius: 8px;">
    <h3 style="color: #000; font-size: 1.8rem; margin-bottom: 15px;">Ready to Shop?</h3>
    <a href="/checkout" style="display: inline-block; background-color: #000; color: #fff; padding: 15px 40px; border-radius: 4px; text-decoration: none; font-weight: bold;">
      Start Shopping
    </a>
  </div>
</div>`;
  };

  if (loading) {
    return <div className="text-center py-8">Loading pages...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">×</button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-600 hover:text-green-800">×</button>
        </div>
      )}

      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">📝 Custom Page Builder</h3>
        <p className="text-yellow-800 text-sm mb-2">
          Create custom pages with a drag-and-drop builder (no HTML required). All product/checkout links route through Beezio.
        </p>
        <p className="text-yellow-700 text-xs">
          <strong>Security Note:</strong> Content is sanitized for safety. Advanced HTML is available if needed.
        </p>
      </div>

      {!editingPage ? (
        <div>
          <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Template library</h3>
                <p className="text-sm text-gray-600">Launch fast with prebuilt layouts you can edit and reorder.</p>
              </div>
              <button
                onClick={handleNewPage}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 font-semibold"
              >
                <Plus className="w-5 h-5" />
                Blank page
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {pageTemplates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
                  <div className="text-sm uppercase tracking-wide text-gray-500">Template</div>
                  <div className="text-lg font-semibold text-gray-900">{template.title}</div>
                  <div className="text-sm text-gray-600">{template.description}</div>
                  <button
                    type="button"
                    onClick={() => startEditingWithBlocks(template)}
                    className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 font-semibold"
                  >
                    Use template
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">My Custom Pages</h2>
            <button
              onClick={handleNewPage}
              className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-lg hover:bg-yellow-500 font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create New Page
            </button>
          </div>

          {pages.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-4">No custom pages yet</p>
              <button
                onClick={handleNewPage}
                className="inline-flex items-center gap-2 bg-yellow-400 text-black px-6 py-3 rounded-lg hover:bg-yellow-500 font-semibold"
              >
                <Plus className="w-5 h-5" />
                Create Your First Page
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {pages.map((page) => (
                <div key={page.id} className="border rounded-lg p-4 flex items-center justify-between hover:border-yellow-400 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{page.page_title}</h3>
                      {page.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Draft</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">/{ownerType}/{profile?.username}/{page.page_slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditPage(page)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePage(page.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{isNewPage ? 'Create New Page' : 'Edit Page'}</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {pages.length > 1 && !isNewPage && editingPage ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = pages.findIndex((page) => page.id === editingPage.id);
                      if (currentIndex > 0) switchToPage(pages[currentIndex - 1].id);
                    }}
                    className="inline-flex items-center gap-2 rounded border px-3 py-2 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev page
                  </button>
                  <select
                    value={editingPage.id}
                    onChange={(e) => switchToPage(e.target.value)}
                    className="rounded border bg-white px-3 py-2 text-sm"
                  >
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.page_title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const currentIndex = pages.findIndex((page) => page.id === editingPage.id);
                      if (currentIndex >= 0 && currentIndex < pages.length - 1) switchToPage(pages[currentIndex + 1].id);
                    }}
                    className="inline-flex items-center gap-2 rounded border px-3 py-2 hover:bg-gray-50"
                  >
                    Next page
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : null}
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {previewMode ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={() => {
                  if (hasUnsavedChanges && !confirm('You have unsaved changes. Close the editor anyway?')) return;
                  setEditingPage(null);
                  setIsNewPage(false);
                  setError('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePage}
                disabled={saving}
                className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded hover:bg-yellow-500 font-semibold disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Page'}
              </button>
            </div>
          </div>

          {!previewMode ? (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">Page Title</label>
                <input
                  type="text"
                  value={editingPage.page_title}
                  onChange={(e) => setEditingPage({ ...editingPage, page_title: e.target.value })}
                  placeholder="About Us, Special Offers, etc."
                  className="w-full p-3 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">URL Slug (lowercase, no spaces)</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">/{ownerType}/{profile?.username}/</span>
                  <input
                    type="text"
                    value={editingPage.page_slug}
                    onChange={(e) => setEditingPage({ ...editingPage, page_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="about-us"
                    className="flex-1 p-3 border rounded-lg"
                  />
                </div>
                {pages.length > 1 && !isNewPage ? (
                  <p className="mt-2 text-xs text-gray-500">Use the page switcher in the header to jump between saved pages while editing.</p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block font-semibold">Page Content</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditorMode('builder');
                        const parsed = tryParseBlocksFromHtml(editingPage.page_content);
                        if (parsed !== null) setBlocks(parsed.length ? parsed : getDefaultBlocks());
                        else setBlocks(getDefaultBlocks());
                      }}
                      className={`px-3 py-1.5 rounded border text-sm font-semibold ${
                        editorMode === 'builder' ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white hover:bg-gray-50'
                      }`}
                      type="button"
                    >
                      Builder
                    </button>
                    <button
                      onClick={() => {
                        setEditorMode('html');
                        setEditingPage({ ...editingPage, page_content: blocksToHtml(blocks) });
                      }}
                      className={`px-3 py-1.5 rounded border text-sm font-semibold ${
                        editorMode === 'html' ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white hover:bg-gray-50'
                      }`}
                      type="button"
                    >
                      Advanced HTML
                    </button>
                  </div>
                </div>

                {editorMode === 'builder' ? (
                  <div className="border rounded-lg p-4 bg-white space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setBlocks((prev) => [...prev, { id: makeId(), type: 'heading', level: 2, text: 'New section' }])}
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                      >
                        Add heading
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlocks((prev) => [...prev, { id: makeId(), type: 'text', text: '' }])}
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                      >
                        Add text
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlocks((prev) => [...prev, { id: makeId(), type: 'image', src: '', alt: '' }])}
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                      >
                        Add image
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlocks((prev) => [...prev, { id: makeId(), type: 'button', label: 'Shop now', href: '/marketplace' }])}
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                      >
                        Add button
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlocks((prev) => [...prev, { id: makeId(), type: 'divider' }])}
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                      >
                        Add divider
                      </button>
                    </div>

                    <DragDropContext
                      onDragEnd={(result: DropResult) => {
                        if (!result.destination) return;
                        const src = result.source.index;
                        const dst = result.destination.index;
                        if (src === dst) return;
                        setBlocks((prev) => {
                          const next = [...prev];
                          const [moved] = next.splice(src, 1);
                          next.splice(dst, 0, moved);
                          return next;
                        });
                      }}
                    >
                      <Droppable droppableId="blocks">
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                            {blocks.map((block, idx) => (
                              <Draggable key={block.id} draggableId={block.id} index={idx}>
                                {(dragProvided) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    className="border rounded-lg p-3 bg-gray-50"
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span {...dragProvided.dragHandleProps} className="text-gray-600">
                                          <GripVertical className="w-4 h-4" />
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                                          {block.type}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setBlocks((prev) => prev.filter((b) => b.id !== block.id))}
                                        className="text-red-600 hover:text-red-700 text-sm font-semibold"
                                      >
                                        Remove
                                      </button>
                                    </div>

                                    {block.type === 'heading' && (
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <select
                                          value={block.level}
                                          onChange={(e) => {
                                            const level = Number(e.target.value) as 1 | 2 | 3;
                                            setBlocks((prev) =>
                                              prev.map((b) => (b.id === block.id ? { ...b, level } : b))
                                            );
                                          }}
                                          className="p-2 border rounded bg-white"
                                        >
                                          <option value={1}>H1</option>
                                          <option value={2}>H2</option>
                                          <option value={3}>H3</option>
                                        </select>
                                        <input
                                          value={block.text}
                                          onChange={(e) => {
                                            const text = e.target.value;
                                            setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, text } : b)));
                                          }}
                                          className="md:col-span-3 p-2 border rounded bg-white"
                                          placeholder="Heading text"
                                        />
                                      </div>
                                    )}

                                    {block.type === 'text' && (
                                      <textarea
                                        value={block.text}
                                        onChange={(e) => {
                                          const text = e.target.value;
                                          setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, text } : b)));
                                        }}
                                        rows={5}
                                        className="w-full p-2 border rounded bg-white"
                                        placeholder="Write your content..."
                                      />
                                    )}

                                    {block.type === 'image' && (
                                      <div className="space-y-2">
                                        <input
                                          value={block.src}
                                          onChange={(e) => {
                                            const src = e.target.value;
                                            setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, src } : b)));
                                          }}
                                          className="w-full p-2 border rounded bg-white"
                                          placeholder="Image URL"
                                        />
                                        <input
                                          value={block.alt}
                                          onChange={(e) => {
                                            const alt = e.target.value;
                                            setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, alt } : b)));
                                          }}
                                          className="w-full p-2 border rounded bg-white"
                                          placeholder="Alt text (accessibility)"
                                        />
                                      </div>
                                    )}

                                    {block.type === 'button' && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <input
                                          value={block.label}
                                          onChange={(e) => {
                                            const label = e.target.value;
                                            setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, label } : b)));
                                          }}
                                          className="p-2 border rounded bg-white"
                                          placeholder="Button label"
                                        />
                                        <input
                                          value={block.href}
                                          onChange={(e) => {
                                            const href = e.target.value;
                                            setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, href } : b)));
                                          }}
                                          className="p-2 border rounded bg-white"
                                          placeholder="Link (e.g. /marketplace, /product/123, /checkout)"
                                        />
                                      </div>
                                    )}

                                    {block.type === 'divider' && (
                                      <div className="text-sm text-gray-600">Divider</div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                ) : (
                  <textarea
                    value={editingPage.page_content}
                    onChange={(e) => setEditingPage({ ...editingPage, page_content: e.target.value })}
                    rows={20}
                    className="w-full p-3 border rounded-lg font-mono text-sm"
                    placeholder="Enter your HTML here..."
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editingPage.is_active}
                  onChange={(e) => setEditingPage({ ...editingPage, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="font-semibold">
                  Publish page (make it visible to public)
                </label>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-white min-h-[500px]">
              <div className="mb-4 pb-4 border-b">
                <h1 className="text-3xl font-bold">{editingPage.page_title}</h1>
                <p className="text-sm text-gray-600">Preview of: /{ownerType}/{profile?.username}/{editingPage.page_slug}</p>
              </div>
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeHTML(editorMode === 'builder' ? blocksToHtml(blocks) : editingPage.page_content),
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

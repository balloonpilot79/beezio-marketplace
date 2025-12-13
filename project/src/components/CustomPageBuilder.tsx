import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Save, Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

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

export default function CustomPageBuilder({ ownerType }: CustomPageBuilderProps) {
  const { user, profile } = useAuth();
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [editingPage, setEditingPage] = useState<CustomPage | null>(null);
  const [isNewPage, setIsNewPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadPages();
  }, [profile?.id]);

  const loadPages = async () => {
    if (!profile?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('custom_pages')
        .select('*')
        .eq('owner_id', profile.id)
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

  const handleNewPage = () => {
    setEditingPage({
      id: '',
      page_slug: '',
      page_title: '',
      page_content: getDefaultTemplate(),
      is_active: true,
      display_order: pages.length
    });
    setIsNewPage(true);
    setPreviewMode(false);
  };

  const handleEditPage = (page: CustomPage) => {
    setEditingPage(page);
    setIsNewPage(false);
    setPreviewMode(false);
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

    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        const href = node.getAttribute('href') || '';
        const isMailTel = href.startsWith('mailto:') || href.startsWith('tel:');
        const isRelative = href.startsWith('/') || href.startsWith('#');
        let isAllowedHost = false;
        try {
          const url = new URL(href, window.location.origin);
          isAllowedHost = allowedHosts.some(h => url.host.endsWith(h));
        } catch (e) {
          // ignore parse errors
        }
        if (!(isMailTel || isRelative || isAllowedHost)) {
          node.removeAttribute('href');
          node.setAttribute('data-blocked', 'external-checkout-blocked');
          node.textContent = node.textContent || 'Link blocked';
        }
      }
    });

    return DOMPurify.sanitize(html, config);
  };

  const handleSavePage = async () => {
    if (!profile?.id || !editingPage) return;

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
      
      const sanitizedContent = sanitizeHTML(editingPage.page_content);
      
      const pageData = {
        owner_id: profile.id,
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
          Create custom pages with HTML to promote your business. All product/checkout links automatically route through the Beezio platform.
        </p>
        <p className="text-yellow-700 text-xs">
          <strong>Security Note:</strong> HTML is sanitized for safety. External checkout links are automatically redirected to our platform checkout.
        </p>
      </div>

      {!editingPage ? (
        <div>
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
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {previewMode ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={() => {
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
              </div>

              <div>
                <label className="block font-semibold mb-2">Page Content (HTML)</label>
                <textarea
                  value={editingPage.page_content}
                  onChange={(e) => setEditingPage({ ...editingPage, page_content: e.target.value })}
                  rows={20}
                  className="w-full p-3 border rounded-lg font-mono text-sm"
                  placeholder="Enter your HTML here..."
                />
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
              <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(editingPage.page_content) }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

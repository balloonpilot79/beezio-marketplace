import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AlertCircle, ArrowLeft, Store } from 'lucide-react';
import DOMPurify from 'dompurify';

interface CustomPage {
  id: string;
  owner_id: string;
  owner_type: 'seller' | 'affiliate';
  page_slug: string;
  page_title: string;
  page_content: string;
  is_active: boolean;
  created_at: string;
}

interface OwnerProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
}

export default function CustomPageView() {
  const { ownerType, username, pageSlug } = useParams<{
    ownerType: 'seller' | 'affiliate';
    username: string;
    pageSlug: string;
  }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<CustomPage | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPage();
  }, [ownerType, username, pageSlug]);

  const loadPage = async () => {
    if (!ownerType || !username || !pageSlug) {
      setError('Invalid page URL');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // First, find the owner by username
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('username', username)
        .single();

      if (profileError || !profileData) {
        setError('Store owner not found');
        setLoading(false);
        return;
      }

      setOwner(profileData);

      // Then, load the custom page
      const { data: pageData, error: pageError } = await supabase
        .from('custom_pages')
        .select('*')
        .eq('owner_id', profileData.id)
        .eq('owner_type', ownerType)
        .eq('page_slug', pageSlug)
        .eq('is_active', true)
        .single();

      if (pageError || !pageData) {
        setError('Page not found or not published');
        setLoading(false);
        return;
      }

      setPage(pageData);
    } catch (err) {
      console.error('Error loading page:', err);
      setError('Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const sanitizeHTML = (html: string): string => {
    const config = {
      ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'img', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'code', 'pre', 'hr', 'section', 'article', 'button'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'id', 'target', 'rel'],
      KEEP_CONTENT: true
    };

    return DOMPurify.sanitize(html, config);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (error || !page || !owner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This page does not exist or has been removed.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {owner.avatar_url && (
                <img 
                  src={owner.avatar_url} 
                  alt={owner.full_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <h2 className="text-sm text-gray-600">{ownerType === 'seller' ? "Seller's" : "Affiliate's"} Custom Page</h2>
                <h1 className="text-2xl font-bold text-gray-900">{owner.full_name}</h1>
              </div>
            </div>
            <Link
              to={`/store/${owner.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
            >
              <Store className="w-4 h-4" />
              Visit Store
            </Link>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">{page.page_title}</h1>
          <div 
            className="custom-page-content prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(page.page_content) }}
          />
        </div>

        {/* Back Navigation */}
        <div className="mt-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

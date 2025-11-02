import React from 'react';
import { ExternalLink, Copy, Share } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface StoreLinksProps {
  userRole: 'seller' | 'affiliate';
  className?: string;
}

const StoreLinks: React.FC<StoreLinksProps> = ({ userRole, className = '' }) => {
  const { user, profile } = useAuth();

  const profileId = profile?.id || user?.id || '';

  const storeUrl = userRole === 'seller' 
    ? `${window.location.origin}/store/${profileId}`
    : `${window.location.origin}/affiliate/${profileId}`;

  const storePath = userRole === 'seller' 
    ? `/store/${profileId}`
    : `/affiliate/${profileId}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareStore = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My ${userRole === 'seller' ? 'Custom' : 'Affiliate'} Store`,
          url: storeUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard(storeUrl);
    }
  };

  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          My {userRole === 'seller' ? 'Custom' : 'Affiliate'} Store
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => profileId && copyToClipboard(storeUrl)}
            className={`p-2 rounded-lg transition-colors ${profileId ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
            title="Copy store URL"
            disabled={!profileId}
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => profileId && shareStore()}
            className={`p-2 rounded-lg transition-colors ${profileId ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
            title="Share store"
            disabled={!profileId}
          >
            <Share className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Store URL</label>
          <div className="flex items-center space-x-2">
            <code className="flex-1 bg-gray-50 px-3 py-2 rounded-lg text-sm font-mono border">
              {profileId ? storePath : 'Profile still loading'}
            </code>
            {profileId && (
              <a
                href={storePath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Visit</span>
              </a>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {userRole === 'seller' ? (
            <>
              Share this link to showcase your products with your custom branding and themes.
            </>
          ) : (
            <>
              Share this link to earn commissions on every sale from your personalized store.
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreLinks;

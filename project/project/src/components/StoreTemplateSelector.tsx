import React, { useState } from 'react';
import { LayoutGrid, Columns, List, Maximize2, ShoppingBag, Sparkles, Package, Heart } from 'lucide-react';

export interface StoreTemplate {
  id: string;
  name: string;
  description: string;
  category: 'storefront' | 'product' | 'landing';
  preview_image?: string;
  features: string[];
  layout: {
    header_style: 'banner' | 'minimal' | 'full-width' | 'split';
    product_grid: '2-col' | '3-col' | '4-col' | 'masonry' | 'carousel';
    sidebar: boolean;
    footer_style: 'compact' | 'detailed' | 'minimal';
  };
  theme: string;
}

const STORE_TEMPLATES: StoreTemplate[] = [
  // STOREFRONT TEMPLATES
  {
    id: 'modern-grid',
    name: 'Modern Grid',
    description: 'Clean hero banner with featured products in a responsive grid layout',
    category: 'storefront',
    features: ['Hero banner', 'Featured carousel', 'Product grid', 'Category filters', 'Quick view'],
    layout: {
      header_style: 'banner',
      product_grid: '4-col',
      sidebar: false,
      footer_style: 'detailed'
    },
    theme: 'modern'
  },
  {
    id: 'boutique-story',
    name: 'Boutique Storyteller',
    description: 'Large imagery with narrative sections - perfect for artisan/craft sellers',
    category: 'storefront',
    features: ['Full-width header', 'Story sections', 'Featured collections', 'Large product cards', 'About section'],
    layout: {
      header_style: 'full-width',
      product_grid: '2-col',
      sidebar: false,
      footer_style: 'compact'
    },
    theme: 'elegant'
  },
  {
    id: 'catalog-browse',
    name: 'Catalog Browser',
    description: 'Sidebar navigation with list/grid toggle - ideal for large inventories',
    category: 'storefront',
    features: ['Category sidebar', 'List/Grid toggle', 'Advanced filters', 'Sort options', 'Bulk actions'],
    layout: {
      header_style: 'minimal',
      product_grid: '3-col',
      sidebar: true,
      footer_style: 'minimal'
    },
    theme: 'minimalist'
  },
  {
    id: 'launch-page',
    name: 'Launch One-Pager',
    description: 'Single-page store with hero, highlights, and integrated checkout',
    category: 'storefront',
    features: ['Single-page', 'Hero section', 'Product highlights', 'FAQ', 'Inline checkout'],
    layout: {
      header_style: 'full-width',
      product_grid: 'carousel',
      sidebar: false,
      footer_style: 'compact'
    },
    theme: 'vibrant'
  },
  {
    id: 'marketplace-hub',
    name: 'Marketplace Hub',
    description: 'Multi-category storefront with promoted products and affiliate features',
    category: 'storefront',
    features: ['Category cards', 'Promoted section', 'Affiliate links', 'Featured sellers', 'Search bar'],
    layout: {
      header_style: 'banner',
      product_grid: '3-col',
      sidebar: true,
      footer_style: 'detailed'
    },
    theme: 'modern'
  },
  {
    id: 'subscription-store',
    name: 'Subscription Store',
    description: 'Optimized for recurring products with plan comparison',
    category: 'storefront',
    features: ['Plan cards', 'Feature comparison', 'Recurring badges', 'Member benefits', 'FAQ'],
    layout: {
      header_style: 'minimal',
      product_grid: '3-col',
      sidebar: false,
      footer_style: 'detailed'
    },
    theme: 'professional'
  },

  // PRODUCT PAGE TEMPLATES
  {
    id: 'product-detailed',
    name: 'Detailed Product View',
    description: 'Full-featured product page with gallery, reviews, and recommendations',
    category: 'product',
    features: ['Image gallery', 'Zoom', 'Variant selector', 'Reviews', 'Related products', 'Size guide'],
    layout: {
      header_style: 'split',
      product_grid: '4-col',
      sidebar: false,
      footer_style: 'detailed'
    },
    theme: 'modern'
  },
  {
    id: 'product-minimal',
    name: 'Minimal Product',
    description: 'Clean, distraction-free product view focused on the item',
    category: 'product',
    features: ['Single image', 'Minimal details', 'Quick add-to-cart', 'Price display'],
    layout: {
      header_style: 'minimal',
      product_grid: '2-col',
      sidebar: false,
      footer_style: 'minimal'
    },
    theme: 'minimalist'
  },
  {
    id: 'product-immersive',
    name: 'Immersive Showcase',
    description: 'Full-screen imagery with overlay details - perfect for photography/art',
    category: 'product',
    features: ['Fullscreen images', 'Overlay UI', 'Swipe gallery', 'Lightbox', 'Artist info'],
    layout: {
      header_style: 'full-width',
      product_grid: 'masonry',
      sidebar: false,
      footer_style: 'compact'
    },
    theme: 'elegant'
  },
  {
    id: 'product-comparison',
    name: 'Product Comparison',
    description: 'Side-by-side comparison with variants and specifications',
    category: 'product',
    features: ['Variant comparison', 'Spec table', 'Price matrix', 'Feature checkmarks', 'FAQ'],
    layout: {
      header_style: 'split',
      product_grid: '2-col',
      sidebar: true,
      footer_style: 'detailed'
    },
    theme: 'professional'
  },

  // LANDING PAGE TEMPLATES
  {
    id: 'landing-launch',
    name: 'Product Launch',
    description: 'High-converting launch page with countdown and early access',
    category: 'landing',
    features: ['Hero video/image', 'Countdown timer', 'Email capture', 'Benefits', 'CTA buttons'],
    layout: {
      header_style: 'full-width',
      product_grid: 'carousel',
      sidebar: false,
      footer_style: 'minimal'
    },
    theme: 'vibrant'
  },
  {
    id: 'landing-fundraiser',
    name: 'Fundraiser Campaign',
    description: 'Mission-driven page with progress bar and impact stories',
    category: 'landing',
    features: ['Progress bar', 'Impact stories', 'Team members', 'Donation tiers', 'Updates feed'],
    layout: {
      header_style: 'banner',
      product_grid: '3-col',
      sidebar: false,
      footer_style: 'detailed'
    },
    theme: 'warm'
  }
];

interface StoreTemplateSelectorProps {
  category?: 'storefront' | 'product' | 'landing' | 'all';
  currentTemplateId?: string;
  onSelectTemplate: (template: StoreTemplate) => void;
}

const StoreTemplateSelector: React.FC<StoreTemplateSelectorProps> = ({
  category = 'all',
  currentTemplateId,
  onSelectTemplate
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'storefront' | 'product' | 'landing' | 'all'>(category);
  const [previewTemplate, setPreviewTemplate] = useState<StoreTemplate | null>(null);

  const filteredTemplates = selectedCategory === 'all'
    ? STORE_TEMPLATES
    : STORE_TEMPLATES.filter(t => t.category === selectedCategory);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'storefront': return <ShoppingBag className="h-5 w-5" />;
      case 'product': return <Package className="h-5 w-5" />;
      case 'landing': return <Sparkles className="h-5 w-5" />;
      default: return <LayoutGrid className="h-5 w-5" />;
    }
  };

  const getLayoutIcon = (grid: string) => {
    switch (grid) {
      case '2-col': return <Columns className="h-4 w-4" />;
      case '3-col': case '4-col': return <LayoutGrid className="h-4 w-4" />;
      case 'masonry': return <Maximize2 className="h-4 w-4" />;
      case 'carousel': return <List className="h-4 w-4" />;
      default: return <LayoutGrid className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'storefront', 'product', 'landing'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedCategory === cat
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {getCategoryIcon(cat)}
            <span className="capitalize">{cat === 'all' ? 'All Templates' : `${cat}s`}</span>
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const isSelected = template.id === currentTemplateId;
          
          return (
            <div
              key={template.id}
              className={`bg-white rounded-xl shadow-md overflow-hidden border-2 transition-all hover:shadow-xl ${
                isSelected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200'
              }`}
            >
              {/* Preview Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                {getCategoryIcon(template.category)}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Heart className="h-3 w-3 fill-current" /> Current
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900">{template.name}</h3>
                  <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-1 rounded">
                    {template.category}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3">{template.description}</p>

                {/* Layout Info */}
                <div className="flex gap-2 mb-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                    {getLayoutIcon(template.layout.product_grid)}
                    {template.layout.product_grid}
                  </span>
                  {template.layout.sidebar && (
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Sidebar</span>
                  )}
                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded capitalize">
                    {template.theme}
                  </span>
                </div>

                {/* Features */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.features.slice(0, 3).map((feature, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {feature}
                      </span>
                    ))}
                    {template.features.length > 3 && (
                      <span className="text-xs text-gray-500">+{template.features.length - 3} more</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewTemplate(template)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => onSelectTemplate(template)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                      isSelected
                        ? 'bg-gray-200 text-gray-600 cursor-default'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                    disabled={isSelected}
                  >
                    {isSelected ? 'Active' : 'Use Template'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{previewTemplate.name}</h2>
                  <p className="text-gray-600">{previewTemplate.description}</p>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Full Feature List */}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">All Features:</h3>
                <ul className="grid grid-cols-2 gap-2">
                  {previewTemplate.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Layout Details */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Layout Configuration:</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Header Style:</span>
                    <span className="font-medium capitalize">{previewTemplate.layout.header_style}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product Grid:</span>
                    <span className="font-medium">{previewTemplate.layout.product_grid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sidebar:</span>
                    <span className="font-medium">{previewTemplate.layout.sidebar ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Footer Style:</span>
                    <span className="font-medium capitalize">{previewTemplate.layout.footer_style}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Theme:</span>
                    <span className="font-medium capitalize">{previewTemplate.theme}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onSelectTemplate(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                >
                  Use This Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreTemplateSelector;
export { STORE_TEMPLATES };
export type { StoreTemplate };

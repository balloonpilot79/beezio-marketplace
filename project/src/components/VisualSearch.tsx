import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Search, Loader2, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';

interface VisualSearchProps {
  onResultsFound?: (products: any[]) => void;
  className?: string;
}

interface SearchResult {
  id: string;
  title: string;
  price: number;
  images: string[];
  similarity_score?: number;
  seller_name?: string;
}

const VisualSearch: React.FC<VisualSearchProps> = ({ onResultsFound, className = '' }) => {
  const { user } = useAuth();
  const { trackClick, trackSearch } = useBehaviorTracker();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Image must be less than 10MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const performVisualSearch = async () => {
    if (!selectedImage) return;

    setIsSearching(true);
    setError('');

    try {
      // Track visual search
      trackSearch('visual_search', {
        file_size: selectedImage.size,
        file_type: selectedImage.type
      });

      // Upload image to Supabase storage
      const fileName = `visual-search/${Date.now()}_${selectedImage.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, selectedImage);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      // Call our visual search function
      const { data: searchResults, error: searchError } = await supabase
        .rpc('visual_search_products', {
          search_image_url: publicUrl,
          similarity_threshold: 0.3,
          max_results: 20
        });

      if (searchError) throw searchError;

      // Format results
      const formattedResults: SearchResult[] = searchResults.map((result: any) => ({
        id: result.id,
        title: result.title,
        price: result.price,
        images: result.images || [],
        similarity_score: result.similarity_score,
        seller_name: result.seller_name
      }));

      setResults(formattedResults);
      onResultsFound?.(formattedResults);

      // Clean up uploaded search image after a delay
      setTimeout(async () => {
        await supabase.storage.from('images').remove([fileName]);
      }, 60000); // Clean up after 1 minute

    } catch (error: any) {
      console.error('Visual search error:', error);
      setError(error.message || 'An error occurred during visual search');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    setResults([]);
    setError('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const openModal = () => {
    trackClick('visual_search_open');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    clearSearch();
  };

  return (
    <>
      {/* Visual Search Trigger Button */}
      <button
        onClick={openModal}
        className={`inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors ${className}`}
      >
        <Camera className="w-4 h-4" />
        <span>Search by Image</span>
      </button>

      {/* Visual Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Visual Search</h2>
                <p className="text-gray-600 mt-1">Upload an image to find similar products</p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Image Upload Area */}
              {!selectedImage && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-purple-400 transition-colors"
                >
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <Upload className="w-12 h-12 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        Drag and drop an image here
                      </p>
                      <p className="text-gray-600 mt-1">
                        or click to browse your files
                      </p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Choose Image
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <p className="text-sm text-gray-500">
                      Supported formats: JPG, PNG, GIF (max 10MB)
                    </p>
                  </div>
                </div>
              )}

              {/* Image Preview & Search */}
              {selectedImage && (
                <div className="space-y-6">
                  <div className="flex items-start space-x-6">
                    {/* Image Preview */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <img
                          src={previewUrl}
                          alt="Search preview"
                          className="w-64 h-64 object-cover rounded-lg border"
                        />
                        <button
                          onClick={clearSearch}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Search Controls */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Ready to search
                        </h3>
                        <p className="text-gray-600">
                          We'll analyze your image and find similar products in our marketplace.
                        </p>
                      </div>

                      <button
                        onClick={performVisualSearch}
                        disabled={isSearching}
                        className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isSearching ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Searching...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-5 h-5" />
                            <span>Find Similar Products</span>
                          </>
                        )}
                      </button>

                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-700 text-sm">{error}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Search Results */}
                  {results.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold text-gray-900">
                          Similar Products ({results.length})
                        </h3>
                        <div className="text-sm text-gray-600">
                          Sorted by visual similarity
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.map((product) => (
                          <div
                            key={product.id}
                            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                          >
                            <div className="aspect-square">
                              <img
                                src={product.images[0] || '/placeholder-image.jpg'}
                                alt={product.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-4">
                              <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                                {product.title}
                              </h4>
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-bold text-purple-600">
                                  ${product.price.toFixed(2)}
                                </span>
                                {product.similarity_score && (
                                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                                    <Eye className="w-3 h-3" />
                                    <span>{Math.round(product.similarity_score * 100)}% match</span>
                                  </div>
                                )}
                              </div>
                              {product.seller_name && (
                                <p className="text-sm text-gray-600 mt-1">
                                  by {product.seller_name}
                                </p>
                              )}
                              <button
                                onClick={() => {
                                  trackClick('visual_search_result_click', {
                                    product_id: product.id,
                                    similarity_score: product.similarity_score
                                  });
                                  window.open(`/product/${product.id}`, '_blank');
                                }}
                                className="w-full mt-3 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
                              >
                                View Product
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSearching && (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-4" />
                      <p className="text-gray-600">Analyzing your image and finding similar products...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VisualSearch;

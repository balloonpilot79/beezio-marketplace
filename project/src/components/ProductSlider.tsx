import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { getRandomProducts, SampleProduct } from '../data/sampleProducts';
import { isProductSampleDataEnabled } from '../config/sampleDataConfig';

const ProductSlider: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [products, setProducts] = useState<SampleProduct[]>([]);
  const itemsPerView = 3;

  useEffect(() => {
    // Load sample products if enabled
    const sampleProducts = getRandomProducts(12); // Get 12 random products
    setProducts(sampleProducts);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev + itemsPerView >= products.length ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? Math.max(0, products.length - itemsPerView) : prev - 1
    );
  };

  useEffect(() => {
    if (products.length === 0) return;
    
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [products.length]);

  // Don't render if sample data is disabled or no products
  if (!isProductSampleDataEnabled() || products.length === 0) {
    return null;
  }

  const visibleProducts = products.slice(currentIndex, currentIndex + itemsPerView);
  if (visibleProducts.length < itemsPerView && products.length >= itemsPerView) {
    visibleProducts.push(...products.slice(0, itemsPerView - visibleProducts.length));
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-amber-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Navigation Buttons */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mx-12">
            {visibleProducts.map((product, index) => (
              <div
                key={`${product.id}-${index}`}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.src = '/api/placeholder/300/200';
                    }}
                  />
                  <div className="absolute top-4 right-4">
                    <span className="bg-amber-500 text-white px-2 py-1 rounded-full text-sm font-medium">
                      {product.category}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                      by {product.seller}
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2">
                    {product.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-700">{product.rating}</span>
                      <span className="text-xs text-gray-500">({product.reviews.toLocaleString()})</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${product.price}
                    </div>
                  </div>
                  
                  <button className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-white py-2 px-4 rounded-lg font-medium hover:from-amber-600 hover:to-yellow-700 transition-all duration-200 transform hover:scale-105">
                    View Product
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 space-x-2">
          {Array.from({ length: Math.ceil(products.length / itemsPerView) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index * itemsPerView)}
              className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                Math.floor(currentIndex / itemsPerView) === index
                  ? 'bg-amber-500'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductSlider;

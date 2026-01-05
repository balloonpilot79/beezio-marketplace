import { useState, useEffect } from 'react';
import { Grid, List, Search, Star, Heart, ShoppingCart, Users, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SAMPLE_PRODUCTS } from '../lib/sampleData';
import StarRating from '../components/StarRating';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  description?: string;
  commission_rate: number;
  category?: string;
  profiles?: {
    full_name: string;
  };
  average_rating?: number;
  review_count?: number;
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high' | 'popular' | 'commission'>('newest');
  const [affiliateRef, setAffiliateRef] = useState<string | null>(null);
  const { user } = useAuth();

  // Check for affiliate reference on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref') || localStorage.getItem('affiliate_ref');
    if (ref) {
      setAffiliateRef(ref);
      localStorage.setItem('affiliate_ref', ref);
    }
  }, []);

  const marketplaceStats = {
    totalProducts: 1247,
    activeSellers: 156,
    totalSales: 8934,
    averageRating: 4.8
  };

  const categories = [
    'All Categories',
    'Electronics',
    'Clothing & Fashion',
    'Home & Garden',
    'Books & Media',
    'Digital Products',
    'Food & Beverage',
    'Beauty & Personal Care',
    'Sports & Outdoors',
    'Toys & Games',
    'Art & Crafts',
    'Automotive',
    'Health & Wellness'
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, priceRange, sortBy]);

  const filterProducts = () => {
    let filtered = [...products];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory && selectedCategory !== 'All Categories') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by price range
    filtered = filtered.filter(product => 
      product.price >= priceRange[0] && product.price <= priceRange[1]
    );

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'commission':
          return b.commission_rate - a.commission_rate;
        case 'popular':
          return (b.review_count || 0) - (a.review_count || 0);
        default: // newest
          return new Date(b.id).getTime() - new Date(a.id).getTime();
      }
    });

    setFilteredProducts(filtered);
  };

  const fetchProducts = async () => {
    try {
      // Load sample data immediately
      setProducts(SAMPLE_PRODUCTS);
      setLoading(false);
      
      // Try to fetch from Supabase in background
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            profiles:seller_id (
              full_name
            )
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          setProducts(data);
        }
      } catch (supabaseError) {
        console.log('Supabase error (using sample data):', supabaseError);
      }
    } catch (error) {
      console.log('Error in fetchProducts:', error);
      setProducts(SAMPLE_PRODUCTS);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Marketplace Landing */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Discover Amazing Products
            </h1>
            <p className="text-xl mb-8 text-purple-100">
              Shop from local sellers, support your community, and earn rewards through our affiliate network
            </p>
            
            {/* Marketplace Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
              <div className="text-center">
                <div className="text-3xl font-bold">{marketplaceStats.totalProducts.toLocaleString()}</div>
                <div className="text-purple-200">Products</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{marketplaceStats.activeSellers}</div>
                <div className="text-purple-200">Active Sellers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{marketplaceStats.totalSales.toLocaleString()}</div>
                <div className="text-purple-200">Orders Completed</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-400 fill-current mr-1" />
                  <div className="text-3xl font-bold">{marketplaceStats.averageRating}</div>
                </div>
                <div className="text-purple-200">Average Rating</div>
              </div>
            </div>

            {/* Affiliate Status */}
            {affiliateRef ? (
              <div className="mt-8 bg-green-600 bg-opacity-20 border border-green-300 text-green-100 px-6 py-4 rounded-lg inline-block">
                <div className="flex items-center">
                  <Award className="w-5 h-5 mr-2" />
                  <span className="font-medium">🎉 Shopping through affiliate link!</span>
                </div>
                <p className="text-sm mt-1">Your purchases support your referrer while you shop.</p>
              </div>
            ) : !user && (
              <div className="mt-8 bg-blue-600 bg-opacity-20 border border-blue-300 text-blue-100 px-6 py-4 rounded-lg inline-block">
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  <span className="font-medium">Join our affiliate network and start earning!</span>
                </div>
                <Link to="/start-earning" className="text-sm mt-1 underline hover:text-white">
                  Learn how to earn commissions →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search and Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            {/* Filters */}
            <div className="flex gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {categories.map((category) => (
                  <option key={category} value={category === 'All Categories' ? '' : category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="popular">Most Popular</option>
                <option value="commission">Highest Commission</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {selectedCategory ? `${selectedCategory} Products` : 'All Products'}
            <span className="text-lg text-gray-500 ml-2">({filteredProducts.length})</span>
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className={`grid gap-6 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
            : 'grid-cols-1'
        }`}>
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              viewMode={viewMode}
              affiliateRef={affiliateRef}
            />
          ))}
        </div>

        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setPriceRange([0, 1000]);
              }}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Call to Action for Sellers/Affiliates */}
        <section className="mt-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Selling or Earning?</h2>
          <p className="text-xl mb-6 text-orange-100">Join our marketplace and turn your products or influence into income</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/start-earning" 
              className="bg-white text-orange-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Become an Affiliate
            </Link>
            {!user && (
              <Link 
                to="/dashboard" 
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-orange-600 transition-colors"
              >
                Start Selling
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ProductCard Component
interface ProductCardProps {
  product: Product & { badge?: string; originalPrice?: number };
  viewMode: 'grid' | 'list';
  affiliateRef: string | null;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, affiliateRef }) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex">
          <div className="w-48 h-36 relative">
            <img 
              src={product.images?.[0] || '/api/placeholder/300/200'} 
              alt={product.title}
              className="w-full h-full object-cover"
            />
            {product.badge && (
              <span className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 text-xs rounded-full">
                {product.badge}
              </span>
            )}
          </div>
          
          <div className="flex-1 p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 text-lg">{product.title}</h3>
              <button className="text-gray-400 hover:text-red-500">
                <Heart className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center mb-2">
              <StarRating rating={product.average_rating || 4.5} size="sm" />
              <span className="text-sm text-gray-600 ml-2">({product.review_count || 0})</span>
            </div>
            
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold text-gray-900">${product.price}</span>
                <span className="text-sm text-green-600 font-medium">{product.commission_rate}% commission</span>
              </div>
              <Link 
                to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                View Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
      <div className="relative">
        <img 
          src={product.images?.[0] || '/api/placeholder/300/200'} 
          alt={product.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.badge && (
          <span className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 text-xs rounded-full">
            {product.badge}
          </span>
        )}
        <span className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 text-xs rounded-full">
          {product.commission_rate}% commission
        </span>
        <button className="absolute top-2 right-2 text-white hover:text-red-300 bg-black bg-opacity-20 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Heart className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.title}</h3>
        
        <div className="flex items-center mb-2">
          <StarRating rating={product.average_rating || 4.5} size="sm" />
          <span className="text-sm text-gray-600 ml-2">({product.review_count || 0})</span>
        </div>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-gray-900">${product.price}</span>
            {product.originalPrice && (
              <span className="text-sm text-gray-500 line-through">${product.originalPrice}</span>
            )}
          </div>
          <span className="text-xs text-gray-500">({product.review_count || 0} reviews)</span>
        </div>
        
        <div className="text-xs text-gray-600 mb-3">by {product.profiles?.full_name}</div>
        
        <Link 
          to={`/product/${product.id}${affiliateRef ? `?ref=${affiliateRef}` : ''}`}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          View Details
        </Link>
      </div>
    </div>
  );
};

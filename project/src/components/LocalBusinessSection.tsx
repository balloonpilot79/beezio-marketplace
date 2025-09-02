import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, Clock, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LocalBusiness {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  seller_id: string;
  is_active: boolean;
  profiles?: {
    full_name: string;
    location?: string;
    phone?: string;
  };
}

const LocalBusinessSection: React.FC = () => {
  const [businesses, setBusinesses] = useState<LocalBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocalBusinesses();
  }, []);

  const fetchLocalBusinesses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles:seller_id (
            full_name,
            location,
            phone
          )
        `)
        .eq('is_active', true)
        .not('profiles.location', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) {
        if (error.message.includes('Invalid API key')) {
          setError('Supabase connection not configured. Please set up your credentials.');
        } else {
          setError(`Error loading local businesses: ${error.message}`);
        }
        console.error('Error fetching local businesses:', error.message);
        return;
      }

      setBusinesses(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to load local businesses: ${errorMessage}`);
      console.error('Error fetching local businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-300 aspect-video rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Local Businesses</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-yellow-800 text-sm">{error}</p>
              <p className="text-yellow-600 text-xs mt-2">
                Check your Supabase configuration in the .env file
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {businesses.map((business) => (
          <div key={business.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow group">
            <Link to={`/product/${business.id}`} className="block">
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={business.images[0] || 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=500'}
                  alt={business.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold">
                  LOCAL
                </div>
              </div>
            </Link>

            <div className="p-4">
              <Link to={`/product/${business.id}`}>
                <h3 className="font-semibold text-gray-900 mb-2 hover:text-amber-600 transition-colors line-clamp-1">
                  {business.title}
                </h3>
              </Link>
              
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-amber-600">
                  ${business.price}
                </span>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-600">4.5</span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {business.description}
              </p>

              <div className="space-y-2">
                {business.profiles?.location && (
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <MapPin className="h-3 w-3" />
                    <span className="line-clamp-1">{business.profiles.location}</span>
                  </div>
                )}
                
                {business.profiles?.phone && (
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Phone className="h-3 w-3" />
                    <span>{business.profiles.phone}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  by {business.profiles?.full_name || 'Business Owner'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {businesses.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No local businesses found</p>
          <Link
            to="/dashboard/products/add"
            className="inline-block mt-4 bg-amber-500 text-white px-6 py-2 rounded-lg hover:bg-amber-600 transition-colors"
          >
            Add Your Business
          </Link>
        </div>
      )}

      {businesses.length > 0 && (
        <div className="text-center">
          <Link
            to="/products"
            className="inline-block bg-amber-500 text-white px-6 py-3 rounded-lg hover:bg-amber-600 transition-colors"
          >
            View All Local Businesses
          </Link>
        </div>
      )}
    </div>
  );
};

export default LocalBusinessSection;
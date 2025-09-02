import React, { useState, useEffect } from 'react';
import { Truck, Clock, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ShippingOption {
  id: string;
  name: string;
  cost: number;
  estimated_days: string;
}

interface ShippingSelectorProps {
  productId: string;
  onShippingChange: (option: ShippingOption | null) => void;
  selectedShipping?: ShippingOption | null;
}

const ShippingSelector: React.FC<ShippingSelectorProps> = ({
  productId,
  onShippingChange,
  selectedShipping
}) => {
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShippingOptions();
  }, [productId]);

  const fetchShippingOptions = async () => {
    try {
      setLoading(true);
      
      // Fetch shipping options from the product
      const { data: product, error } = await supabase
        .from('products')
        .select('shipping_options, requires_shipping')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product shipping options:', error);
        return;
      }

      if (!product?.requires_shipping) {
        // Digital product - no shipping needed
        setShippingOptions([]);
        onShippingChange(null);
        return;
      }

      const options: ShippingOption[] = (product.shipping_options || []).map((option: any, index: number) => ({
        id: `shipping-${index}`,
        name: option.name || 'Standard Shipping',
        cost: option.cost || 0,
        estimated_days: option.estimated_days || '3-5 business days'
      }));

      // If no shipping options are configured, provide a default
      if (options.length === 0) {
        options.push({
          id: 'default',
          name: 'Standard Shipping',
          cost: 5.99,
          estimated_days: '5-7 business days'
        });
      }
      
      setShippingOptions(options);
      
      // Auto-select the first option if none is selected
      if (!selectedShipping && options.length > 0) {
        onShippingChange(options[0]);
      }
    } catch (error) {
      console.error('Error fetching shipping options:', error);
      
      // Fallback to default shipping option
      const fallbackOption: ShippingOption = {
        id: 'fallback',
        name: 'Standard Shipping',
        cost: 5.99,
        estimated_days: '5-7 business days'
      };
      
      setShippingOptions([fallbackOption]);
      onShippingChange(fallbackOption);
    } finally {
      setLoading(false);
    }
  };

  const handleShippingSelect = (option: ShippingOption) => {
    onShippingChange(option);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (shippingOptions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600 text-sm">No shipping options available for this product.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <Truck className="h-5 w-5 mr-2 text-gray-600" />
        Choose Shipping Method
      </h3>
      
      <div className="space-y-2">
        {shippingOptions.map((option) => (
          <div
            key={option.id}
            onClick={() => handleShippingSelect(option)}
            className={`
              relative cursor-pointer border rounded-lg p-4 transition-all
              ${selectedShipping?.id === option.id
                ? 'border-amber-500 bg-amber-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="shipping"
                  checked={selectedShipping?.id === option.id}
                  onChange={() => handleShippingSelect(option)}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-gray-900">{option.name}</h4>
                    {option.cost === 0 && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                        FREE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      {option.estimated_days}
                    </span>
                    <span className="flex items-center text-sm font-medium text-gray-900">
                      <DollarSign className="h-4 w-4 mr-1" />
                      {option.cost === 0 ? 'Free' : `$${option.cost.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Selected indicator */}
            {selectedShipping?.id === option.id && (
              <div className="absolute top-2 right-2">
                <div className="bg-amber-500 text-white rounded-full p-1">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {selectedShipping && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Selected:</strong> {selectedShipping.name} 
            {selectedShipping.cost > 0 && ` (+$${selectedShipping.cost.toFixed(2)})`}
            <br />
            <strong>Estimated Delivery:</strong> {selectedShipping.estimated_days}
          </p>
        </div>
      )}
    </div>
  );
};

export default ShippingSelector;

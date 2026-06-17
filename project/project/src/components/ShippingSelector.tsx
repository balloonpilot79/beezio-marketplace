import React, { useState, useEffect } from 'react';
import { Truck, Clock, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatShippingDisplay, isFreeShippingValue } from '../utils/moneyDisplay';

interface ShippingOption {
  id: string;
  name: string;
  cost: number;
  estimated_days: string;
  origin_country?: string;
  origin_label?: string;
  processing_time?: string;
  included_in_price?: boolean;
}

interface ShippingSelectorProps {
  productId: string;
  onShippingChange: (option: ShippingOption | null) => void;
  selectedShipping?: ShippingOption | null;
}

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseRawShippingOptions = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const extractMissingColumnName = (message: string): string | null => {
  const quoted = message.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
  if (quoted?.[1]) return quoted[1].split('.').pop() || quoted[1];
  const unquoted = message.match(/column\s+([a-z0-9_.]+)\s+does\s+not\s+exist/i);
  if (unquoted?.[1]) return unquoted[1].split('.').pop() || unquoted[1];
  const pgrst = message.match(/Could not find the '([^']+)' column/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const normalizeShippingOption = (option: any, index: number): ShippingOption => ({
  id: `shipping-${index}`,
  name: String(option?.name ?? option?.title ?? 'Shipping').trim() || 'Shipping',
  cost: toFiniteNumber(option?.cost ?? option?.price ?? option?.shipping_price ?? option?.shippingPrice),
  estimated_days: String(option?.estimated_days ?? option?.days ?? option?.estimatedDays ?? '3-5 business days').trim() || '3-5 business days',
  origin_country: typeof option?.origin_country === 'string' ? option.origin_country : undefined,
  origin_label: typeof option?.origin_label === 'string' ? option.origin_label : undefined,
  processing_time: typeof option?.processing_time === 'string' ? option.processing_time : undefined,
  included_in_price: option?.included_in_price === true,
});

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

      try {
        const response = await fetch(`/api/public/product/get?id=${encodeURIComponent(productId)}`);
        if (response.ok) {
          const payload = await response.json().catch(() => ({}));
          const publicProduct = payload?.product;
          if (publicProduct) {
            if (!publicProduct?.requires_shipping) {
              setShippingOptions([]);
              onShippingChange(null);
              return;
            }

            const rawOptions: ShippingOption[] = parseRawShippingOptions(publicProduct.shipping_options).map(normalizeShippingOption);
            const normalizedShippingPrice = toFiniteNumber(publicProduct?.shipping_price ?? publicProduct?.shipping_cost ?? 0);
            const includedOption = rawOptions.find((option) => option.included_in_price === true);
            const effectiveCost = includedOption ? 0 : normalizedShippingPrice;
            const options: ShippingOption[] = [{
              id: includedOption?.id || rawOptions[0]?.id || 'default',
              name: includedOption ? 'Free Shipping' : 'Seller Shipping',
              cost: effectiveCost,
              estimated_days: includedOption?.estimated_days || rawOptions[0]?.estimated_days || '3-5 business days',
              origin_country: includedOption?.origin_country || rawOptions[0]?.origin_country,
              origin_label: includedOption?.origin_label || rawOptions[0]?.origin_label,
              processing_time: includedOption?.processing_time || rawOptions[0]?.processing_time,
              included_in_price: Boolean(includedOption),
            }];

            setShippingOptions(options);
            if (!selectedShipping && options.length > 0) {
              onShippingChange(options[0]);
            }
            return;
          }
        }
      } catch {
        // fall back to direct query below
      }

      let selectedColumns = ['shipping_options', 'requires_shipping', 'shipping_price', 'shipping_cost'];
      let product: any = null;
      let error: any = null;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const result = await supabase
          .from('products')
          .select(selectedColumns.join(','))
          .eq('id', productId)
          .single();

        if (!result.error) {
          product = result.data;
          error = null;
          break;
        }

        error = result.error;
        const missingColumn = extractMissingColumnName(String(result.error?.message || ''));
        if (missingColumn && selectedColumns.includes(missingColumn)) {
          selectedColumns = selectedColumns.filter((column) => column !== missingColumn);
          continue;
        }

        break;
      }

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

      const rawOptions: ShippingOption[] = parseRawShippingOptions(product.shipping_options).map(normalizeShippingOption);

      const normalizedShippingPrice = toFiniteNumber(product?.shipping_price ?? product?.shipping_cost ?? 0);
      const includedOption = rawOptions.find((option) => option.included_in_price === true);
      const effectiveCost = includedOption ? 0 : normalizedShippingPrice;
      const options: ShippingOption[] = [{
        id: includedOption?.id || rawOptions[0]?.id || 'default',
        name: includedOption ? 'Free Shipping' : 'Seller Shipping',
        cost: effectiveCost,
        estimated_days: includedOption?.estimated_days || rawOptions[0]?.estimated_days || '3-5 business days',
        origin_country: includedOption?.origin_country || rawOptions[0]?.origin_country,
        origin_label: includedOption?.origin_label || rawOptions[0]?.origin_label,
        processing_time: includedOption?.processing_time || rawOptions[0]?.processing_time,
        included_in_price: Boolean(includedOption),
      }];
      
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
        name: 'Free Shipping',
        cost: 0,
        estimated_days: '3-5 business days'
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
        Shipping
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
                    {isFreeShippingValue(option.cost) && (
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
                      {formatShippingDisplay(option.cost)}
                    </span>
                  </div>
                  {(option.origin_label || option.origin_country || option.processing_time) && (
                    <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                      {(option.origin_label || option.origin_country) && (
                        <div>
                          Ships from: {option.origin_label || option.origin_country}
                        </div>
                      )}
                      {option.processing_time && (
                        <div>
                          Processing: {option.processing_time}
                        </div>
                      )}
                    </div>
                  )}
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
            {` (${formatShippingDisplay(selectedShipping.cost)})`}
            <br />
            <strong>Estimated Delivery:</strong> {selectedShipping.estimated_days}
            {(selectedShipping.origin_label || selectedShipping.origin_country) && (
              <>
                <br />
                <strong>Ships From:</strong> {selectedShipping.origin_label || selectedShipping.origin_country}
              </>
            )}
            {selectedShipping.processing_time && (
              <>
                <br />
                <strong>Processing:</strong> {selectedShipping.processing_time}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default ShippingSelector;

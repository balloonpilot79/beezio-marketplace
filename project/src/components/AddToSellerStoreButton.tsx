import React, { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

interface AddToSellerStoreButtonProps {
  productId: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon';
}

const AddToSellerStoreButton: React.FC<AddToSellerStoreButtonProps> = ({
  productId,
  size = 'md',
  variant = 'button',
}) => {
  const { profile } = useAuth();
  const sellerProfileId = profile?.id;
  const isSeller = profile?.role === 'seller';

  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sellerProfileId || !isSeller) return;

    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('seller_product_order')
          .select('product_id')
          .eq('seller_id', sellerProfileId)
          .eq('product_id', productId)
          .maybeSingle();

        if (!mounted) return;
        if (error) throw error;
        setIsAdded(Boolean(data));
      } catch (e) {
        console.error('[AddToSellerStoreButton] check failed', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sellerProfileId, isSeller, productId]);

  const handleAdd = async () => {
    if (!sellerProfileId || !isSeller) {
      alert('Please switch to a seller account to add products to your store.');
      return;
    }

    try {
      setIsLoading(true);

      // Best-effort display order: append to end
      const { count } = await supabase
        .from('seller_product_order')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerProfileId);

      const displayOrder = typeof count === 'number' ? count : 0;

      const { error } = await supabase
        .from('seller_product_order')
        .upsert(
          {
            seller_id: sellerProfileId,
            product_id: productId,
            display_order: displayOrder,
            is_featured: false,
          },
          { onConflict: 'seller_id,product_id' }
        );

      if (error) throw error;
      setIsAdded(true);
    } catch (e) {
      console.error('[AddToSellerStoreButton] add failed', e);
      alert('Unable to add that product right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!sellerProfileId || !isSeller) return;

    if (!confirm('Remove this product from your seller storefront?')) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('seller_product_order')
        .delete()
        .eq('seller_id', sellerProfileId)
        .eq('product_id', productId);

      if (error) throw error;
      setIsAdded(false);
    } catch (e) {
      console.error('[AddToSellerStoreButton] remove failed', e);
      alert('Unable to remove that product right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  if (!isSeller) return null;

  if (variant === 'icon') {
    return (
      <button
        onClick={isAdded ? handleRemove : handleAdd}
        disabled={isLoading}
        title={isAdded ? 'Remove from My Store' : 'Add to My Store'}
        className={
          `h-10 w-10 rounded-full flex items-center justify-center border shadow-sm transition-colors ` +
          (isAdded
            ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
            : 'bg-white border-gray-200 text-gray-900 hover:border-[#ffcb05]')
        }
      >
        {isAdded ? <Check size={iconSize} /> : <Plus size={iconSize} />}
      </button>
    );
  }

  return (
    <button
      onClick={isAdded ? handleRemove : handleAdd}
      disabled={isLoading}
      className={
        `inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold border transition-colors ` +
        (isAdded
          ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
          : 'bg-white border-gray-300 text-gray-900 hover:border-[#ffcb05]')
      }
    >
      {isAdded ? <X size={iconSize} /> : <Plus size={iconSize} />}
      {isAdded ? 'Remove' : 'Add to My Store'}
    </button>
  );
};

export default AddToSellerStoreButton;

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';

interface ImageUploaderProps {
  currentImageUrl?: string;
  onImageUpload: (url: string) => void;
  bucketName?: string;
  folderPath?: string;
  label?: string;
  aspectRatio?: 'banner' | 'logo' | 'product';
}

export default function ImageUploader({
  currentImageUrl,
  onImageUpload,
  bucketName = 'store-banners',
  folderPath = 'uploads',
  label = 'Upload Image',
  aspectRatio = 'logo'
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const aspectRatioClasses = {
    banner: 'aspect-[3/1]',
    logo: 'aspect-square',
    product: 'aspect-square'
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, GIF, WebP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess(false);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${folderPath}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

      onImageUpload(publicUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      
      // Check if storage bucket exists
      if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
        setError('Storage bucket not configured. Using direct URL input instead.');
        // Fallback to URL input
        const urlInput = prompt('Storage not available. Enter image URL:');
        if (urlInput) {
          onImageUpload(urlInput);
          setSuccess(true);
        }
      } else {
        setError(`Upload failed: ${err.message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    onImageUpload('');
    setSuccess(false);
  };

  const handleUrlInput = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      onImageUpload(url);
      setSuccess(true);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block font-semibold text-gray-700">{label}</label>
      
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">×</button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Image uploaded successfully!</span>
        </div>
      )}

      {currentImageUrl ? (
        <div className="relative">
          <div className={`${aspectRatioClasses[aspectRatio]} w-full max-w-md border rounded-lg overflow-hidden bg-gray-100`}>
            <img 
              src={currentImageUrl} 
              alt="Preview" 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/api/placeholder/400/400';
              }}
            />
          </div>
          <button
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={`${aspectRatioClasses[aspectRatio]} w-full max-w-md border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors`}>
            <label className="cursor-pointer flex flex-col items-center gap-2 p-6">
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-600">
                {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </span>
              <span className="text-xs text-gray-500">PNG, JPG, GIF, WebP up to 5MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-xs text-gray-500">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>
          
          <button
            onClick={handleUrlInput}
            type="button"
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
          >
            Enter Image URL
          </button>
        </div>
      )}
    </div>
  );
}

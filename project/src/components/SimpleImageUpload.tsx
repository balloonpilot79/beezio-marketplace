import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface SimpleImageUploadProps {
  bucket: 'product-images' | 'profile-avatars' | 'store-banners';
  onUploadComplete: (urls: string[]) => void;
  maxFiles?: number;
  maxFileSizeMB?: number;
}

interface UploadStatus {
  id: string;
  fileName: string;
  status: 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

export default function SimpleImageUpload({
  bucket,
  onUploadComplete,
  maxFiles = 5,
  maxFileSizeMB = 10
}: SimpleImageUploadProps) {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);

  const uploadFile = async (file: File): Promise<string> => {
    console.log('🎯 uploadFile called for:', file.name);
    
    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    console.log('📊 File size:', fileSizeMB.toFixed(2), 'MB');
    
    if (fileSizeMB > maxFileSizeMB) {
      throw new Error(`File size ${fileSizeMB.toFixed(1)}MB exceeds maximum ${maxFileSizeMB}MB`);
    }

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be logged in to upload images');
    }

    // Generate unique filename with user ID folder
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    console.log(`📤 Uploading to ${bucket}/${filePath}...`);
    console.log('📦 File type:', file.type);

    try {
      // Direct upload to Supabase
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      console.log('📥 Upload response:', { data, error });

      if (error) {
        console.error('❌ Upload error:', error);
        
        // Retry once with new UUID
        console.log('🔄 Retrying upload with new UUID...');
        const retryFileName = `${uuidv4()}.${fileExt}`;
        const retryPath = `${user.id}/${retryFileName}`;
        
        const { data: retryData, error: retryError } = await supabase.storage
          .from(bucket)
          .upload(retryPath, file, {
            cacheControl: '3600',
            upsert: false
          });

        console.log('📥 Retry response:', { retryData, retryError });

        if (retryError) {
          throw new Error(retryError.message || 'Upload failed after retry');
        }

        // Get public URL for retry
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(retryPath);

        console.log('✅ Upload succeeded on retry:', urlData.publicUrl);
        return urlData.publicUrl;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      console.log('✅ Upload succeeded:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (err: any) {
      console.error('💥 Upload exception:', err);
      throw err;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Check max files
    if (uploads.filter(u => u.status === 'success').length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Create upload status entries
    const newUploads: UploadStatus[] = files.map(file => ({
      id: uuidv4(),
      fileName: file.name,
      status: 'uploading'
    }));

    setUploads(prev => [...prev, ...newUploads]);

    // Upload files sequentially
    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadStatus = newUploads[i];

      try {
        const url = await uploadFile(file);
        
        // Update status to success
        setUploads(prev => prev.map(u => 
          u.id === uploadStatus.id 
            ? { ...u, status: 'success', url }
            : u
        ));

        uploadedUrls.push(url);
      } catch (error: any) {
        console.error('Upload failed:', error);
        
        // Update status to error
        setUploads(prev => prev.map(u => 
          u.id === uploadStatus.id 
            ? { ...u, status: 'error', error: error.message }
            : u
        ));
      }
    }

    // Notify parent component of successful uploads
    if (uploadedUrls.length > 0) {
      onUploadComplete(uploadedUrls);
    }

    // Clear file input
    e.target.value = '';
  };

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="relative">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 font-medium">Click to upload images</p>
            <p className="text-xs text-gray-500 mt-1">
              Max {maxFiles} files, {maxFileSizeMB}MB each
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            multiple
            onChange={handleFileSelect}
          />
        </label>
      </div>

      {/* Upload Status List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map(upload => (
            <div
              key={upload.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Status Icon */}
                {upload.status === 'uploading' && (
                  <div className="flex-shrink-0">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  </div>
                )}
                {upload.status === 'success' && (
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}

                {/* File Name and Status */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {upload.fileName}
                  </p>
                  {upload.status === 'uploading' && (
                    <p className="text-xs text-blue-600">Uploading...</p>
                  )}
                  {upload.status === 'success' && (
                    <p className="text-xs text-green-600">Uploaded ✔</p>
                  )}
                  {upload.status === 'error' && (
                    <p className="text-xs text-red-600">{upload.error}</p>
                  )}
                </div>
              </div>

              {/* Remove Button */}
              {upload.status !== 'uploading' && (
                <button
                  onClick={() => removeUpload(upload.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error Messages */}
      {uploads.some(u => u.status === 'error') && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-medium mb-2">Some uploads failed:</p>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• Check your internet connection</li>
            <li>• Verify file size is under {maxFileSizeMB}MB</li>
            <li>• Ensure Supabase Storage bucket permissions are correct</li>
            <li>• Try uploading again</li>
          </ul>
        </div>
      )}
    </div>
  );
}

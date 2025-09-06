import React, { useState } from 'react';
import { Camera, Upload, User, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onAvatarUpdate: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatarUrl,
  onAvatarUpdate,
  size = 'md',
  className = '',
}) => {
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const uploadAvatar = async (file: File) => {
    if (!user) {
      setError('You must be logged in to upload an avatar');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('File size must be less than 5MB');
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Delete old avatar if exists
      if (currentAvatarUrl && currentAvatarUrl.includes('user-avatars')) {
        const oldPath = currentAvatarUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('user-avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(uploadData.path);

      // Update user profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onAvatarUpdate(publicUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (error) {
      console.error('Avatar upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadAvatar(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeAvatar = async () => {
    if (!user || !currentAvatarUrl) return;

    setUploading(true);
    setError(null);

    try {
      // Delete from storage if it's a Supabase image
      if (currentAvatarUrl.includes('user-avatars')) {
        const fileName = currentAvatarUrl.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('user-avatars')
            .remove([`${user.id}/${fileName}`]);
        }
      }

      // Update profile to remove avatar
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onAvatarUpdate('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (error) {
      console.error('Avatar removal error:', error);
      setError(error instanceof Error ? error.message : 'Removal failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          relative ${sizeClasses[size]} rounded-full overflow-hidden border-4 border-gray-200 
          hover:border-primary-300 transition-all duration-200 group cursor-pointer
          ${uploading ? 'animate-pulse' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Avatar Image or Placeholder */}
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="User avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <User className={`${iconSizes[size]} text-gray-400`} />
          </div>
        )}

        {/* Upload Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {uploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        </div>

        {/* Success Indicator */}
        {success && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-90 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
        )}

        {/* File Input */}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Click or drag to upload avatar"
        />
      </div>

      {/* Upload Button for Mobile */}
      <label className={`
        absolute -bottom-2 -right-2 w-8 h-8 bg-primary-500 hover:bg-primary-600 
        text-white rounded-full flex items-center justify-center cursor-pointer 
        transition-colors duration-200 shadow-lg
        ${uploading ? 'animate-pulse' : ''}
      `}>
        <Upload className="w-4 h-4" />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {/* Remove Button */}
      {currentAvatarUrl && !uploading && (
        <button
          onClick={removeAvatar}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
          title="Remove avatar"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-100 border border-red-300 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      {/* Upload Instructions */}
      <div className="absolute top-full left-0 right-0 mt-1 text-center">
        <p className="text-xs text-gray-500">
          {size === 'lg' ? 'Click or drag to upload' : 'Click to upload'}
        </p>
        <p className="text-xs text-gray-400">
          Max 5MB • JPG, PNG, WebP
        </p>
      </div>
    </div>
  );
};

export default AvatarUpload;

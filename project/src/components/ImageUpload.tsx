import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface ImageUploadProps {
  bucket: 'product-images' | 'user-avatars' | 'store-branding';
  folder?: string;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  onUploadComplete?: (urls: string[]) => void;
  onUploadError?: (error: string) => void;
  className?: string;
  preview?: boolean;
  multiple?: boolean;
  productId?: string; // Added productId field
}

interface UploadingFile {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  bucket,
  folder,
  maxFiles = 5,
  maxFileSize = 10, // MB
  allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  onUploadComplete,
  onUploadError,
  className = '',
  preview = true,
  multiple = true,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `File size ${fileSizeMB.toFixed(1)}MB exceeds maximum ${maxFileSize}MB`;
    }

    return null;
  };

  const generateFileName = (file: File): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const extension = file.name.split('.').pop();
    const userId = user?.id || 'anonymous';
    
    if (folder) {
      return `${userId}/${folder}/${timestamp}-${random}.${extension}`;
    }
    return `${userId}/${timestamp}-${random}.${extension}`;
  };

  const uploadFile = async (file: File): Promise<string> => {
    const fileName = generateFileName(file);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleFileUpload = async (files: File[]) => {
    if (!user) {
      onUploadError?.('You must be logged in to upload files');
      return;
    }

    // Validate file count
    if (uploadingFiles.length + files.length > maxFiles) {
      onUploadError?.(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Create uploading file objects
    const newUploadingFiles: UploadingFile[] = files.map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      progress: 0,
      status: 'uploading',
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload files one by one
    const uploadPromises = newUploadingFiles.map(async (uploadingFile) => {
      try {
        // Validate file
        const validationError = validateFile(uploadingFile.file);
        if (validationError) {
          throw new Error(validationError);
        }

        // Simulate progress (since Supabase doesn't provide upload progress)
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev =>
            prev.map(f =>
              f.id === uploadingFile.id
                ? { ...f, progress: Math.min(f.progress + 10, 90) }
                : f
            )
          );
        }, 200);

        // Upload file
        const url = await uploadFile(uploadingFile.file);

        // Clear progress interval
        clearInterval(progressInterval);

        // Update file status
        setUploadingFiles(prev =>
          prev.map(f =>
            f.id === uploadingFile.id
              ? { ...f, progress: 100, status: 'completed', url }
              : f
          )
        );

        return url;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        console.error('Image upload error:', error);
        
        setUploadingFiles(prev =>
          prev.map(f =>
            f.id === uploadingFile.id
              ? { ...f, status: 'error', error: errorMessage }
              : f
          )
        );

        onUploadError?.(errorMessage);
        return null;
      }
    });

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);
    const successfulUrls = results.filter((url): url is string => url !== null);
    
    if (successfulUrls.length > 0) {
      onUploadComplete?.(successfulUrls);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const removeFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  };

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
        `}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isDragging ? 'Drop files here' : 'Upload Images'}
            </h3>
            <p className="text-gray-600">
              Drag & drop {multiple ? 'images' : 'an image'} here, or click to browse
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Max {maxFiles} files, {maxFileSize}MB each • {allowedTypes.join(', ')}
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="font-semibold text-gray-900">Upload Progress</h4>
          {uploadingFiles.map((file) => (
            <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(file.status)}
                  <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                    {file.file.name}
                  </span>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {file.status === 'uploading' && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}

              {file.status === 'error' && (
                <p className="text-red-600 text-sm">{file.error}</p>
              )}

              {file.status === 'completed' && preview && file.url && (
                <div className="mt-2">
                  <img
                    src={file.url}
                    alt="Uploaded"
                    className="w-20 h-20 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;

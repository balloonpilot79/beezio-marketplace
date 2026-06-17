UPDATE storage.buckets
SET
  public = true,
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800),
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v'
  ]
WHERE id = 'product-images';

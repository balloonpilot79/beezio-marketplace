-- Image Storage System Setup
-- Run this in your Supabase SQL Editor

-- 1. Create product_images table
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    format TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order ON public.product_images(display_order);
CREATE INDEX IF NOT EXISTS idx_product_images_is_primary ON public.product_images(is_primary);

-- 3. Set up Row Level Security (RLS)
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for product_images
CREATE POLICY "Users can view all product images" ON public.product_images
    FOR SELECT USING (true);

CREATE POLICY "Users can insert images for their own products" ON public.product_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE products.id = product_id 
            AND products.seller_id = auth.uid()
        )
    );

CREATE POLICY "Users can update images for their own products" ON public.product_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE products.id = product_id 
            AND products.seller_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete images for their own products" ON public.product_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE products.id = product_id 
            AND products.seller_id = auth.uid()
        )
    );

-- 5. Create storage buckets (run these separately if needed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('product-images', 'product-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('user-avatars', 'user-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('store-branding', 'store-branding', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- 6. Set up storage RLS policies
CREATE POLICY "Public read access for product images" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'product-images' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update their own product images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'product-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own product images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'product-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- User avatars policies
CREATE POLICY "Public read access for user avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own avatars" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own avatars" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Store branding policies
CREATE POLICY "Public read access for store branding" ON storage.objects
    FOR SELECT USING (bucket_id = 'store-branding');

CREATE POLICY "Users can upload their own store branding" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'store-branding' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own store branding" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'store-branding' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own store branding" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'store-branding' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- 7. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for updated_at
CREATE TRIGGER handle_product_images_updated_at
    BEFORE UPDATE ON public.product_images
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 9. Create function to ensure only one primary image per product
CREATE OR REPLACE FUNCTION public.ensure_single_primary_image()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting an image as primary, remove primary flag from other images
    IF NEW.is_primary = true THEN
        UPDATE public.product_images 
        SET is_primary = false 
        WHERE product_id = NEW.product_id 
        AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger for primary image constraint
CREATE TRIGGER ensure_single_primary_image_trigger
    AFTER INSERT OR UPDATE ON public.product_images
    FOR EACH ROW
    WHEN (NEW.is_primary = true)
    EXECUTE FUNCTION public.ensure_single_primary_image();

-- Success message
SELECT 'Image Storage System setup completed successfully!' as status;

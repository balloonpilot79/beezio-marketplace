DROP POLICY "Public can read basic profile info" ON public.profiles;
DROP POLICY "Public profiles are viewable by everyone" ON public.profiles;
NOTIFY pgrst, 'reload schema';

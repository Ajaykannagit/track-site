
CREATE POLICY "site files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'site-files');
CREATE POLICY "site files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-files' AND public.can_write_site());
CREATE POLICY "site files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-files' AND public.can_write_site());
CREATE POLICY "site files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-files' AND public.has_role(auth.uid(),'md'));

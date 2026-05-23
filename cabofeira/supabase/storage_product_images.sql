-- =====================================================================
-- CaboFeira – Storage bucket for product images
-- Run this in the Supabase SQL editor once.
--
-- Path layout: <seller_id>/<uuid>.<ext>
-- RLS: anyone can read; authenticated users can only write inside a
-- folder whose first segment equals their own auth.uid().
-- =====================================================================

-- Public bucket so <img src=...> just works without signed URLs.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Note: storage.objects already has RLS enabled by Supabase by default, and
-- the postgres role cannot ALTER it (it's owned by supabase_storage_admin).
-- We only need to declare the policies below.

drop policy if exists "product_images_select_all"     on storage.objects;
drop policy if exists "product_images_insert_own"    on storage.objects;
drop policy if exists "product_images_update_own"    on storage.objects;
drop policy if exists "product_images_delete_own"    on storage.objects;
drop policy if exists "product_images_delete_admin"  on storage.objects;

-- Anyone can read (bucket is public anyway, but this keeps policy explicit).
create policy "product_images_select_all"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Authenticated users can upload, but only inside their own folder.
create policy "product_images_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can rename / replace their own objects.
create policy "product_images_update_own"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can delete their own objects.
create policy "product_images_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can delete anyone's objects (matches products_delete_admin in schema.sql).
create policy "product_images_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.is_admin()
  );

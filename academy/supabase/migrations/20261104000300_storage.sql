-- Nexora Academy — Storage
-- copertine: pubblico in lettura (immagini dei corsi), percorso "{tenant_id}/..."
-- materiali: privato, percorso "{tenant_id}/{course_id}/{lesson_id}/{file}".
--            Si scarica solo con URL firmato e solo se la lezione è visibile.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('copertine', 'copertine', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('materiali', 'materiali', false, 52428800, null)
on conflict (id) do nothing;

create or replace function private.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;
revoke all on function private.try_uuid(text) from public;
grant execute on function private.try_uuid(text) to anon, authenticated;

create policy copertine_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'copertine'
    and private.is_staff(private.try_uuid((storage.foldername(name))[1]))
  );
create policy copertine_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'copertine'
    and private.is_staff(private.try_uuid((storage.foldername(name))[1]))
  );
create policy copertine_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'copertine'
    and private.is_staff(private.try_uuid((storage.foldername(name))[1]))
  );

create policy materiali_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'materiali'
    and (
      private.is_staff(private.try_uuid((storage.foldername(name))[1]))
      or exists (
        select 1 from public.lesson_resources r
        where r.storage_path = name and private.can_view_lesson(r.lesson_id)
      )
    )
  );
create policy materiali_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materiali'
    and private.is_staff(private.try_uuid((storage.foldername(name))[1]))
  );
create policy materiali_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'materiali'
    and private.is_staff(private.try_uuid((storage.foldername(name))[1]))
  );
create policy materiali_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materiali'
    and private.is_staff(private.try_uuid((storage.foldername(name))[1]))
  );

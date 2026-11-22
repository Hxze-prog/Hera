create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select auth.uid() = '0db78e95-4eb1-4864-9079-5739f38241a1'::uuid;
$$;

create or replace function public.is_her()
returns boolean
language sql
stable
as $$
  select auth.uid() = '090235c3-6244-47f0-9414-8b6fcef1fc19'::uuid;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_her() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_her() to authenticated;

create table if not exists public.envelopes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon text not null default '',
  category text,
  message text not null default '',
  photo_path text,
  voice_path text,
  video_path text,
  song_embed_url text,
  sort_order integer not null default 0,
  is_opened boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text not null default '',
  memory_date date,
  photo_path text,
  voice_path text,
  video_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  icon text not null default '',
  is_redeemed boolean not null default false,
  redeemed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  next_meetup_at timestamptz,
  status_note text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.pings (
  id uuid primary key default gen_random_uuid(),
  pinged_at timestamptz not null default now(),
  mood text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.envelopes enable row level security;
alter table public.memories enable row level security;
alter table public.vouchers enable row level security;
alter table public.app_settings enable row level security;
alter table public.pings enable row level security;

revoke all on public.envelopes from anon;
revoke all on public.memories from anon;
revoke all on public.vouchers from anon;
revoke all on public.app_settings from anon;
revoke all on public.pings from anon;

grant select, insert, update, delete on public.envelopes to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
grant select, insert, update, delete on public.vouchers to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
grant select, insert on public.pings to authenticated;

drop policy if exists "envelopes_read" on public.envelopes;
create policy "envelopes_read" on public.envelopes
  for select to authenticated
  using (public.is_admin() or public.is_her());

drop policy if exists "envelopes_insert" on public.envelopes;
create policy "envelopes_insert" on public.envelopes
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "envelopes_update" on public.envelopes;
create policy "envelopes_update" on public.envelopes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "envelopes_delete" on public.envelopes;
create policy "envelopes_delete" on public.envelopes
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "memories_read" on public.memories;
create policy "memories_read" on public.memories
  for select to authenticated
  using (public.is_admin() or public.is_her());

drop policy if exists "memories_insert" on public.memories;
create policy "memories_insert" on public.memories
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "memories_update" on public.memories;
create policy "memories_update" on public.memories
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "memories_delete" on public.memories;
create policy "memories_delete" on public.memories
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "vouchers_read" on public.vouchers;
create policy "vouchers_read" on public.vouchers
  for select to authenticated
  using (public.is_admin() or public.is_her());

drop policy if exists "vouchers_insert" on public.vouchers;
create policy "vouchers_insert" on public.vouchers
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "vouchers_update_admin" on public.vouchers;
create policy "vouchers_update_admin" on public.vouchers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "vouchers_update_her" on public.vouchers;
create policy "vouchers_update_her" on public.vouchers
  for update to authenticated
  using (public.is_her())
  with check (public.is_her());

drop policy if exists "vouchers_delete" on public.vouchers;
create policy "vouchers_delete" on public.vouchers
  for delete to authenticated
  using (public.is_admin());

create or replace function public.protect_voucher_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.icon is distinct from old.icon
      or new.sort_order is distinct from old.sort_order
      or new.created_at is distinct from old.created_at then
      raise exception 'voucher fields are locked';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_voucher_fields() from public, anon;
grant execute on function public.protect_voucher_fields() to authenticated;

drop trigger if exists protect_voucher_fields on public.vouchers;
create trigger protect_voucher_fields
  before update on public.vouchers
  for each row execute function public.protect_voucher_fields();

create or replace function public.redeem_voucher(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_her()) then
    raise exception 'not allowed';
  end if;
  update public.vouchers
     set is_redeemed = true,
         redeemed_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.redeem_voucher(uuid) from public, anon;
grant execute on function public.redeem_voucher(uuid) to authenticated;

drop policy if exists "settings_read" on public.app_settings;
create policy "settings_read" on public.app_settings
  for select to authenticated
  using (public.is_admin() or public.is_her());

drop policy if exists "settings_insert" on public.app_settings;
create policy "settings_insert" on public.app_settings
  for insert to authenticated
  with check (public.is_admin() and id = 1);

drop policy if exists "settings_update" on public.app_settings;
create policy "settings_update" on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pings_read" on public.pings;
create policy "pings_read" on public.pings
  for select to authenticated
  using (public.is_admin() or public.is_her());

drop policy if exists "pings_insert" on public.pings;
create policy "pings_insert" on public.pings
  for insert to authenticated
  with check (public.is_her());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'care-package-media',
  'care-package-media',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'care-package-media' and (public.is_admin() or public.is_her()));

drop policy if exists "media_insert" on storage.objects;
create policy "media_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'care-package-media' and public.is_admin());

drop policy if exists "media_update" on storage.objects;
create policy "media_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'care-package-media' and public.is_admin())
  with check (bucket_id = 'care-package-media' and public.is_admin());

drop policy if exists "media_delete" on storage.objects;
create policy "media_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'care-package-media' and public.is_admin());

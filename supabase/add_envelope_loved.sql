alter table public.envelopes add column if not exists is_loved boolean not null default false;

drop policy if exists "envelopes_update_her" on public.envelopes;
create policy "envelopes_update_her" on public.envelopes
  for update to authenticated
  using (public.is_her())
  with check (public.is_her());

create or replace function public.protect_envelope_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.id is distinct from old.id
      or new.title is distinct from old.title
      or new.index_per_category is distinct from old.index_per_category
      or new.icon is distinct from old.icon
      or new.category is distinct from old.category
      or new.message is distinct from old.message
      or new.photo_path is distinct from old.photo_path
      or new.voice_path is distinct from old.voice_path
      or new.video_path is distinct from old.video_path
      or new.song_embed_url is distinct from old.song_embed_url
      or new.sort_order is distinct from old.sort_order
      or new.is_opened is distinct from old.is_opened
      or new.created_at is distinct from old.created_at then
      raise exception 'envelope fields are locked';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_envelope_fields() from public, anon;
grant execute on function public.protect_envelope_fields() to authenticated;

drop trigger if exists protect_envelope_fields on public.envelopes;
create trigger protect_envelope_fields
  before update on public.envelopes
  for each row execute function public.protect_envelope_fields();

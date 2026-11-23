create table if not exists public.question_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  question_number integer not null check (question_number between 1 and 40),
  question_text text not null,
  answer text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_answers_user_question_key unique (user_id, question_number)
);

create or replace function public.set_question_answers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_question_answers_updated_at() from public, anon;
grant execute on function public.set_question_answers_updated_at() to authenticated;

drop trigger if exists set_question_answers_updated_at on public.question_answers;
create trigger set_question_answers_updated_at
  before update on public.question_answers
  for each row execute function public.set_question_answers_updated_at();

alter table public.question_answers enable row level security;

revoke all on public.question_answers from anon;
grant select, insert, update on public.question_answers to authenticated;

drop policy if exists "question_answers_read" on public.question_answers;
create policy "question_answers_read" on public.question_answers
  for select to authenticated
  using (public.is_admin() or public.is_her());

drop policy if exists "question_answers_insert" on public.question_answers;
create policy "question_answers_insert" on public.question_answers
  for insert to authenticated
  with check (public.is_her() and user_id = auth.uid());

drop policy if exists "question_answers_update" on public.question_answers;
create policy "question_answers_update" on public.question_answers
  for update to authenticated
  using (public.is_her() and user_id = auth.uid())
  with check (public.is_her() and user_id = auth.uid());

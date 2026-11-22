alter table public.envelopes add column if not exists index_per_category integer not null default 0;

alter table public.envelopes disable trigger protect_envelope_fields;

update public.envelopes e
   set index_per_category = ranked.rn,
       title = case e.category
         when 'You miss me' then 'Always Here'
         when 'You have a bad day' then 'Deep Breath'
         when 'You can''t sleep' then 'Rest Easy'
         when 'You need a smile' then 'Smile Now'
         when 'You feel stressed or overwhelmed' then 'Slow Down'
         when 'You need motivation' then 'You''ve Got This'
         when 'You feel lonely' then 'Never Alone'
         when 'You are mad at me or we had a misunderstanding' then 'I''m Listening'
         else coalesce(e.category, 'Letter')
       end || ' #' || ranked.rn::text
  from (
    select id,
           row_number() over (partition by category order by sort_order, created_at, id) as rn
    from public.envelopes
  ) ranked
 where e.id = ranked.id;

alter table public.envelopes enable trigger protect_envelope_fields;

-- Elaps v2: no máximo uma meta ativa por alvo (total, um grupo ou uma área) e
-- período. Arquivar libera o par para uma meta nova. O uuid zero faz a meta
-- total (sem grupo nem área) colidir com outra total: nulos não colidiriam.
create unique index goals_one_active_per_target
  on public.goals (
    user_id,
    target_kind,
    coalesce(group_id, area_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period
  )
  where archived_at is null;

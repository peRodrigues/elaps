-- Elaps: edição atômica de uma sessão (área, início, fim e nota).
--
-- O banco rejeita (23514) início/fim que deixem uma pausa fora da sessão, e
-- corrigir isso em várias requisições deixava estados intermediários. Esta
-- função faz tudo numa transação: apaga as pausas que ficariam inteiras fora
-- do novo intervalo, corta as que o atravessam (inclusive a aberta) e grava a
-- sessão. Serve para editar uma sessão encerrada e para encerrar a ativa num
-- horário passado (o "Ajustar término" do cronômetro esquecido).
--
-- security invoker: roda com os direitos de quem chama, então a RLS vale para
-- a sessão e para as pausas; sessão de outro usuário é "não encontrada".

create function public.edit_session(
  p_session_id uuid,
  p_area_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_note text
)
returns public.sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.sessions;
begin
  if p_started_at is null or p_ended_at is null then
    raise exception 'início e fim são obrigatórios' using errcode = '23502';
  end if;
  if p_ended_at <= p_started_at then
    raise exception 'o fim precisa ser depois do início' using errcode = '23514';
  end if;

  -- Trava a linha: outro aparelho não muda a sessão no meio da edição.
  select * into s from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'sessão % não encontrada', p_session_id using errcode = 'P0002';
  end if;

  -- Pausas inteiras fora do novo intervalo somem. Uma pausa aberta vai até o
  -- novo fim, então só sai se começar no fim ou depois.
  delete from public.session_pauses
   where session_id = s.id
     and (paused_at >= p_ended_at or resumed_at <= p_started_at);

  -- As que atravessam um dos limites são cortadas nele (a aberta fecha no fim).
  -- Depois do delete, paused_at < fim e resumed_at > início, então o corte
  -- nunca gera pausa de duração zero.
  update public.session_pauses
     set paused_at = greatest(paused_at, p_started_at),
         resumed_at = least(coalesce(resumed_at, p_ended_at), p_ended_at)
   where session_id = s.id
     and (paused_at < p_started_at or resumed_at is null or resumed_at > p_ended_at);

  update public.sessions
     set area_id = p_area_id,
         started_at = p_started_at,
         ended_at = p_ended_at,
         note = nullif(btrim(p_note), '')
   where id = s.id
  returning * into s;

  return s;
end;
$$;

revoke execute on function public.edit_session(uuid, uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.edit_session(uuid, uuid, timestamptz, timestamptz, text) to authenticated;

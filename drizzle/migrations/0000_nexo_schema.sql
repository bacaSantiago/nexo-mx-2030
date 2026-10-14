create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.source_document (
  id uuid primary key default gen_random_uuid(),
  source_code text not null unique,
  source_name text not null,
  title text not null,
  year integer,
  tier text,
  resource_type text,
  official_url text not null,
  purpose text,
  bundle_status text,
  status text not null default 'pending_download' check (status in ('curated_included','metadata_included','pending_download','archived')),
  sha256 text,
  retrieved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dim_method (
  id uuid primary key default gen_random_uuid(),
  method_code text not null unique,
  method_label text not null,
  description text not null,
  observed_or_modeled text not null check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dim_metric (
  id uuid primary key default gen_random_uuid(),
  metric_code text not null unique,
  metric_label text not null,
  description text,
  default_unit text not null,
  universe text not null,
  universe_type text not null check (universe_type in ('person','household','dwelling','establishment','economy')),
  higher_is_better boolean,
  status text not null default 'published_aggregate',
  source_id uuid references public.source_document(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dim_geography (
  id uuid primary key default gen_random_uuid(),
  geo_level text not null check (geo_level in ('national','state','municipality')),
  geo_code text not null,
  geo_name text not null,
  parent_geo_code text,
  created_at timestamptz not null default now(),
  unique (geo_level, geo_code)
);

create table public.dim_segment (
  id uuid primary key default gen_random_uuid(),
  segment_code text not null unique,
  dimension text not null,
  value text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (dimension, value)
);

create table public.fact_estimate (
  id uuid primary key default gen_random_uuid(),
  metric_code text not null references public.dim_metric(metric_code),
  reference_year integer not null check (reference_year between 1990 and 2100),
  source_id uuid not null references public.source_document(id),
  universe text not null,
  geo_level text not null,
  geo_code text not null,
  segment_json jsonb not null default '{}'::jsonb,
  segment_key text not null default '',
  estimate numeric not null,
  unit text not null,
  standard_error numeric,
  ci_low numeric,
  ci_high numeric,
  confidence_level numeric check (confidence_level is null or confidence_level in (0.90, 0.95, 0.99)),
  cv numeric check (cv is null or cv >= 0),
  precision_flag text not null default 'pending_microdata_recalculation'
    check (precision_flag in ('high','moderate','low','unreliable','pending_microdata_recalculation')),
  observed_or_modeled text not null check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  method_id uuid not null references public.dim_method(id),
  version text not null,
  source_page text,
  source_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (geo_level, geo_code) references public.dim_geography(geo_level, geo_code),
  check (ci_low is null or ci_high is null or ci_low <= ci_high),
  unique (metric_code, reference_year, geo_level, geo_code, segment_key, version)
);
create index idx_fe_metric_year_geo on public.fact_estimate(metric_code, reference_year, geo_level, geo_code);
create index idx_fe_segment on public.fact_estimate using gin (segment_json);
create index idx_fe_segment_key on public.fact_estimate(metric_code, segment_key);

create table public.fact_barrier (
  id uuid primary key default gen_random_uuid(),
  fact_estimate_id uuid references public.fact_estimate(id) on delete cascade,
  barrier_code text not null,
  barrier_label text not null,
  reference_year integer not null,
  source_id uuid not null references public.source_document(id),
  universe text not null,
  geo_level text not null default 'national',
  geo_code text not null default '00',
  segment_json jsonb not null default '{}'::jsonb,
  estimate numeric not null,
  unit text not null,
  ci_low numeric, ci_high numeric, cv numeric,
  precision_flag text not null default 'pending_microdata_recalculation'
    check (precision_flag in ('high','moderate','low','unreliable','pending_microdata_recalculation')),
  observed_or_modeled text not null check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  is_multiple_response boolean not null default true,
  method_id uuid not null references public.dim_method(id),
  version text not null,
  created_at timestamptz not null default now()
);
create index idx_fb_year_geo on public.fact_barrier(reference_year, geo_level, geo_code);

create table public.fact_category (
  id uuid primary key default gen_random_uuid(),
  fact_estimate_id uuid references public.fact_estimate(id) on delete cascade,
  category_code text not null,
  category_label text not null,
  reference_year integer not null,
  source_id uuid not null references public.source_document(id),
  universe text not null,
  geo_level text not null default 'national',
  geo_code text not null default '00',
  segment_json jsonb not null default '{}'::jsonb,
  estimate numeric not null,
  unit text not null,
  ci_low numeric, ci_high numeric, cv numeric,
  precision_flag text not null default 'pending_microdata_recalculation'
    check (precision_flag in ('high','moderate','low','unreliable','pending_microdata_recalculation')),
  observed_or_modeled text not null check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  is_multiple_response boolean not null default true,
  method_id uuid not null references public.dim_method(id),
  version text not null,
  note text,
  created_at timestamptz not null default now()
);
create index idx_fc_year_geo on public.fact_category(reference_year, geo_level, geo_code);

create table public.fact_problem (
  id uuid primary key default gen_random_uuid(),
  problem_code text not null,
  problem_label text not null,
  reference_year integer not null,
  source_id uuid not null references public.source_document(id),
  universe text not null,
  geo_level text not null default 'national',
  geo_code text not null default '00',
  segment_json jsonb not null default '{}'::jsonb,
  estimate numeric not null,
  unit text not null,
  ci_low numeric, ci_high numeric, cv numeric,
  precision_flag text not null default 'pending_microdata_recalculation'
    check (precision_flag in ('high','moderate','low','unreliable','pending_microdata_recalculation')),
  observed_or_modeled text not null check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  method_id uuid not null references public.dim_method(id),
  version text not null,
  created_at timestamptz not null default now()
);

create table public.fact_supply (
  id uuid primary key default gen_random_uuid(),
  indicator_code text not null,
  indicator_label text not null,
  reference_year integer not null,
  source_id uuid not null references public.source_document(id),
  universe text not null,
  geo_level text not null,
  geo_code text not null,
  estimate numeric not null,
  unit text not null,
  ci_low numeric, ci_high numeric, cv numeric,
  precision_flag text not null default 'pending_microdata_recalculation'
    check (precision_flag in ('high','moderate','low','unreliable','pending_microdata_recalculation')),
  observed_or_modeled text not null check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  method_id uuid not null references public.dim_method(id),
  version text not null,
  created_at timestamptz not null default now()
);

create table public.scenario_definition (
  id uuid primary key default gen_random_uuid(),
  scenario_code text not null unique,
  scenario_name text not null,
  description text not null,
  assumptions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scenario_result (
  id uuid primary key default gen_random_uuid(),
  scenario_code text not null references public.scenario_definition(scenario_code),
  metric_code text not null references public.dim_metric(metric_code),
  reference_year integer not null,
  geo_level text not null,
  geo_code text not null,
  estimate numeric not null,
  p10 numeric, p50 numeric, p90 numeric,
  unit text not null,
  observed_or_modeled text not null default 'scenario' check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  assumptions_version text not null,
  created_at timestamptz not null default now(),
  unique (scenario_code, reference_year, geo_level, geo_code, metric_code, assumptions_version)
);

create table public.intervention (
  id uuid primary key default gen_random_uuid(),
  intervention_code text not null unique,
  intervention_name text not null,
  barrier_code text not null,
  description text not null,
  implementation_actors text[] not null default '{}',
  kpis jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.intervention_score (
  id uuid primary key default gen_random_uuid(),
  intervention_code text not null references public.intervention(intervention_code),
  geo_level text not null,
  geo_code text not null,
  segment_code text,
  reach numeric, modeled_uplift numeric, equity numeric, feasibility numeric, relative_cost numeric,
  priority_score numeric,
  observed_or_modeled text not null default 'modeled' check (observed_or_modeled in ('observed','modeled','imputed','scenario')),
  model_version text not null,
  created_at timestamptz not null default now()
);

create table public.source_chunk (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.source_document(id) on delete cascade,
  page_label text,
  chunk_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.methodology_note (
  id uuid primary key default gen_random_uuid(),
  note_code text not null unique,
  title text not null,
  body text not null,
  topic text not null,
  source_id uuid references public.source_document(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_lineage (
  id uuid primary key default gen_random_uuid(),
  fact_table text not null check (fact_table in ('fact_estimate','fact_barrier','fact_category','fact_problem','fact_supply','scenario_result','intervention_score')),
  fact_id uuid not null,
  source_id uuid not null references public.source_document(id),
  source_page text,
  source_url text,
  transformation text not null,
  loaded_version text not null,
  created_at timestamptz not null default now()
);
create index idx_lineage_fact on public.source_lineage(fact_table, fact_id);

create table public.chat_session (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  active_filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_message (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_session(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  evidence jsonb,
  created_at timestamptz not null default now()
);
create index idx_chat_message_session on public.chat_message(session_id, created_at);

create or replace function public.request_session_token_hash() returns text
language sql stable set search_path = public, extensions as $$
  select case
    when coalesce(current_setting('request.headers', true), '') = '' then null
    when (current_setting('request.headers', true)::json ->> 'x-session-token') is null then null
    else encode(extensions.digest(current_setting('request.headers', true)::json ->> 'x-session-token', 'sha256'), 'hex')
  end
$$;

create or replace function public.chat_session_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.chat_session where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'rate_limited';
  end if;
  return new;
end; $$;

create or replace function public.chat_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.chat_message
      where session_id = new.session_id and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'rate_limited';
  end if;
  update public.chat_session set updated_at = now() where id = new.session_id;
  return new;
end; $$;

create trigger trg_chat_session_guard before insert on public.chat_session for each row execute function public.chat_session_guard();
create trigger trg_chat_message_guard before insert on public.chat_message for each row execute function public.chat_message_guard();
revoke execute on function public.chat_session_guard() from public, anon, authenticated;
revoke execute on function public.chat_message_guard() from public, anon, authenticated;

create trigger trg_sd_upd before update on public.source_document for each row execute function public.set_updated_at();
create trigger trg_dm_upd before update on public.dim_metric for each row execute function public.set_updated_at();
create trigger trg_fe_upd before update on public.fact_estimate for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['source_document','dim_method','dim_metric','dim_geography','dim_segment','fact_estimate','fact_barrier','fact_category','fact_problem','fact_supply','scenario_definition','scenario_result','intervention','intervention_score','source_chunk','methodology_note','source_lineage']
  loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read reviewed" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

grant select, insert on public.chat_session to anon, authenticated;
grant select, insert on public.chat_message to anon, authenticated;
grant all on public.chat_session to service_role;
grant all on public.chat_message to service_role;
alter table public.chat_session enable row level security;
alter table public.chat_message enable row level security;

create policy "own session read" on public.chat_session for select to anon, authenticated
  using (session_token_hash = public.request_session_token_hash());
create policy "own session create" on public.chat_session for insert to anon, authenticated
  with check (session_token_hash = public.request_session_token_hash());
create policy "own messages read" on public.chat_message for select to anon, authenticated
  using (exists (select 1 from public.chat_session s where s.id = chat_message.session_id and s.session_token_hash = public.request_session_token_hash()));
create policy "own messages create" on public.chat_message for insert to anon, authenticated
  with check (role = 'user' and exists (select 1 from public.chat_session s where s.id = chat_message.session_id and s.session_token_hash = public.request_session_token_hash()));

insert into public.dim_method(method_code, method_label, description, observed_or_modeled) values
 ('official_published_aggregate','Agregado oficial publicado','Cifra tomada tal como aparece en la publicación oficial de resultados. Errores estándar, intervalos y CV pendientes de recalcular con microdatos y diseño muestral complejo (factor de expansión, estrato y UPM).','observed'),
 ('survey_design_estimate','Estimación con diseño muestral','Estimación directa desde microdatos con factores de expansión, estrato y UPM.','observed'),
 ('mrp_poststratification','MRP / postestratificación','Regresión multinivel con postestratificación sobre celdas demográficas de EIC 2025. Se etiqueta como estimación modelada.','modeled'),
 ('multiple_imputation_income','Imputación múltiple de ingreso','Ingreso/decil imputado a ENDUTIH desde ENIGH mediante imputación múltiple o statistical matching. Se etiqueta como ingreso imputado.','imputed'),
 ('scenario_projection','Proyección de escenario 2030','Rango bajo supuestos explícitos; no es pronóstico oficial.','scenario');
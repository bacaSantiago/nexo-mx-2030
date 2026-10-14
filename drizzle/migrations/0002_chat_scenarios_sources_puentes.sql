alter table public.chat_message
  add column if not exists intent text,
  add column if not exists params jsonb,
  add column if not exists evidence_ids text[] not null default '{}',
  add column if not exists latency_ms integer,
  add column if not exists validated boolean,
  add column if not exists model text;

alter table public.scenario_result
  add column if not exists assumption_values jsonb not null default '{}'::jsonb,
  add column if not exists component_code text not null default '',
  add column if not exists segment_code text not null default '';

do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.scenario_result'::regclass and contype = 'u' loop
    execute format('alter table public.scenario_result drop constraint %I', c);
  end loop;
end $$;
alter table public.scenario_result add constraint scenario_result_grid_key
  unique (scenario_code, reference_year, geo_level, geo_code, metric_code, segment_code, component_code, assumptions_version, assumption_values);

alter table public.source_document
  add column if not exists institution text,
  add column if not exists edition text,
  add column if not exists universe_description text,
  add column if not exists geographic_coverage text,
  add column if not exists modules_used text[] not null default '{}';

alter table public.intervention
  add column if not exists module_code text,
  add column if not exists evaluation_design text;

insert into public.dim_metric(metric_code, metric_label, description, default_unit, universe, universe_type, status) values
 ('scenario_adoption_pct','Adopción de compra digital (escenario)','Porcentaje de personas usuarias que compran en línea bajo el escenario.','percent','Personas usuarias de internet de 6 años y más','person','pending_model'),
 ('scenario_additional_buyers','Compradores adicionales vs. S0','Personas compradoras adicionales respecto al escenario inercial.','persons','Personas usuarias de internet de 6 años y más','person','pending_model'),
 ('scenario_gap_reduction_pp','Reducción de brecha','Reducción de la brecha urbano-rural en puntos porcentuales.','percentage_points','Personas usuarias de internet de 6 años y más','person','pending_model'),
 ('scenario_economic_impact_mxn','Impacto económico (rango)','Gasto potencialmente digitalizable bajo supuestos MIP explícitos.','mxn_millions','Economía nacional','economy','pending_model'),
 ('scenario_contribution_pp','Contribución por intervención','Aporte de cada componente a la adopción del escenario.','percentage_points','Personas usuarias de internet de 6 años y más','person','pending_model')
on conflict (metric_code) do nothing;

insert into public.scenario_definition(scenario_code, scenario_name, description, assumptions) values
 ('s0','S0 Inercial','Continuidad de tendencia observada.','{"parameters":[]}'),
 ('s1','S1 Acceso y habilidades','Menor déficit de conectividad y alfabetización digital.','{"parameters":[]}'),
 ('s2','S2 Pago y confianza','Mayor acceso a medios de pago digitales y menor fricción o temor.','{"parameters":[]}'),
 ('s3','S3 Omnicanal incluyente','Acceso, habilidades, pago, confianza y oferta formal/logística combinados.','{"parameters":[]}')
on conflict (scenario_code) do nothing;

insert into public.intervention(intervention_code, module_code, intervention_name, barrier_code, description, implementation_actors, kpis, evaluation_design) values
 ('nexo_acceso','acceso','NEXO Acceso','conectividad','Acceso asistido y experiencia de bajo consumo de datos.','{gobierno,telecom,comercio}','[{"kpi":"Hogares/personas habilitadas"}]','Propuesta: piloto con asignación aleatoria por conglomerado y medición a 3, 6 y 12 meses.'),
 ('nexo_habil','habil','NEXO Hábil','habilidades','Acompañamiento a primera compra y seguridad digital.','{comercio,educación,municipios}','[{"kpi":"Primera compra completada"}]','Propuesta: ensayo aleatorizado por sesión o sucursal.'),
 ('nexo_pago','pago','NEXO Pago','pago','Onboarding a cuenta, tarjeta o pago digital y puentes efectivo-digital.','{bancos,fintech,comercios}','[{"kpi":"Pago digital y repetición"}]','Propuesta: diferencias en diferencias con comercios comparables.'),
 ('nexo_confianza','confianza','NEXO Confianza','confianza','Protección de primera compra, devolución clara, trazabilidad y educación antifraude.','{comercios,PROFECO,logística}','[{"kpi":"Problemas y tiempo de resolución"}]','Propuesta: prueba A/B de garantías en primera compra.'),
 ('nexo_comercio','comercio','NEXO Comercio','oferta','Kit Omnicanal Lite: catálogo, inventario, pago, entrega y métricas.','{ANTAD,cámaras,plataformas}','[{"kpi":"Comercios activos y ventas digitales"}]','Propuesta: incorporación escalonada (stepped wedge).'),
 ('nexo_territorio','territorio','NEXO Territorio','logistica','Nodos propuestos de recolección y devolución en comercios existentes.','{minoristas,"operadores logísticos"}','[{"kpi":"Cobertura y costo de última milla"}]','Propuesta: comparación de zonas con y sin nodo, con control sintético.'),
 ('nexo_inclusivo','inclusivo','NEXO Inclusivo','accesibilidad','UX accesible, lenguaje claro y apoyo a adultos mayores, discapacidad y población indígena.','{todos}','[{"kpi":"Adopción en grupos prioritarios"}]','Propuesta: pruebas de usabilidad y A/B por grupo prioritario.')
on conflict (intervention_code) do nothing;

insert into public.source_document(source_code, source_name, title, official_url, status, institution)
values ('profeco_optional','PROFECO (opcional)','Información de quejas y protección al consumidor','https://www.gob.mx/profeco','pending_download','PROFECO')
on conflict (source_code) do nothing;

update public.source_document set institution = case
  when source_code like 'cnbv%' then 'CNBV' when source_code like 'ift%' then 'IFT'
  when source_code like 'profeco%' then 'PROFECO' else 'INEGI' end
where institution is null;
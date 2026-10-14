# NEXO MX 2030

Lets do this, start by 00, 01, 02 and 03:

## Prompt 1 — sistema visual y shell

```text

Build the frontend shell for NEXO MX 2030 using the Project Knowledge exactly.

Scope for this step only:

1. Create the responsive 100dvh chat-first layout for route `/`.

2. Add a collapsible left rail with: Inicio, Explorar, Mapa, Segmentos, Escenarios 2030, Acciones, Metodología and Fuentes.

3. Build the central chat thread with a polished empty state, six suggested analytical questions and a fixed composer.

4. Build a collapsible right “Evidencia” canvas with tabs for Visual, Métricas, Fuente and Método.

5. Add global filter chips for Año, Entidad, Ámbito, Sexo, Edad, Escolaridad and Ingreso imputado. On mobile place them in a drawer.

6. Create reusable components: AppShell, NavigationRail, GlobalFilters, ChatThread, ChatMessage, PromptSuggestions, ChatComposer, EvidenceCanvas, MetricCard, SourceCard, MethodCard and PrecisionBadge.

7. Create placeholders for the remaining routes with consistent navigation.

8. Include loading, empty and error states.

Use only the official seed metrics listed in Project Knowledge or show “Pendiente de carga”. Do not create a database or AI behavior yet. Do not use logos from INEGI or ANTAD. Verify at 1440 px and 390 px and fix overflow or clipping.

```


## Prompt 2 — backend y modelo de datos

```text

Enable Lovable Cloud for this project and create the database schema for reviewed analytical outputs.

Create migrations for:

- dim_geography

- dim_segment

- dim_metric

- dim_method

- fact_estimate

- fact_barrier

- fact_category

- fact_problem

- fact_supply

- scenario_definition

- scenario_result

- intervention

- intervention_score

- source_document

- source_chunk

- methodology_note

- chat_session

- chat_message

Requirements:

- Use UUID primary keys plus stable business keys such as metric_code, geo_code and source_code.

- fact_estimate must include reference_year, source_id, universe, geo_level, geo_code, segment_json, estimate, unit, standard_error, ci_low, ci_high, confidence_level, cv, precision_flag, observed_or_modeled, method_id, version and timestamps.

- Add indexes for metric_code + year + geo + segment filters.

- Add data validation constraints for confidence level, precision flag and observed_or_modeled.

- Apply RLS: reviewed analytical tables are public read-only; browser clients cannot insert/update/delete them. Anonymous users may create a rate-limited chat session and messages only for their own session token.

- Create an audit-friendly source lineage relation.

- Seed only the explicitly approved official baseline metrics and give each a source, universe and status. Include a note that ENDUTIH household internet and EIC dwelling internet use different universes.

- Create typed data-access helpers and generated TypeScript types.

- Do not add authentication to the public analytical experience at this stage.

After migration, inspect the schema and run a security check. Fix any policy that permits unintended writes.

```


## Prompt 3 — vistas analíticas y capa semántica

```text

Implement the deterministic analytical layer and the non-chat routes using database data only.

Create server-side allowlisted functions:

- get_metric

- compare_segments

- rank_geographies

- get_barriers

- get_categories

- get_problems

- get_opportunity_map

- get_scenario

- get_interventions

- get_sources

Each function must validate inputs with Zod and return a typed evidence payload including metric metadata, source, universe, uncertainty, observed_or_modeled and warnings. Do not accept raw SQL.

Build:

- /explorar: adoption funnel, trend, category chart and barrier chart;

- /mapa: MapLibre choropleth, uncertainty/precision toggle and opportunity quadrants;

- /segmentos: persona cards and comparison table;

- /escenarios: scenario summary placeholders driven by scenario_result;

- /acciones: intervention portfolio and transparent scoring components;

- /metodologia: observed vs modeled explanation, survey design and MRP explanation;

- /fuentes: searchable source catalog with status, year, universe and official link.

All visual components must show title, unit, source, year, universe and a “Cómo se calculó” action. Use responsive legends and accessible text summaries. Never infer missing values in the UI.

```

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/261f13d8-a6b2-485a-8efd-0a6cb3691edf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

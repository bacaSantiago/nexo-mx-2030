<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All analytical numbers come from Lovable Cloud tables via allowlisted, Zod-validated server functions in `src/lib/analytics.functions.ts`; never hardcode metrics in UI. Why: data rules require DB-sourced, auditable figures.
- Server functions return an `EvidencePayload` (metric, rows, source, universe, method, precision, warnings); UI visuals wrap in `VisualCard` with "Cómo se calculó". Why: every figure must show provenance.
- Reviewed analytical tables are public read-only (SELECT only to anon/authenticated); writes happen only through migrations. Chat tables are scoped by a hashed `x-session-token` header. Why: no public writes except own chat session.
- Public reads use a per-request publishable-key client (`src/lib/analytics.server.ts`), never the admin client. Why: RLS stays the boundary.
- MapLibre is loaded client-only with a local state GeoJSON (`public/geo/mx_states.json`) and no external tiles; colors are resolved from oklch tokens to rgb. Why: MapLibre can't parse oklch and SSR can't load WebGL.
- `exactOptionalPropertyTypes` is disabled in tsconfig; other strict flags remain. Why: friction with optional props across shadcn/recharts.

# CLAUDE.md

Convenciones y contexto para Claude Code mientras trabaja en este repo.

## Qué es esto

App de prode para el Mundial 2026. La spec completa está en `SPEC.md` — leela antes de proponer cambios estructurales. Es un proyecto cerrado (grupo de amigos), no hay multi-tenancy ni pagos.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript estricto
- Tailwind + shadcn/ui (instalar componentes a demanda con `npx shadcn@latest add <name>`)
- Supabase: Postgres + Auth + RLS + Edge Functions
- Vercel para hosting

## Workflow

1. Cambios de schema van como **migrations en `supabase/migrations/`**. Nunca editar el schema desde el dashboard, siempre por migration versionada.
2. Cuando agregás una migration, actualizá también los tipos generados:
   ```bash
   npx supabase gen types typescript --local > src/lib/database.types.ts
   ```
3. RLS policies son parte del schema — siempre en migrations, nunca lógica de autorización equivalente en el código de aplicación. **La autorización vive en Postgres.**
4. Antes de cerrar una tarea: `npm run lint && npm run typecheck && npm run test` deben pasar.

## Convenciones de código

- **TypeScript estricto**: nada de `any` salvo en tests o adapters explícitos.
- **Server Components por default**, Client Components solo cuando hay interacción/estado.
- **Server Actions** para mutaciones (no API routes salvo cuando algo externo lo necesite).
- Imports: rutas absolutas con `@/` (configurado en `tsconfig.json`).
- Estructura:
  ```
  src/
    app/              # rutas (App Router)
    components/       # UI reutilizable
      ui/             # shadcn primitives
    lib/
      supabase/       # clients (server, client, admin)
      api-football/   # cliente del feed externo
      scoring/        # solo si hay lógica que no viva en Postgres
    types/
  supabase/
    migrations/
    functions/        # edge functions
  ```
- Naming: archivos en `kebab-case`, componentes en `PascalCase`, hooks en `useCamelCase`.
- Forms: react-hook-form + zod. Validación de zod compartida entre cliente y server action.

## Reglas duras del dominio

Estas son invariantes del producto. Si algo del código las contradice, es un bug, no una decisión de diseño.

1. **El scoring de partidos vive en Postgres** (`calculate_match_points`). No reimplementar en TS. El cliente solo lee `predictions.points`.
2. **El reveal de predicciones vive en RLS**, no en el frontend. El frontend nunca filtra predicciones por "el partido todavía no empezó". Postgres ya las esconde — si el query las devuelve, se muestran.
3. **Los deadlines también viven en RLS** (no se puede `UPDATE predictions` después del lock de la ronda). El frontend muestra el estado lockeado como UX, pero la fuente de verdad es la policy.
4. **`is_admin` se chequea en Postgres**, no por email hardcodeado en el frontend.
5. **Override manual de resultados queda en `audit_log`** — toda mutación admin sobre `matches` debe escribir un registro.

## API externa (api-football)

- Cliente en `src/lib/api-football/`. Una sola key vía `process.env.API_FOOTBALL_KEY`, jamás se expone al cliente.
- Plan free = 100 req/día. Cachear agresivo, polear solo durante ventana de partido activo (1h antes hasta `status='finished'`).
- Todo dato externo guardar en nuestra DB. El cliente nunca pega directo a la API externa.

## Testing

- Vitest para unit (lógica pura, transforms del cliente de api-football).
- Playwright para flows críticos: cargar predicción, ver leaderboard, admin carga resultado y los puntos se recalculan.
- Tests de RLS: scripts en `supabase/tests/` que prueban con un cliente anónimo que no podés leer predicciones ajenas pre-kickoff.

## Lo que NO hacer sin preguntar

- Cambiar la regla de scoring (4/2/0 + 1 penales / 4/3/3/3/1 especiales).
- Cambiar el modelo de reveal (Opción A: especiales visibles tras 1er partido).
- Agregar multi-tournament al schema sin discutir el costo de migración.
- Meter una librería pesada cuando algo de shadcn o nativo lo resuelve.
- Reemplazar Server Actions por API routes "porque sí".

## Idioma

- UI en español (es-AR).
- Código, comentarios, commits, PRs en inglés.

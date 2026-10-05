# Schedulync

Schedulync is a student portal for coursework tasks, time-based campus reservations, and shared-instrument accountability reports.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required environment: `DATABASE_URL` and the Clerk publishable/secret keys configured through Replit Secrets

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/schedulync` — React/Vite student portal and its visual theme
- `artifacts/api-server` — Express API, auth middleware, and feature routes
- `lib/api-spec/openapi.yaml` — source-of-truth API contract; generated Zod schemas and React Query hooks live in the shared API libraries
- `lib/db/src/schema` — Drizzle tables and schema barrel

## Architecture decisions

- Clerk user IDs are the student primary keys and ownership scope for student-created data; never accept ownership IDs from request bodies.
- Reservation overlap checks run inside a database transaction with a resource-scoped advisory lock so simultaneous requests cannot double-book one item.
- The OpenAPI contract generates both client hooks and server-side Zod validators; update the contract and regenerate rather than editing generated files.

## Product

- Students can maintain tasks, check rooms and lab instruments against a requested time range, create or cancel reservations, and submit reports tied to a specific instrument.
- The database currently has a starter catalog of three rooms and four instruments. Replace these demo records with the institution’s verified inventory and availability rules before relying on it as a complete campus catalog.

## User preferences

No additional preferences recorded.

## Gotchas

- Availability query timestamps arrive as URL strings; convert them to `Date` values before validating with the generated query schema.
- Apply authentication to protected route prefixes, not the whole API router; inventory availability and health checks need to remain accessible before student sign-in.
- The database push command targets the development database only.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

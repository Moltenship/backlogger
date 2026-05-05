# AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Convex Auth + SSR

- For TanStack Start SSR with Convex Better Auth, keep auth handling centralized:
  `ConvexQueryClient` should use `expectAuth: true`, root `beforeLoad` should
  set `serverHttpClient` auth from the SSR token, and
  `ConvexBetterAuthProvider` should receive `initialToken`.
- Do not gate SSR-safe authenticated Convex reads with `useConvexAuth()` or
  `"skip"` during the client auth handoff. If a query can safely return `null`
  for signed-out users, subscribe to it directly and let Convex/auth hydration
  settle. Per-route skip gates caused UI flicker and stale signed-out states.
- Keep auth-derived UI state centralized when possible. If SSR data can briefly
  contain signed-out relationship data while root auth already has a token, do
  not show sign-in CTAs to authenticated users; hide or derive a neutral state
  until the authenticated relationship query resolves.
- Add regression coverage for SSR auth query policy or relationship-button
  behavior when changing this area.

## Task Completion Requirements

- `bun run check` and `bun run test` must pass before considering tasks completed. Never use `bun test` use `bun run test` instead

## Commit message style

You MUST use conventional commits specification for commit message and body - https://www.conventionalcommits.org/en/v1.0.0/#specification


## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep requests to jira as minimal as possible. Rely on caching and always tell user, that additional jira request is required.
4. Typesafety is a MUST.
5. Code should be readable.
If a tradeoff is required, choose correctness and robustness over short-term convenience.

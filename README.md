# TanStack Start + shadcn/ui

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

## Vercel deployment

Vercel builds run through `scripts/vercel-build.sh`.

- Production deployments run `bunx convex deploy --cmd "bun run build"` and use the production Convex deploy key/database.
- Preview deployments run `bunx convex dev --once` and then `bun run build`, using the preview-scoped Convex development deployment variables in Vercel.

Required Vercel environment variables:

- Production: `CONVEX_DEPLOY_KEY`, `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`
- Preview: `CONVEX_DEPLOY_KEY`, `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`
- Production and Preview: `BETTER_AUTH_SECRET`, `SITE_URL`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

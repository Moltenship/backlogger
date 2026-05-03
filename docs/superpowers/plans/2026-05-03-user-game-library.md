# User Game Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated game entries so a user can save one status per IGDB game, with optional independent rating and review, then show those games on the profile page.

**Architecture:** Store one Convex `gameEntries` document per authenticated user and IGDB game. Keep validation and data normalization in shared pure helpers, expose small Convex functions for viewer entry/upsert/profile, and reuse one client form from the game page. Profile shelves render cached game snapshot fields from Convex instead of calling IGDB per card.

**Tech Stack:** Convex, Better Auth Convex provider, TanStack Start/Router, React 19, Bun, Vitest, oxlint/oxfmt, tsgo.

---

## File Structure

- Create `src/lib/game-entry.ts`: shared status constants, rating validation, review normalization, and profile grouping types.
- Create `src/lib/game-entry.test.ts`: pure unit tests for rating/review/status helpers.
- Modify `convex/schema.ts`: add the `gameEntries` table and indexes.
- Create `convex/gameEntries.ts`: authenticated Convex queries/mutations for viewer entry, upsert, and profile shelves.
- Create `src/components/game-entry-form.tsx`: reusable status/rating/review form used on game pages.
- Modify `src/routes/games/$slug.tsx`: fetch the viewer entry, render the form, and save entries.
- Modify `src/routes/profile.tsx`: replace placeholder with profile card, counts, and status shelves.
- Regenerate Convex types with `bunx convex codegen`.

## Task 1: Shared Game Entry Helpers

**Files:**
- Create: `src/lib/game-entry.ts`
- Create: `src/lib/game-entry.test.ts`

- [ ] **Step 1: Write helper tests**

Create `src/lib/game-entry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  GAME_ENTRY_STATUSES,
  isGameEntryStatus,
  isValidStarRating,
  normalizeReview,
} from "@/lib/game-entry";

describe("game entry helpers", () => {
  it("recognizes the supported primary statuses", () => {
    expect.assertions(6);

    expect(GAME_ENTRY_STATUSES).toStrictEqual(["backlog", "playing", "completed", "dropped"]);
    expect(isGameEntryStatus("backlog")).toBe(true);
    expect(isGameEntryStatus("playing")).toBe(true);
    expect(isGameEntryStatus("completed")).toBe(true);
    expect(isGameEntryStatus("dropped")).toBe(true);
    expect(isGameEntryStatus("wishlist")).toBe(false);
  });

  it("accepts only half-star ratings from 0.5 to 5", () => {
    expect.assertions(8);

    expect(isValidStarRating(null)).toBe(true);
    expect(isValidStarRating(0.5)).toBe(true);
    expect(isValidStarRating(3)).toBe(true);
    expect(isValidStarRating(4.5)).toBe(true);
    expect(isValidStarRating(5)).toBe(true);
    expect(isValidStarRating(0)).toBe(false);
    expect(isValidStarRating(5.5)).toBe(false);
    expect(isValidStarRating(4.25)).toBe(false);
  });

  it("normalizes optional reviews", () => {
    expect.assertions(3);

    expect(normalizeReview(null)).toBeNull();
    expect(normalizeReview("   ")).toBeNull();
    expect(normalizeReview("  Great pacing.  ")).toBe("Great pacing.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test
```

Expected: FAIL because `src/lib/game-entry.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/lib/game-entry.ts`:

```ts
export const GAME_ENTRY_STATUSES = ["backlog", "playing", "completed", "dropped"] as const;

export type GameEntryStatus = (typeof GAME_ENTRY_STATUSES)[number];

export const GAME_ENTRY_STATUS_LABELS: Record<GameEntryStatus, string> = {
  backlog: "Backlog",
  playing: "Playing",
  completed: "Completed",
  dropped: "Dropped",
};

export interface GameEntrySnapshot {
  igdbId: number;
  slug: string;
  name: string;
  coverUrl: string | null;
  releaseYear: string;
}

export interface GameEntryCard extends GameEntrySnapshot {
  status: GameEntryStatus;
  rating: number | null;
  review: string | null;
  updatedAt: number;
}

export interface GameEntryProfile {
  counts: Record<GameEntryStatus | "total", number>;
  shelves: Record<GameEntryStatus, GameEntryCard[]>;
}

export function isGameEntryStatus(value: string): value is GameEntryStatus {
  return GAME_ENTRY_STATUSES.includes(value as GameEntryStatus);
}

export function isValidStarRating(value: number | null): boolean {
  if (value === null) {
    return true;
  }

  return value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

export function normalizeReview(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
```

- [ ] **Step 4: Verify helper tests pass**

Run:

```bash
bun run test
```

Expected: PASS for `src/lib/game-entry.test.ts` and existing IGDB tests.

- [ ] **Step 5: Commit helpers**

Run:

```bash
git add src/lib/game-entry.ts src/lib/game-entry.test.ts
git commit -m "feat: add game entry helpers"
```

## Task 2: Convex Game Entries API

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/gameEntries.ts`
- Regenerate: `convex/_generated/api.d.ts`, `convex/_generated/api.js`, `convex/_generated/dataModel.d.ts`

- [ ] **Step 1: Update schema**

Replace `convex/schema.ts` with:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  gameEntries: defineTable({
    userTokenIdentifier: v.string(),
    igdbId: v.number(),
    slug: v.string(),
    name: v.string(),
    coverUrl: v.union(v.string(), v.null()),
    releaseYear: v.string(),
    status: v.union(
      v.literal("backlog"),
      v.literal("playing"),
      v.literal("completed"),
      v.literal("dropped"),
    ),
    rating: v.union(v.number(), v.null()),
    review: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userTokenIdentifier_and_igdbId", ["userTokenIdentifier", "igdbId"])
    .index("by_userTokenIdentifier_and_status", ["userTokenIdentifier", "status"])
    .index("by_userTokenIdentifier", ["userTokenIdentifier"]),
});
```

- [ ] **Step 2: Add Convex functions**

Create `convex/gameEntries.ts`:

```ts
import { ConvexError, v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const statusValidator = v.union(
  v.literal("backlog"),
  v.literal("playing"),
  v.literal("completed"),
  v.literal("dropped"),
);

const gameSnapshotValidator = v.object({
  igdbId: v.number(),
  slug: v.string(),
  name: v.string(),
  coverUrl: v.union(v.string(), v.null()),
  releaseYear: v.string(),
});

async function requireUserTokenIdentifier(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError("Authentication is required.");
  }

  return identity.tokenIdentifier;
}

async function viewerTokenIdentifier(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? null;
}

function assertGameSnapshot(game: {
  igdbId: number;
  slug: string;
  name: string;
  releaseYear: string;
}) {
  if (!Number.isInteger(game.igdbId) || game.igdbId <= 0) {
    throw new ConvexError("A valid IGDB game id is required.");
  }

  if (game.slug.trim().length === 0) {
    throw new ConvexError("A game slug is required.");
  }

  if (game.name.trim().length === 0) {
    throw new ConvexError("A game name is required.");
  }

  if (game.releaseYear.trim().length === 0) {
    throw new ConvexError("A game release year is required.");
  }
}

function normalizeRating(value: number | null) {
  if (value === null) {
    return null;
  }

  if (value < 0.5 || value > 5 || !Number.isInteger(value * 2)) {
    throw new ConvexError("Rating must be a half-star value from 0.5 to 5.");
  }

  return value;
}

function normalizeReview(value: string | null) {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const viewerEntry = query({
  args: {
    igdbId: v.number(),
  },
  handler: async (ctx, args) => {
    const userTokenIdentifier = await viewerTokenIdentifier(ctx);

    if (!userTokenIdentifier) {
      return null;
    }

    return await ctx.db
      .query("gameEntries")
      .withIndex("by_userTokenIdentifier_and_igdbId", (q) =>
        q.eq("userTokenIdentifier", userTokenIdentifier).eq("igdbId", args.igdbId),
      )
      .unique();
  },
});

export const upsert = mutation({
  args: {
    game: gameSnapshotValidator,
    status: statusValidator,
    rating: v.optional(v.union(v.number(), v.null())),
    review: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userTokenIdentifier = await requireUserTokenIdentifier(ctx);
    assertGameSnapshot(args.game);

    const existing = await ctx.db
      .query("gameEntries")
      .withIndex("by_userTokenIdentifier_and_igdbId", (q) =>
        q.eq("userTokenIdentifier", userTokenIdentifier).eq("igdbId", args.game.igdbId),
      )
      .unique();
    const now = Date.now();
    const rating = args.rating === undefined ? existing?.rating ?? null : normalizeRating(args.rating);
    const review = args.review === undefined ? existing?.review ?? null : normalizeReview(args.review);

    if (existing) {
      await ctx.db.patch(existing._id, {
        slug: args.game.slug.trim(),
        name: args.game.name.trim(),
        coverUrl: args.game.coverUrl,
        releaseYear: args.game.releaseYear.trim(),
        status: args.status,
        rating,
        review,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("gameEntries", {
      userTokenIdentifier,
      igdbId: args.game.igdbId,
      slug: args.game.slug.trim(),
      name: args.game.name.trim(),
      coverUrl: args.game.coverUrl,
      releaseYear: args.game.releaseYear.trim(),
      status: args.status,
      rating,
      review,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listViewerProfile = query({
  args: {},
  handler: async (ctx) => {
    const userTokenIdentifier = await viewerTokenIdentifier(ctx);

    if (!userTokenIdentifier) {
      return null;
    }

    const entries = await ctx.db
      .query("gameEntries")
      .withIndex("by_userTokenIdentifier", (q) =>
        q.eq("userTokenIdentifier", userTokenIdentifier),
      )
      .collect();
    const sortedEntries = entries.toSorted((a, b) => b.updatedAt - a.updatedAt);

    return {
      counts: {
        total: sortedEntries.length,
        backlog: sortedEntries.filter((entry) => entry.status === "backlog").length,
        playing: sortedEntries.filter((entry) => entry.status === "playing").length,
        completed: sortedEntries.filter((entry) => entry.status === "completed").length,
        dropped: sortedEntries.filter((entry) => entry.status === "dropped").length,
      },
      shelves: {
        playing: sortedEntries.filter((entry) => entry.status === "playing"),
        backlog: sortedEntries.filter((entry) => entry.status === "backlog"),
        completed: sortedEntries.filter((entry) => entry.status === "completed"),
        dropped: sortedEntries.filter((entry) => entry.status === "dropped"),
      },
    };
  },
});
```

- [ ] **Step 3: Regenerate Convex types**

Run:

```bash
bunx convex codegen
```

Expected: generated Convex files update and include `gameEntries`.

- [ ] **Step 4: Run typecheck**

Run:

```bash
bun run typecheck:tsgo
```

Expected: PASS.

- [ ] **Step 5: Commit Convex API**

Run:

```bash
git add convex/schema.ts convex/gameEntries.ts convex/_generated
git commit -m "feat: add game entry convex api"
```

## Task 3: Game Entry Form Component

**Files:**
- Create: `src/components/game-entry-form.tsx`

- [ ] **Step 1: Create reusable form**

Create `src/components/game-entry-form.tsx`:

```tsx
import { Star } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  GAME_ENTRY_STATUS_LABELS,
  GAME_ENTRY_STATUSES,
  type GameEntryStatus,
} from "@/lib/game-entry";

export interface GameEntryFormValue {
  status: GameEntryStatus;
  rating: number | null;
  review: string | null;
}

export function GameEntryForm({
  initialValue,
  isAuthenticated,
  isSaving,
  onSignIn,
  onSubmit,
}: {
  initialValue: GameEntryFormValue | null;
  isAuthenticated: boolean;
  isSaving: boolean;
  onSignIn: () => void;
  onSubmit: (value: GameEntryFormValue) => void;
}) {
  const reviewId = useId();
  const [status, setStatus] = useState<GameEntryStatus>(initialValue?.status ?? "backlog");
  const [rating, setRating] = useState<number | null>(initialValue?.rating ?? null);
  const [review, setReview] = useState(initialValue?.review ?? "");

  useEffect(() => {
    setStatus(initialValue?.status ?? "backlog");
    setRating(initialValue?.rating ?? null);
    setReview(initialValue?.review ?? "");
  }, [initialValue]);

  return (
    <form
      className="bg-background/70 border-border/70 mt-6 max-w-2xl rounded-lg border p-3 backdrop-blur"
      onSubmit={(event) => {
        event.preventDefault();

        if (!isAuthenticated) {
          onSignIn();
          return;
        }

        onSubmit({
          status,
          rating,
          review: review.trim().length > 0 ? review.trim() : null,
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-[10rem_1fr_auto]">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as GameEntryStatus);
            }}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {GAME_ENTRY_STATUSES.map((item) => (
              <option key={item} value={item}>
                {GAME_ENTRY_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Rating</span>
          <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} stars`}
                aria-pressed={rating === value}
                onClick={() => {
                  setRating(value);
                }}
                className="text-muted-foreground hover:text-foreground data-[active=true]:text-primary rounded-sm p-1"
                data-active={rating !== null && value <= rating}
              >
                <Star className="size-4 fill-current" />
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setRating(null);
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <Button type="submit" className="self-end" disabled={isSaving}>
          {isAuthenticated ? "Save" : "Sign in"}
        </Button>
      </div>

      <label htmlFor={reviewId} className="mt-3 grid gap-1 text-sm">
        <span className="text-muted-foreground">Review</span>
        <textarea
          id={reviewId}
          value={review}
          onChange={(event) => {
            setReview(event.target.value);
          }}
          rows={3}
          className="border-input bg-background min-h-24 rounded-md border px-3 py-2 text-sm"
          placeholder="Optional notes or review"
        />
      </label>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck component**

Run:

```bash
bun run typecheck:tsgo
```

Expected: PASS.

- [ ] **Step 3: Commit form**

Run:

```bash
git add src/components/game-entry-form.tsx
git commit -m "feat: add game entry form"
```

## Task 4: Wire Game Page To Convex

**Files:**
- Modify: `src/routes/games/$slug.tsx`

- [ ] **Step 1: Add Convex imports and auth client usage**

At the top of `src/routes/games/$slug.tsx`, add:

```tsx
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import { GameEntryForm, type GameEntryFormValue } from "@/components/game-entry-form";
import { authClient } from "@/lib/auth-client";
import { api } from "../../../convex/_generated/api";
```

Keep existing imports. The route file lives at `src/routes/games/$slug.tsx`, so the generated Convex API import goes three directories up to the repo-root `convex` folder.

- [ ] **Step 2: Replace hero action buttons with save form**

Inside `GameDetail`, after `heroStyle`, add:

```tsx
const { data: session } = authClient.useSession();
const [saveError, setSaveError] = useState<string | null>(null);
const viewerEntry = useQuery(api.gameEntries.viewerEntry, { igdbId: game.id });
const upsertGameEntry = useMutation(api.gameEntries.upsert);
const [isSavingEntry, setIsSavingEntry] = useState(false);
const isAuthenticated = Boolean(session?.user);
const initialEntryValue: GameEntryFormValue | null = viewerEntry
  ? {
      status: viewerEntry.status,
      rating: viewerEntry.rating,
      review: viewerEntry.review,
    }
  : null;
```

Replace the current button group:

```tsx
<div className="mt-6 flex flex-wrap gap-2">
  <Button>
    <Gamepad2 className="size-4" />
    Log Game
  </Button>
  <Button variant="outline">
    <MessageSquareText className="size-4" />
    Write Review
  </Button>
  <Button variant="outline">
    <Library className="size-4" />
    Add to Backlog
  </Button>
</div>
```

with:

```tsx
<GameEntryForm
  initialValue={initialEntryValue}
  isAuthenticated={isAuthenticated}
  isSaving={isSavingEntry}
  onSignIn={() => {
    authClient.signIn.social({ provider: "twitch" }).catch((error: unknown) => {
      setSaveError(error instanceof Error ? error.message : "Sign in failed.");
    });
  }}
  onSubmit={(value) => {
    setIsSavingEntry(true);
    setSaveError(null);
    upsertGameEntry({
      game: {
        igdbId: game.id,
        slug: game.slug,
        name: game.name,
        coverUrl: game.coverUrl,
        releaseYear: game.releaseYear,
      },
      status: value.status,
      rating: value.rating,
      review: value.review,
    })
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : "Could not save this game.");
      })
      .finally(() => {
        setIsSavingEntry(false);
      });
  }}
/>
{saveError ? <p className="text-destructive mt-2 text-sm">{saveError}</p> : null}
```

- [ ] **Step 3: Remove unused imports**

Remove `MessageSquareText` and `Library` from the `lucide-react` import if they are no longer used. Keep `Gamepad2` because game info and fallback icons still use it.

- [ ] **Step 4: Verify game page**

Run:

```bash
bun run typecheck:tsgo
bun run lint
```

Expected: both PASS.

- [ ] **Step 5: Commit game page wiring**

Run:

```bash
git add 'src/routes/games/$slug.tsx'
git commit -m "feat: wire game page library entries"
```

## Task 5: Profile Shelves

**Files:**
- Modify: `src/routes/profile.tsx`

- [ ] **Step 1: Replace profile placeholder**

Replace `src/routes/profile.tsx` with:

```tsx
import { useQuery } from "convex/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { GAME_ENTRY_STATUS_LABELS, GAME_ENTRY_STATUSES, type GameEntryStatus } from "@/lib/game-entry";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: session } = authClient.useSession();
  const profile = useQuery(api.gameEntries.listViewerProfile);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-border/70 bg-card rounded-lg border p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-primary text-primary-foreground grid size-14 place-items-center rounded-full text-lg font-semibold">
              {(session?.user.name ?? "U").slice(0, 1)}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Profile</p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {session?.user.name ?? "Signed out"}
              </h1>
            </div>
          </div>

          {profile ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-5">
              <CountBadge label="Total" value={profile.counts.total} />
              {GAME_ENTRY_STATUSES.map((status) => (
                <CountBadge
                  key={status}
                  label={GAME_ENTRY_STATUS_LABELS[status]}
                  value={profile.counts[status]}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <Button
                onClick={() => {
                  authClient.signIn.social({ provider: "twitch" });
                }}
              >
                Sign in with Twitch
              </Button>
            </div>
          )}
        </section>

        {profile ? (
          <div className="mt-5 space-y-5">
            {GAME_ENTRY_STATUSES.map((status) => (
              <ProfileShelf key={status} status={status} games={profile.shelves[status]} />
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/60 rounded-md p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ProfileShelf({
  games,
  status,
}: {
  games: {
    _id: string;
    slug: string;
    name: string;
    coverUrl: string | null;
    releaseYear: string;
    rating: number | null;
  }[];
  status: GameEntryStatus;
}) {
  return (
    <section className="border-border/70 bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{GAME_ENTRY_STATUS_LABELS[status]}</h2>
        <Badge variant="secondary">{games.length}</Badge>
      </div>

      {games.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {games.map((game) => (
            <Link
              key={game._id}
              to="/games/$slug/overview"
              params={{ slug: game.slug }}
              className="group min-w-0"
            >
              <div className="bg-muted aspect-[3/4] overflow-hidden rounded-md">
                {game.coverUrl ? (
                  <img src={game.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-muted-foreground grid h-full place-items-center p-4 text-center text-xs">
                    No cover
                  </div>
                )}
              </div>
              <div className="mt-2 min-w-0">
                <p className="truncate text-sm font-medium group-hover:underline">{game.name}</p>
                <p className="text-muted-foreground text-xs">
                  {game.releaseYear}
                  {game.rating ? ` · ${game.rating}/5` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
          No games in this status yet.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify profile page**

Run:

```bash
bun run typecheck:tsgo
bun run lint
```

Expected: PASS. The profile route file lives at `src/routes/profile.tsx`, so the generated Convex API import goes two directories up to the repo-root `convex` folder.

- [ ] **Step 3: Commit profile**

Run:

```bash
git add src/routes/profile.tsx
git commit -m "feat: add profile game shelves"
```

## Task 6: Final Verification

**Files:**
- No new files expected unless generated Convex types changed after codegen.

- [ ] **Step 1: Format**

Run:

```bash
bun run format
```

Expected: formatting completes.

- [ ] **Step 2: Required checks**

Run:

```bash
bun run format:check
bun run lint
bun run typecheck:tsgo
bun run test
```

Expected: all PASS.

- [ ] **Step 3: Production build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run:

```bash
bun run dev
```

Expected: app and Convex start concurrently.

Manual checks:

- Visit a game page while signed out.
- Confirm the save form shows a sign-in action.
- Sign in with Twitch.
- Save a game as `backlog` with no rating/review.
- Change it to `playing` and confirm the entry updates.
- Add a `4.5` rating and review text.
- Visit `/profile` and confirm the game appears in the `Playing` shelf with the count updated.

- [ ] **Step 5: Final commit if formatting changed generated output**

If Task 6 created any uncommitted formatting or generated-file changes, run:

```bash
git status --short
git add .
git commit -m "chore: finalize game library checks"
```

If `git status --short` is empty, do not create an empty commit.

## Plan Self-Review

Spec coverage:

- One status per user/game is covered by the `by_userTokenIdentifier_and_igdbId` lookup and upsert flow.
- Optional independent rating/review are covered by nullable fields and form state.
- Status changes preserve rating/review when omitted in the mutation.
- Profile card, counts, and shelves are covered by Task 5.
- Cached IGDB fields are included in the Convex schema and upsert payload.

Ambiguities resolved:

- Review is plain text and normalized to `null` when empty.
- Rating is stored on the entry, not in a separate review table.
- Public profiles, custom lists, and activity history remain out of scope.

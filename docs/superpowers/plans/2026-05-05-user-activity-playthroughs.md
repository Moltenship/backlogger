# User Activity Playthroughs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add replayable game playthroughs and a public profile activity section whose heatmap counts status changes.

**Architecture:** Treat each `gameEntries` document as one playthrough and use latest-per-game projections for current UI. Add status-change activity rows in Convex and return bounded profile activity data from the existing public profile query. Keep UI split into focused helpers: game-entry copy/mode handling, activity formatting, heatmap rendering, and profile section composition.

**Tech Stack:** Convex, TanStack Start/Router/Query, React 19, TypeScript, Tailwind CSS, Vitest, Bun.

---

## File Structure

- Modify `convex/schema.ts`: add indexes for duplicate playthrough lookup and add `gameEntryActivities`.
- Modify `convex/gameEntries.ts`: replace unique game-entry assumptions, add activity recording, latest playthrough lookup, replay creation, latest-per-game shelves, and profile activity return data.
- Modify `src/lib/game-entry.ts`: add shared activity/playthrough types and copy helpers.
- Modify `src/lib/game-entry.test.ts`: cover activity copy and helper behavior.
- Modify `src/components/game-entry-form.tsx`: support mode-specific submit labels.
- Modify `src/routes/games/$slug.tsx`: use latest playthrough query, edit by id, and add "Log replay" create flow.
- Modify `src/components/profile-library.tsx`: show playthrough count labels on profile game cards.
- Create `src/components/profile-activity.tsx`: render summary stats, heatmap, and recent activity feed.
- Modify `src/routes/profile.$publicProfileId.tsx`: render `ProfileActivity`.
- Add focused tests where pure helpers can cover behavior; use `bun run check` and `bun run test` for full validation.

## Task 1: Shared Types And Copy Helpers

**Files:**
- Modify: `src/lib/game-entry.ts`
- Modify: `src/lib/game-entry.test.ts`

- [ ] **Step 1: Add failing tests for activity copy and day keys**

Append these tests to `src/lib/game-entry.test.ts`:

```ts
import {
  formatActivityMessage,
  formatDayKey,
  getPlaythroughLabel,
} from "@/lib/game-entry";

it("formats UTC day keys for activity buckets", () => {
  expect.assertions(2);

  expect(formatDayKey(Date.UTC(2026, 0, 2, 23, 59))).toBe("2026-01-02");
  expect(formatDayKey(Date.UTC(2026, 11, 31, 0, 1))).toBe("2026-12-31");
});

it("formats playthrough count labels", () => {
  expect.assertions(3);

  expect(getPlaythroughLabel(0)).toBeNull();
  expect(getPlaythroughLabel(1)).toBeNull();
  expect(getPlaythroughLabel(2)).toBe("2 playthroughs");
});

it("formats profile status activity messages", () => {
  expect.assertions(4);

  expect(formatActivityMessage({ name: "Hades", toStatus: "playing", playthroughIndex: 1 })).toBe(
    "Started playing Hades",
  );
  expect(
    formatActivityMessage({ name: "Hades", toStatus: "playing", playthroughIndex: 2 }),
  ).toBe("Started replaying Hades");
  expect(
    formatActivityMessage({ name: "Hades", toStatus: "completed", playthroughIndex: 2 }),
  ).toBe("Completed a replay of Hades");
  expect(
    formatActivityMessage({ name: "Hades", toStatus: "backlog", playthroughIndex: 1 }),
  ).toBe("Moved Hades to Backlog");
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
bun run test src/lib/game-entry.test.ts
```

Expected: FAIL because `formatActivityMessage`, `formatDayKey`, and `getPlaythroughLabel` do not exist.

- [ ] **Step 3: Implement shared types and helpers**

Add to `src/lib/game-entry.ts`:

```ts
export interface GameEntryActivityBucket {
  dayKey: string;
  count: number;
}

export interface GameEntryActivityItem {
  id: string;
  dayKey: string;
  createdAt: number;
  igdbId: number;
  slug: string;
  name: string;
  coverUrl: string | null;
  fromStatus: GameEntryStatus | null;
  toStatus: GameEntryStatus;
  playthroughIndex: number;
}

export interface GameEntryActivitySummary {
  activeDays: number;
  totalStatusUpdates: number;
}

export interface GameEntryProfileActivity {
  summary: GameEntryActivitySummary;
  heatmap: GameEntryActivityBucket[];
  recent: GameEntryActivityItem[];
}

export interface GameEntryActivityMessageInput {
  name: string;
  toStatus: GameEntryStatus;
  playthroughIndex: number;
}

export function formatDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function getPlaythroughLabel(playthroughCount: number): string | null {
  return playthroughCount > 1 ? `${playthroughCount} playthroughs` : null;
}

export function formatActivityMessage({
  name,
  playthroughIndex,
  toStatus,
}: GameEntryActivityMessageInput): string {
  const isReplay = playthroughIndex > 1;

  if (toStatus === "playing") {
    return isReplay ? `Started replaying ${name}` : `Started playing ${name}`;
  }

  if (toStatus === "completed") {
    return isReplay ? `Completed a replay of ${name}` : `Completed ${name}`;
  }

  return `Moved ${name} to ${GAME_ENTRY_STATUS_LABELS[toStatus]}`;
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
bun run test src/lib/game-entry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-entry.ts src/lib/game-entry.test.ts
git commit -m "feat: add playthrough activity helpers" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 2: Convex Schema For Playthroughs And Activities

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Update schema indexes and activity table**

Modify `convex/schema.ts` so `gameEntries` includes this additional index:

```ts
.index("by_userTokenIdentifier_and_igdbId_and_updatedAt", [
  "userTokenIdentifier",
  "igdbId",
  "updatedAt",
])
```

Also add this optional field to `gameEntries` so existing rows remain valid until migrated by edit/replay paths:

```ts
playthroughIndex: v.optional(v.number()),
```

Then add this table before `gameEntryStats`:

```ts
gameEntryActivities: defineTable({
  userTokenIdentifier: v.string(),
  publicProfileId: v.string(),
  gameEntryId: v.id("gameEntries"),
  igdbId: v.number(),
  slug: v.string(),
  name: v.string(),
  coverUrl: v.union(v.string(), v.null()),
  playthroughIndex: v.number(),
  fromStatus: v.union(
    v.literal("backlog"),
    v.literal("playing"),
    v.literal("completed"),
    v.literal("dropped"),
    v.null(),
  ),
  toStatus: v.union(
    v.literal("backlog"),
    v.literal("playing"),
    v.literal("completed"),
    v.literal("dropped"),
  ),
  dayKey: v.string(),
  createdAt: v.number(),
})
  .index("by_userTokenIdentifier_and_dayKey", ["userTokenIdentifier", "dayKey"])
  .index("by_publicProfileId_and_dayKey", ["publicProfileId", "dayKey"])
  .index("by_publicProfileId_and_createdAt", ["publicProfileId", "createdAt"]),
```

- [ ] **Step 2: Generate/check Convex types through typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS or only errors from later tasks not yet implemented if this task is being batched. In task-by-task execution, expect PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add playthrough activity schema" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 3: Convex Playthrough Mutations And Latest Lookup

**Files:**
- Modify: `convex/gameEntries.ts`

- [ ] **Step 1: Add helper functions**

In `convex/gameEntries.ts`, import `Id`:

```ts
import type { Id } from "./_generated/dataModel";
```

Add these helpers near the existing status/stat helpers:

```ts
function dayKeyFromTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function latestEntryForGame(
  ctx: QueryCtx,
  userTokenIdentifier: string,
  igdbId: number,
) {
  const entries = await ctx.db
    .query("gameEntries")
    .withIndex("by_userTokenIdentifier_and_igdbId_and_updatedAt", (q) =>
      q.eq("userTokenIdentifier", userTokenIdentifier).eq("igdbId", igdbId),
    )
    .order("desc")
    .take(1);

  return entries[0] ?? null;
}

async function countPlaythroughsForGame(
  ctx: QueryCtx | MutationCtx,
  userTokenIdentifier: string,
  igdbId: number,
) {
  const entries = await ctx.db
    .query("gameEntries")
    .withIndex("by_userTokenIdentifier_and_igdbId", (q) =>
      q.eq("userTokenIdentifier", userTokenIdentifier).eq("igdbId", igdbId),
    )
    .collect();

  return entries.length;
}

async function nextPlaythroughIndex(
  ctx: QueryCtx | MutationCtx,
  userTokenIdentifier: string,
  igdbId: number,
) {
  return (await countPlaythroughsForGame(ctx, userTokenIdentifier, igdbId)) + 1;
}

async function recordStatusActivity({
  ctx,
  entryId,
  fromStatus,
  identity,
  game,
  now,
  toStatus,
}: {
  ctx: MutationCtx;
  entryId: Id<"gameEntries">;
  fromStatus: EntryStatus | null;
  identity: UserIdentity;
  game: {
    igdbId: number;
    slug: string;
    name: string;
    coverUrl: string | null;
  };
  now: number;
  playthroughIndex: number;
  toStatus: EntryStatus;
}) {
  if (fromStatus === toStatus) {
    return;
  }

  const publicProfileId = await upsertUserProfile(ctx, identity, now);

  await ctx.db.insert("gameEntryActivities", {
    userTokenIdentifier: identity.tokenIdentifier,
    publicProfileId,
    gameEntryId: entryId,
    igdbId: game.igdbId,
    slug: game.slug,
    name: game.name,
    coverUrl: game.coverUrl,
    playthroughIndex,
    fromStatus,
    toStatus,
    dayKey: dayKeyFromTimestamp(now),
    createdAt: now,
  });
}
```

- [ ] **Step 2: Replace `viewerEntry` with latest lookup**

Rename the exported query to `viewerLatestEntry` and use `latestEntryForGame`:

```ts
export const viewerLatestEntry = query({
  args: {
    igdbId: v.number(),
  },
  handler: async (ctx, args) => {
    const userTokenIdentifier = await viewerTokenIdentifier(ctx);

    if (!userTokenIdentifier) {
      return null;
    }

    return await latestEntryForGame(ctx, userTokenIdentifier, args.igdbId);
  },
});
```

Keep a temporary compatibility alias only if needed during the same task:

```ts
export const viewerEntry = viewerLatestEntry;
```

Remove that alias after the route has moved to `viewerLatestEntry`.

- [ ] **Step 3: Change `upsert` to edit by optional entry id**

Update `upsert` args:

```ts
entryId: v.optional(v.id("gameEntries")),
```

Replace the existing unique lookup with:

```ts
const existing = args.entryId ? await ctx.db.get(args.entryId) : null;

if (existing && existing.userTokenIdentifier !== userTokenIdentifier) {
  throw new ConvexError("You can only edit your own playthroughs.");
}
```

When patching an existing entry, call `recordStatusActivity` only after the patch inputs are normalized and only with `existing.status` as `fromStatus`.

Use this playthrough index for existing rows:

```ts
const playthroughIndex = existing.playthroughIndex ?? 1;
```

- [ ] **Step 4: Add explicit replay create mutation**

Add:

```ts
export const createPlaythrough = mutation({
  args: {
    game: gameSnapshotValidator,
    status: statusValidator,
    rating: v.optional(v.union(v.number(), v.null())),
    review: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await requireUserIdentity(ctx);
    const userTokenIdentifier = identity.tokenIdentifier;
    assertGameSnapshot(args.game);

    const now = Date.now();
    const rating = args.rating === undefined ? null : normalizeRating(args.rating);
    const review = args.review === undefined ? null : normalizeReview(args.review);
    const coverUrl = args.game.coverUrl?.trim() ?? null;
    const playthroughIndex = await nextPlaythroughIndex(ctx, userTokenIdentifier, args.game.igdbId);

    await updateStatsForUpsert(ctx, identity, null, args.status, now);

    const entryId = await ctx.db.insert("gameEntries", {
      userTokenIdentifier,
      igdbId: args.game.igdbId,
      slug: args.game.slug.trim(),
      name: args.game.name.trim(),
      coverUrl,
      releaseYear: args.game.releaseYear.trim(),
      status: args.status,
      rating,
      review,
      playthroughIndex,
      createdAt: now,
      updatedAt: now,
    });

    await recordStatusActivity({
      ctx,
      entryId,
      fromStatus: null,
      identity,
      game: {
        igdbId: args.game.igdbId,
        slug: args.game.slug.trim(),
        name: args.game.name.trim(),
        coverUrl,
      },
      now,
      playthroughIndex,
      toStatus: args.status,
    });

    return entryId;
  },
});
```

- [ ] **Step 5: Make default new saves create a playthrough**

In `upsert`, if `args.entryId` is absent, call the same internal helper used by `createPlaythrough`. Extract the create body into:

```ts
async function createPlaythroughEntry(
  ctx: MutationCtx,
  identity: UserIdentity,
  args: {
    game: {
      igdbId: number;
      slug: string;
      name: string;
      coverUrl: string | null;
      releaseYear: string;
    };
    status: EntryStatus;
    rating?: number | null;
    review?: string | null;
  },
) {
  // Move the normalized create branch from createPlaythrough here.
}
```

Then `upsert` and `createPlaythrough` both return:

```ts
return await createPlaythroughEntry(ctx, identity, args);
```

The helper must not query `.unique()` by user and game. Initial creation must record status activity with `fromStatus: null`.

- [ ] **Step 6: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS with the temporary `viewerEntry` compatibility alias in place.

- [ ] **Step 7: Commit**

If typecheck passes:

```bash
git add convex/gameEntries.ts
git commit -m "feat: support game playthrough mutations" -m "Co-authored-by: Codex <noreply@openai.com>"
```

If typecheck does not pass, keep the compatibility alias and fix this task before committing.

## Task 4: Game Page Replay Flow

**Files:**
- Modify: `src/components/game-entry-form.tsx`
- Modify: `src/routes/games/$slug.tsx`

- [ ] **Step 1: Update form API**

Change `GameEntryForm` props to include submit label:

```ts
submitLabel?: string;
```

Destructure with default:

```ts
submitLabel = "Save",
```

Update the button:

```tsx
{isAuthenticated ? submitLabel : "Sign in"}
```

- [ ] **Step 2: Update game route query names and dialog mode**

In `src/routes/games/$slug.tsx`, replace `viewerEntry` function references with `viewerLatestEntry`.

Add state:

```ts
const [entryDialogMode, setEntryDialogMode] = useState<"edit" | "replay">("edit");
```

Add:

```ts
function openReplayDialog() {
  setSaveError(null);
  setEntryDialogMode("replay");
  setDraftStatus("playing");
  setIsEntryDialogOpen(true);
}
```

Update `openEntryDialog`:

```ts
setEntryDialogMode("edit");
```

- [ ] **Step 3: Call the right mutation**

Add:

```ts
const createPlaythrough = useMutation(api.gameEntries.createPlaythrough);
```

In `saveEntry`, call `createPlaythrough` when `entryDialogMode === "replay"`. Otherwise call `upsertGameEntry` with `entryId: viewerEntry?._id`.

The edit payload must look like:

```ts
await upsertGameEntry({
  entryId: viewerEntry?._id,
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
});
```

The replay payload must omit `entryId` and use `createPlaythrough`.

- [ ] **Step 4: Add "Log replay" action**

Near `GameEntryStatusButton`, render a secondary button when authenticated latest entry exists:

```tsx
{viewerEntry ? (
  <Button variant="outline" onClick={openReplayDialog}>
    Log replay
  </Button>
) : null}
```

Wrap status and replay actions in a flex container so mobile remains stable:

```tsx
<div className="mt-6 flex flex-wrap items-center gap-2">
  <GameEntryStatusButton ... />
  {viewerEntry ? <Button variant="outline" onClick={openReplayDialog}>Log replay</Button> : null}
</div>
```

- [ ] **Step 5: Update dialog copy**

Use:

```tsx
<DialogTitle>
  {entryDialogMode === "replay" ? "Log another playthrough" : GAME_ENTRY_STATUS_LABELS[draftStatus]}
</DialogTitle>
<DialogDescription>
  {entryDialogMode === "replay"
    ? `Create a new playthrough for ${game.name} with its own status, rating, and review.`
    : `Set your status, optional rating, and optional review for ${game.name}.`}
</DialogDescription>
```

Pass:

```tsx
submitLabel={entryDialogMode === "replay" ? "Log playthrough" : "Save playthrough"}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add convex/gameEntries.ts src/components/game-entry-form.tsx 'src/routes/games/$slug.tsx'
git commit -m "feat: add game replay logging flow" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 5: Public Profile Latest-Per-Game And Activity Data

**Files:**
- Modify: `convex/gameEntries.ts`
- Modify: `src/lib/game-entry.ts`

- [ ] **Step 1: Extend profile card type**

In `src/lib/game-entry.ts`, add to `GameEntryCard`:

```ts
playthroughCount: number;
playthroughIndex: number;
```

Add to `GameEntryProfile`:

```ts
activity: GameEntryProfileActivity;
```

- [ ] **Step 2: Add latest-per-game profile helper**

In `convex/gameEntries.ts`, replace `latestEntriesByStatus` with a helper that returns latest entry per `igdbId` for a status:

```ts
async function latestGamesByStatus(ctx: QueryCtx, userTokenIdentifier: string, status: EntryStatus) {
  const entries = await ctx.db
    .query("gameEntries")
    .withIndex("by_userTokenIdentifier_and_status_and_updatedAt", (q) =>
      q.eq("userTokenIdentifier", userTokenIdentifier).eq("status", status),
    )
    .order("desc")
    .take(60);
  const latestByGame = new Map<number, (typeof entries)[number]>();

  for (const entry of entries) {
    if (!latestByGame.has(entry.igdbId)) {
      latestByGame.set(entry.igdbId, entry);
    }

    if (latestByGame.size >= shelfLimit) {
      break;
    }
  }

  const result = [];

  for (const entry of latestByGame.values()) {
    result.push({
      ...entry,
      playthroughCount: await countPlaythroughsForGame(ctx, userTokenIdentifier, entry.igdbId),
      playthroughIndex: entry.playthroughIndex ?? 1,
    });
  }

  return result;
}
```

Then update `getUserProfile` to call `latestGamesByStatus`.

- [ ] **Step 3: Add profile activity helper**

Add:

```ts
async function getProfileActivity(ctx: QueryCtx, publicProfileId: string) {
  const activities = await ctx.db
    .query("gameEntryActivities")
    .withIndex("by_publicProfileId_and_createdAt", (q) => q.eq("publicProfileId", publicProfileId))
    .order("desc")
    .take(100);
  const countByDay = new Map<string, number>();

  for (const activity of activities) {
    countByDay.set(activity.dayKey, (countByDay.get(activity.dayKey) ?? 0) + 1);
  }

  const recent = [];

  for (const activity of activities.slice(0, 12)) {
    recent.push({
      id: activity._id,
      dayKey: activity.dayKey,
      createdAt: activity.createdAt,
      igdbId: activity.igdbId,
      slug: activity.slug,
      name: activity.name,
      coverUrl: activity.coverUrl,
      fromStatus: activity.fromStatus,
      toStatus: activity.toStatus,
      playthroughIndex: activity.playthroughIndex,
    });
  }

  return {
    summary: {
      activeDays: countByDay.size,
      totalStatusUpdates: activities.length,
    },
    heatmap: Array.from(countByDay.entries())
      .map(([dayKey, count]) => ({ dayKey, count }))
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
    recent,
  };
}
```

- [ ] **Step 4: Return activity from profile reads**

Update `getUserProfile` signature:

```ts
async function getUserProfile(ctx: QueryCtx, userTokenIdentifier: string, publicProfileId: string)
```

Include:

```ts
activity: await getProfileActivity(ctx, publicProfileId),
```

Update all callers to pass `publicProfileId`.

- [ ] **Step 5: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS after frontend profile components are updated in Task 6. When executing tasks strictly one at a time, run this command at the end of Task 6 instead.

- [ ] **Step 6: Commit**

If typecheck passes:

```bash
git add convex/gameEntries.ts src/lib/game-entry.ts
git commit -m "feat: return profile playthrough activity" -m "Co-authored-by: Codex <noreply@openai.com>"
```

If typecheck is blocked by Task 6 UI updates, make Task 6 changes before committing Tasks 5 and 6 together.

## Task 6: Profile Activity UI

**Files:**
- Create: `src/components/profile-activity.tsx`
- Modify: `src/components/profile-library.tsx`
- Modify: `src/routes/profile.$publicProfileId.tsx`

- [ ] **Step 1: Create `ProfileActivity` component**

Create `src/components/profile-activity.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { formatActivityMessage, type GameEntryProfileActivity } from "@/lib/game-entry";

export function ProfileActivity({ activity }: { activity: GameEntryProfileActivity }) {
  return (
    <section className="border-border/70 bg-card rounded-lg border p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="size-4" />
        <h2 className="text-sm font-semibold">Activity</h2>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <ActivityStat label="Active days" value={activity.summary.activeDays} />
        <ActivityStat label="Status updates" value={activity.summary.totalStatusUpdates} />
      </div>

      <ActivityHeatmap buckets={activity.heatmap} />

      <div className="mt-5 space-y-3">
        {activity.recent.length > 0 ? (
          activity.recent.map((item) => (
            <Link
              key={item.id}
              to="/games/$slug/overview"
              params={{ slug: item.slug }}
              className="flex items-center gap-3 rounded-md p-2 transition hover:bg-accent"
            >
              <div className="bg-muted size-10 overflow-hidden rounded-md">
                {item.coverUrl ? (
                  <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{formatActivityMessage(item)}</p>
                <p className="text-muted-foreground text-xs">{item.dayKey}</p>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">Status updates will appear here.</p>
        )}
      </div>
    </section>
  );
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border/70 bg-background rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ActivityHeatmap({ buckets }: { buckets: GameEntryProfileActivity["heatmap"] }) {
  const bucketMap = new Map(buckets.map((bucket) => [bucket.dayKey, bucket.count]));
  const days = buildRecentDayKeys(91);

  return (
    <div className="overflow-x-auto pb-1" aria-label="Profile activity heatmap">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
        {days.map((dayKey) => {
          const count = bucketMap.get(dayKey) ?? 0;

          return (
            <span
              key={dayKey}
              title={`${dayKey}: ${count} status update${count === 1 ? "" : "s"}`}
              className={`size-3 rounded-[3px] ${getHeatmapColor(count)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function buildRecentDayKeys(dayCount: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (dayCount - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function getHeatmapColor(count: number) {
  if (count >= 4) {
    return "bg-primary";
  }

  if (count >= 2) {
    return "bg-primary/70";
  }

  if (count === 1) {
    return "bg-primary/40";
  }

  return "bg-muted";
}
```

- [ ] **Step 2: Show playthrough labels on cards**

In `src/components/profile-library.tsx`, import `getPlaythroughLabel` and render below status metadata:

```tsx
const playthroughLabel = getPlaythroughLabel(game.playthroughCount);
```

Then add:

```tsx
{playthroughLabel ? <span>{playthroughLabel}</span> : null}
```

inside the metadata flex row.

- [ ] **Step 3: Render profile activity section**

In `src/routes/profile.$publicProfileId.tsx`, import:

```ts
import { ProfileActivity } from "@/components/profile-activity";
```

Render after the header section and before shelves:

```tsx
<div className="mt-5">
  <ProfileActivity activity={profile.activity} />
</div>
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/gameEntries.ts src/lib/game-entry.ts src/components/profile-activity.tsx src/components/profile-library.tsx 'src/routes/profile.$publicProfileId.tsx'
git commit -m "feat: show profile status activity" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 7: Final Verification And Cleanup

**Files:**
- Inspect all modified files.

- [ ] **Step 1: Run formatter check**

Run:

```bash
bun run format:check
```

Expected: PASS. If it fails, run `bun run format`, inspect the diff, and include formatting changes in the final commit.

- [ ] **Step 2: Run full check**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git diff --stat HEAD
git diff --check
```

Expected: no whitespace errors from `git diff --check`.

- [ ] **Step 5: Commit verification fixes if needed**

If any cleanup changes were made:

```bash
git add .
git commit -m "fix: polish playthrough activity implementation" -m "Co-authored-by: Codex <noreply@openai.com>"
```

If no cleanup changes were made, do not create an empty commit.

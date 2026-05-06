# User Activity and Playthroughs Design

## Summary

Add a user activity section to public profiles with an AniList-style heatmap, while changing library entries so a user can log multiple playthroughs of the same game. Activity counts status changes only. Ratings and reviews belong to individual playthroughs, but editing them does not add heatmap activity.

## Goals

- Let users log multiple playthroughs of the same game.
- Use the term "playthrough" for entry history.
- Use "Log replay" as the replay action label.
- Keep the current game page simple by editing the latest playthrough by default.
- Show profile activity from status changes with a heatmap and recent activity feed.
- Keep profile shelves readable by showing the latest playthrough per game.

## Non-Goals

- Activity does not count rating-only or review-only edits.
- The first implementation does not need a full per-game playthrough history page.
- The heatmap does not need to include passive browsing or follows.

## Data Model

Each `gameEntries` document represents one playthrough. Duplicate `{ userTokenIdentifier, igdbId }` rows are valid. A playthrough owns its own:

- game snapshot fields: `igdbId`, `slug`, `name`, `coverUrl`, `releaseYear`
- `status`
- `rating`
- `review`
- `createdAt`
- `updatedAt`

The current game-page entry is the latest playthrough for that user and game, ordered by `updatedAt`.

Required schema/index changes:

- Replace code paths that require a unique `{ userTokenIdentifier, igdbId }` entry.
- Add `by_userTokenIdentifier_and_igdbId_and_updatedAt` for latest playthrough lookup.
- Keep status shelf indexes efficient for profile reads.

Add a `gameEntryActivities` table for status-change activity:

- `userTokenIdentifier`
- `publicProfileId`
- `gameEntryId`
- `igdbId`
- `slug`
- `name`
- `coverUrl`
- `fromStatus`, nullable for a new playthrough
- `toStatus`
- `dayKey`, formatted as `YYYY-MM-DD`
- `createdAt`

Creating a playthrough creates one activity event for its initial status with `fromStatus: null`. Updating a playthrough creates activity only when `status` changes. Rating and review changes update the playthrough but do not create activity events.

## Product Behavior

On a game page where the user has existing playthroughs:

- The main form edits the latest playthrough.
- A secondary action says "Log replay".
- The replay flow opens the same entry form in create mode with title "Log another playthrough".
- A replay starts with a user-selected status and blank rating/review by default.
- The edit submit label is "Save playthrough"; the replay create submit label is "Log playthrough".

Public profile shelves show the latest playthrough per game rather than every playthrough. If a game has multiple playthroughs, the card displays a compact label such as "2 playthroughs".

The user activity section appears between the profile stat badges and shelves. It includes:

- summary stats for active days and total status updates
- a heatmap where each day value is the number of status activity events
- a recent activity feed with status-change wording

Example activity feed copy:

- "Started playing Game Name"
- "Completed Game Name"
- "Started replaying Game Name"
- "Completed a replay of Game Name"
- "Moved Game Name to Backlog"

Replay-specific feed text is used when the activity belongs to a non-first playthrough for that game.

## Backend API Shape

Update existing functions around playthrough semantics:

- `viewerEntry` becomes `viewerLatestEntry`, returning the latest playthrough for a game.
- Mutations edit a specific playthrough when given an entry id.
- Creating a new playthrough uses an explicit create-mode path used by "Log replay".
- Public profile reads return latest-per-game shelves, playthrough counts per game, activity summary, heatmap buckets, and recent activity events.

The implementation avoids unnecessary Convex request fanout. Profile data is assembled in the existing profile query where practical, with indexed reads and bounded recent activity limits.

Authorization must continue deriving the viewer from `ctx.auth.getUserIdentity()` and `identity.tokenIdentifier`. Client-provided user ids must not be trusted.

## UI Components

Add or update these UI pieces:

- `ActivityHeatmap`: renders day buckets and intensity levels from status activity counts.
- `ProfileActivity`: renders summary stats, heatmap, and recent activity feed.
- Profile shelf cards: optionally show a playthrough count label.
- Game entry form: supports edit-latest and replay-create wording.

The profile page must keep SSR auth behavior stable. Do not add `useConvexAuth()` gates or `"skip"` behavior around SSR-safe public profile reads.

## Testing

Add focused coverage for:

- status-change activity creation on new playthroughs
- status-change activity creation only when status changes
- rating/review edits not creating heatmap activity
- multiple playthroughs for the same game
- latest playthrough lookup
- public profile shelves deduping to latest playthrough per game
- playthrough count labels or returned counts

Before implementation is considered complete, run:

- `bun run check`
- `bun run test`

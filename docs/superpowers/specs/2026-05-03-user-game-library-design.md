# User Game Library Design

## Goal

Add the first logged-in user library flow for games. A user can save one primary status per IGDB game:

- `backlog`
- `playing`
- `completed`
- `dropped`

Rating and review are independent optional fields on that saved game entry. A user can save only a status, status plus rating, status plus review, or all fields together.

## Current Context

The app already has:

- Better Auth/Twitch login.
- Convex configured, but no app schema yet.
- IGDB game pages with normalized game data.
- A placeholder profile page.
- Existing game page actions: `Log Game`, `Write Review`, and `Add to Backlog`.

This feature should introduce the durable user/game model that those actions will use.

## Data Model

Create a Convex `gameEntries` table. Each authenticated user can have at most one entry per IGDB game.

Fields:

- `userTokenIdentifier`: stable authenticated identity from `ctx.auth.getUserIdentity().tokenIdentifier`
- `igdbId`: IGDB game id
- `slug`: IGDB game slug
- `name`: game name
- `coverUrl`: cached cover URL or `null`
- `releaseYear`: cached release year
- `status`: one of `backlog`, `playing`, `completed`, `dropped`
- `rating`: optional number, `null` when absent, valid values from `0.5` to `5` in `0.5` increments
- `review`: optional string, `null` when absent
- `createdAt`: timestamp in milliseconds
- `updatedAt`: timestamp in milliseconds

Indexes:

- `by_userTokenIdentifier_and_igdbId` for viewer entry lookup and upsert.
- `by_userTokenIdentifier_and_status` for profile shelves.
- `by_userTokenIdentifier` for profile summary counts.

Cached IGDB fields are intentional. Profile shelves should render without making one IGDB request per saved game.

## Convex API

All functions must derive the user from Convex auth. No public function accepts a user id for authorization.

Functions:

- `gameEntries.viewerEntry({ igdbId })`
  - Returns the current viewer's entry for a game, or `null`.

- `gameEntries.upsert({ game, status, rating, review })`
  - Creates or updates the current viewer's entry for a game.
  - `game` contains the IGDB display snapshot needed by profile shelves.
  - Status is required.
  - Rating is optional and nullable.
  - Review is optional and nullable.
  - Changing status preserves rating/review unless the client explicitly sends changed values.

- `gameEntries.listViewerProfile()`
  - Returns summary counts and grouped shelves for the current viewer.
  - Groups: `playing`, `backlog`, `completed`, `dropped`.
  - Shelves sort by most recently updated first.

## Game Page UX

The game page should expose one library action surface instead of treating backlog, log, rating, and review as unrelated features.

Not saved state:

- Primary action defaults to adding the game to `backlog`.
- User can choose another status before saving.
- Rating and review fields are available but optional.

Saved state:

- Show the current status.
- Allow status changes between `backlog`, `playing`, `completed`, and `dropped`.
- Preserve existing rating and review on status changes.
- Allow setting, changing, or clearing rating.
- Allow adding, editing, or clearing review text.

Rating control:

- Star rating from `0.5` to `5`.
- Half-star increments.
- Rating can be absent.

Review control:

- Plain text for the first version.
- Empty or whitespace-only review is stored as `null`.

## Profile Page UX

Profile first version:

- Top profile card using authenticated user data where available.
- Summary counts:
  - total saved games
  - backlog
  - playing
  - completed
  - dropped
- Four shelves:
  - Playing
  - Backlog
  - Completed
  - Dropped

Each shelf uses compact game cards backed by cached `gameEntries` fields. Cards link to `/games/$slug/overview`.

Reviews do not need a dedicated profile section in this first version. Review text can remain visible from future entry details or game community work.

## Validation And Error Handling

Convex mutation validation:

- Reject unauthenticated calls.
- Reject missing or invalid game id, slug, name, or status.
- Reject rating values outside `0.5` to `5`.
- Reject rating values that are not half-step increments.
- Normalize empty review strings to `null`.
- Trim review strings before storage.

Client behavior:

- Disabled or pending state while saving.
- Show an inline error if saving fails.
- Existing IGDB game page remains usable if the viewer is logged out, but saving prompts/signals auth is required.

## Testing

Unit-level coverage:

- Rating validation accepts half-star values and rejects invalid values.
- Review normalization converts whitespace-only input to `null`.
- Entry mapping preserves existing rating/review when only status changes.

Integration-level coverage where practical:

- Authenticated upsert creates a new entry.
- Repeated upsert for the same user/game updates the existing entry.
- Profile query groups entries by status and returns accurate counts.

Repo completion checks:

- `bun run format:check`
- `bun run lint`
- `bun run typecheck:tsgo`
- `bun run test`

## Out Of Scope

- Multiple lists per game.
- Custom user-created lists.
- Review likes, comments, visibility, or edit history.
- Public profile pages for other users.
- Activity feed history.
- Friends activity backed by real data.

import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const usernameMinLength = 3;
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

const shelfLimit = 12;
const shelfScanMaxEntries = shelfLimit * 25;
const profilePlaythroughCountScanLimit = 1_000;
const profileActivityScanLimit = 100;
const profileRecentActivityLimit = 12;

type EntryStatus = "backlog" | "playing" | "completed" | "dropped";

async function requireUserIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError("Authentication is required.");
  }

  return identity;
}

async function viewerIdentity(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity ?? null;
}

async function viewerTokenIdentifier(ctx: QueryCtx) {
  const identity = await viewerIdentity(ctx);
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

async function getStats(ctx: QueryCtx | MutationCtx, userTokenIdentifier: string) {
  return await ctx.db
    .query("gameEntryStats")
    .withIndex("by_userTokenIdentifier", (q) => q.eq("userTokenIdentifier", userTokenIdentifier))
    .unique();
}

async function getPublicUserProfile(ctx: QueryCtx | MutationCtx, publicProfileId: string) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_publicProfileId", (q) => q.eq("publicProfileId", publicProfileId))
    .unique();
}

async function upsertUserProfile(ctx: MutationCtx, identity: UserIdentity, now: number) {
  const userTokenIdentifier = identity.tokenIdentifier;
  const publicProfileId = publicProfileIdFromIdentity(identity);
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userTokenIdentifier", (q) => q.eq("userTokenIdentifier", userTokenIdentifier))
    .unique();
  const profile = {
    publicProfileId,
    displayName: displayNameFromIdentity(identity),
    imageUrl: null,
    updatedAt: now,
  };

  if (existingProfile) {
    await ctx.db.patch(existingProfile["_id"], profile);
    return publicProfileId;
  }

  await ctx.db.insert("userProfiles", {
    userTokenIdentifier,
    ...profile,
  });

  return publicProfileId;
}

async function getUserProfile(ctx: QueryCtx, userTokenIdentifier: string, publicProfileId: string) {
  const statsPromise = getStats(ctx, userTokenIdentifier);
  const playthroughCountsPromise = getProfilePlaythroughCounts(ctx, userTokenIdentifier);
  const [stats, playing, backlog, completed, dropped, activity] = await Promise.all([
    statsPromise,
    latestGamesByStatus(ctx, userTokenIdentifier, "playing", playthroughCountsPromise),
    latestGamesByStatus(ctx, userTokenIdentifier, "backlog", playthroughCountsPromise),
    latestGamesByStatus(ctx, userTokenIdentifier, "completed", playthroughCountsPromise),
    latestGamesByStatus(ctx, userTokenIdentifier, "dropped", playthroughCountsPromise),
    getProfileActivity(ctx, publicProfileId),
  ]);

  return {
    counts: {
      total: stats?.total ?? 0,
      backlog: stats?.backlog ?? 0,
      playing: stats?.playing ?? 0,
      completed: stats?.completed ?? 0,
      dropped: stats?.dropped ?? 0,
    },
    shelves: {
      playing,
      backlog,
      completed,
      dropped,
    },
    activity,
  };
}

async function getFollow(
  ctx: QueryCtx | MutationCtx,
  followerTokenIdentifier: string,
  followingTokenIdentifier: string,
) {
  return await ctx.db
    .query("follows")
    .withIndex("by_followerTokenIdentifier_and_followingTokenIdentifier", (q) =>
      q
        .eq("followerTokenIdentifier", followerTokenIdentifier)
        .eq("followingTokenIdentifier", followingTokenIdentifier),
    )
    .unique();
}

async function getViewerRelationship(
  ctx: QueryCtx,
  targetTokenIdentifier: string,
): Promise<"signedOut" | "self" | "none" | "following" | "followedBy" | "friends"> {
  const identity = await viewerIdentity(ctx);
  const viewerTokenIdentifier = identity?.tokenIdentifier ?? null;

  if (!viewerTokenIdentifier) {
    return "signedOut";
  }

  if (viewerTokenIdentifier === targetTokenIdentifier) {
    return "self";
  }

  const [viewerFollowsTarget, targetFollowsViewer] = await Promise.all([
    getFollow(ctx, viewerTokenIdentifier, targetTokenIdentifier),
    getFollow(ctx, targetTokenIdentifier, viewerTokenIdentifier),
  ]);

  if (viewerFollowsTarget && targetFollowsViewer) {
    return "friends";
  }

  if (viewerFollowsTarget) {
    return "following";
  }

  if (targetFollowsViewer) {
    return "followedBy";
  }

  return "none";
}

function usernameFromIdentity(identity: UserIdentity) {
  const user = identity as UserIdentity & {
    username?: string | null;
    preferredUsername?: string | null;
  };
  return user.username ?? user.preferredUsername ?? null;
}

function publicProfileIdFromIdentity(identity: UserIdentity) {
  const username = usernameFromIdentity(identity);

  if (!username || username.trim().length < usernameMinLength) {
    throw new ConvexError("Username is required.");
  }

  return normalizeUsername(username);
}

function displayNameFromIdentity(identity: UserIdentity) {
  return usernameFromIdentity(identity) ?? identity.name ?? "Player";
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function statusDelta(status: EntryStatus, from: EntryStatus | null, to: EntryStatus) {
  return (to === status ? 1 : 0) - (from === status ? 1 : 0);
}

function dayKeyFromTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function latestEntryForGame(ctx: QueryCtx, userTokenIdentifier: string, igdbId: number) {
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

async function getProfilePlaythroughCounts(ctx: QueryCtx, userTokenIdentifier: string) {
  const entries = await ctx.db
    .query("gameEntries")
    .withIndex("by_userTokenIdentifier", (q) => q.eq("userTokenIdentifier", userTokenIdentifier))
    .order("desc")
    .take(profilePlaythroughCountScanLimit);
  const countStateByGame = new Map<number, { count: number; maxPlaythroughIndex: number }>();

  for (const entry of entries) {
    const current = countStateByGame.get(entry.igdbId) ?? {
      count: 0,
      maxPlaythroughIndex: 0,
    };
    countStateByGame.set(entry.igdbId, {
      count: current.count + 1,
      maxPlaythroughIndex: Math.max(current.maxPlaythroughIndex, entry.playthroughIndex ?? 0),
    });
  }

  return new Map(
    Array.from(countStateByGame.entries()).map(([igdbId, state]) => [
      igdbId,
      Math.max(state.count, state.maxPlaythroughIndex),
    ]),
  );
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
  playthroughIndex,
  review,
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
  review: string | null;
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
    review,
    playthroughIndex,
    fromStatus,
    toStatus,
    dayKey: dayKeyFromTimestamp(now),
    createdAt: now,
  });
}

async function updateStatsForUpsert(
  ctx: MutationCtx,
  identity: UserIdentity,
  previousStatus: EntryStatus | null,
  nextStatus: EntryStatus,
  now: number,
) {
  const userTokenIdentifier = identity.tokenIdentifier;
  const publicProfileId = await upsertUserProfile(ctx, identity, now);
  const existingStats = await getStats(ctx, userTokenIdentifier);
  const baseStats = existingStats ?? {
    total: previousStatus === null ? 0 : 1,
    backlog: previousStatus === "backlog" ? 1 : 0,
    playing: previousStatus === "playing" ? 1 : 0,
    completed: previousStatus === "completed" ? 1 : 0,
    dropped: previousStatus === "dropped" ? 1 : 0,
  };
  const stats = {
    total: baseStats.total + (previousStatus === null ? 1 : 0),
    backlog: baseStats.backlog + statusDelta("backlog", previousStatus, nextStatus),
    playing: baseStats.playing + statusDelta("playing", previousStatus, nextStatus),
    completed: baseStats.completed + statusDelta("completed", previousStatus, nextStatus),
    dropped: baseStats.dropped + statusDelta("dropped", previousStatus, nextStatus),
    displayName: displayNameFromIdentity(identity),
    imageUrl: null,
    publicProfileId,
    updatedAt: now,
  };

  if (existingStats) {
    await ctx.db.patch(existingStats["_id"], stats);
    return;
  }

  await ctx.db.insert("gameEntryStats", {
    userTokenIdentifier,
    ...stats,
  });
}

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
  const userTokenIdentifier = identity.tokenIdentifier;
  assertGameSnapshot(args.game);

  const now = Date.now();
  const rating = args.rating === undefined ? null : normalizeRating(args.rating);
  const review = args.review === undefined ? null : normalizeReview(args.review);
  const game = {
    igdbId: args.game.igdbId,
    slug: args.game.slug.trim(),
    name: args.game.name.trim(),
    coverUrl: args.game.coverUrl?.trim() ?? null,
    releaseYear: args.game.releaseYear.trim(),
  };
  const playthroughIndex = await nextPlaythroughIndex(ctx, userTokenIdentifier, game.igdbId);

  await updateStatsForUpsert(ctx, identity, null, args.status, now);

  const entryId = await ctx.db.insert("gameEntries", {
    userTokenIdentifier,
    igdbId: game.igdbId,
    slug: game.slug,
    name: game.name,
    coverUrl: game.coverUrl,
    releaseYear: game.releaseYear,
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
    game,
    now,
    playthroughIndex,
    review,
    toStatus: args.status,
  });

  return entryId;
}

async function latestGamesByStatus(
  ctx: QueryCtx,
  userTokenIdentifier: string,
  status: EntryStatus,
  playthroughCountsPromise: Promise<Map<number, number>>,
) {
  const latestByGame = new Map<number, Doc<"gameEntries">>();
  let scannedEntryCount = 0;

  for await (const entry of ctx.db
    .query("gameEntries")
    .withIndex("by_userTokenIdentifier_and_status_and_updatedAt", (q) =>
      q.eq("userTokenIdentifier", userTokenIdentifier).eq("status", status),
    )
    .order("desc")) {
    scannedEntryCount += 1;

    if (!latestByGame.has(entry.igdbId)) {
      latestByGame.set(entry.igdbId, entry);
    }

    if (latestByGame.size >= shelfLimit || scannedEntryCount >= shelfScanMaxEntries) {
      break;
    }
  }

  const playthroughCounts = await playthroughCountsPromise;
  const result = [];

  for (const entry of latestByGame.values()) {
    result.push({
      ...entry,
      playthroughCount: Math.max(
        playthroughCounts.get(entry.igdbId) ?? 1,
        entry.playthroughIndex ?? 1,
      ),
      playthroughIndex: entry.playthroughIndex ?? 1,
    });
  }

  return result;
}

async function getProfileActivity(ctx: QueryCtx, publicProfileId: string) {
  const activities = await ctx.db
    .query("gameEntryActivities")
    .withIndex("by_publicProfileId_and_createdAt", (q) => q.eq("publicProfileId", publicProfileId))
    .order("desc")
    .take(profileActivityScanLimit);
  const countByDay = new Map<string, number>();

  for (const activity of activities) {
    countByDay.set(activity.dayKey, (countByDay.get(activity.dayKey) ?? 0) + 1);
  }

  const recent = [];

  for (const activity of activities.slice(0, profileRecentActivityLimit)) {
    recent.push({
      id: activity["_id"],
      dayKey: activity.dayKey,
      createdAt: activity.createdAt,
      igdbId: activity.igdbId,
      slug: activity.slug,
      name: activity.name,
      coverUrl: activity.coverUrl,
      review: activity.review ?? null,
      fromStatus: activity.fromStatus,
      toStatus: activity.toStatus,
      playthroughIndex: activity.playthroughIndex,
    });
  }

  return {
    summary: {
      recentActiveDays: countByDay.size,
      recentStatusUpdates: activities.length,
      recentActivityLimit: profileActivityScanLimit,
    },
    heatmap: Array.from(countByDay.entries())
      .map(([dayKey, count]) => ({ dayKey, count }))
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
    recent,
  };
}

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

export const viewerEntry = viewerLatestEntry;

export const upsert = mutation({
  args: {
    entryId: v.optional(v.id("gameEntries")),
    game: gameSnapshotValidator,
    status: statusValidator,
    rating: v.optional(v.union(v.number(), v.null())),
    review: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await requireUserIdentity(ctx);

    if (!args.entryId) {
      return await createPlaythroughEntry(ctx, identity, args);
    }

    const userTokenIdentifier = identity.tokenIdentifier;
    assertGameSnapshot(args.game);

    const existing = args.entryId ? await ctx.db.get(args.entryId) : null;

    if (existing && existing.userTokenIdentifier !== userTokenIdentifier) {
      throw new ConvexError("You can only edit your own playthroughs.");
    }

    if (!existing) {
      throw new ConvexError("Playthrough not found.");
    }

    if (existing.igdbId !== args.game.igdbId) {
      throw new ConvexError("Playthrough game does not match the requested game.");
    }

    const now = Date.now();
    const rating = args.rating === undefined ? existing.rating : normalizeRating(args.rating);
    const review = args.review === undefined ? existing.review : normalizeReview(args.review);
    const game = {
      igdbId: args.game.igdbId,
      slug: args.game.slug.trim(),
      name: args.game.name.trim(),
      coverUrl: args.game.coverUrl?.trim() ?? null,
      releaseYear: args.game.releaseYear.trim(),
    };
    const playthroughIndex = existing.playthroughIndex ?? 1;

    await updateStatsForUpsert(ctx, identity, existing.status, args.status, now);

    await ctx.db.patch(existing["_id"], {
      slug: game.slug,
      name: game.name,
      coverUrl: game.coverUrl,
      releaseYear: game.releaseYear,
      status: args.status,
      rating,
      review,
      updatedAt: now,
    });

    await recordStatusActivity({
      ctx,
      entryId: existing["_id"],
      fromStatus: existing.status,
      identity,
      game,
      now,
      playthroughIndex,
      review,
      toStatus: args.status,
    });

    return existing["_id"];
  },
});

export const createPlaythrough = mutation({
  args: {
    game: gameSnapshotValidator,
    status: statusValidator,
    rating: v.optional(v.union(v.number(), v.null())),
    review: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await requireUserIdentity(ctx);
    return await createPlaythroughEntry(ctx, identity, args);
  },
});

export const listViewerProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await viewerIdentity(ctx);
    const userTokenIdentifier = identity?.tokenIdentifier ?? null;

    if (!identity || !userTokenIdentifier) {
      return null;
    }

    const publicProfileId = publicProfileIdFromIdentity(identity);
    const profile = await getUserProfile(ctx, userTokenIdentifier, publicProfileId);

    return {
      profile,
      user: {
        name: displayNameFromIdentity(identity),
        image: null,
        publicProfileId,
      },
    };
  },
});

export const syncViewerProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireUserIdentity(ctx);
    return await upsertUserProfile(ctx, identity, Date.now());
  },
});

export const followPublicProfile = mutation({
  args: {
    publicProfileId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireUserIdentity(ctx);
    const followerTokenIdentifier = identity.tokenIdentifier;
    const trimmedPublicProfileId = args.publicProfileId.trim();

    if (trimmedPublicProfileId.length < usernameMinLength) {
      throw new ConvexError("A valid public profile id is required.");
    }

    const targetProfile = await getPublicUserProfile(ctx, trimmedPublicProfileId);

    if (!targetProfile) {
      throw new ConvexError("Profile not found.");
    }

    if (targetProfile.userTokenIdentifier === followerTokenIdentifier) {
      throw new ConvexError("You cannot follow yourself.");
    }

    const existingFollow = await getFollow(
      ctx,
      followerTokenIdentifier,
      targetProfile.userTokenIdentifier,
    );
    const now = Date.now();
    const followSnapshot = {
      followingPublicProfileId: targetProfile.publicProfileId,
      followingDisplayName: targetProfile.displayName,
      followingImageUrl: targetProfile.imageUrl,
      updatedAt: now,
    };

    if (existingFollow) {
      await ctx.db.patch(existingFollow["_id"], followSnapshot);
      return existingFollow["_id"];
    }

    return await ctx.db.insert("follows", {
      followerTokenIdentifier,
      followingTokenIdentifier: targetProfile.userTokenIdentifier,
      createdAt: now,
      ...followSnapshot,
    });
  },
});

export const getPublicProfile = query({
  args: {
    publicProfileId: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedPublicProfileId = normalizeUsername(args.publicProfileId);

    if (trimmedPublicProfileId.length < usernameMinLength) {
      return null;
    }

    const publicUserProfile = await getPublicUserProfile(ctx, trimmedPublicProfileId);

    if (publicUserProfile) {
      return {
        profile: await getUserProfile(
          ctx,
          publicUserProfile.userTokenIdentifier,
          publicUserProfile.publicProfileId,
        ),
        user: {
          name: publicUserProfile.displayName,
          image: publicUserProfile.imageUrl,
          publicProfileId: trimmedPublicProfileId,
        },
        viewerRelationship: await getViewerRelationship(ctx, publicUserProfile.userTokenIdentifier),
      };
    }

    const identity = await viewerIdentity(ctx);
    const userTokenIdentifier = identity?.tokenIdentifier ?? null;

    if (
      !identity ||
      !userTokenIdentifier ||
      publicProfileIdFromIdentity(identity) !== trimmedPublicProfileId
    ) {
      return null;
    }

    return {
      profile: await getUserProfile(ctx, userTokenIdentifier, trimmedPublicProfileId),
      user: {
        name: displayNameFromIdentity(identity),
        image: null,
        publicProfileId: trimmedPublicProfileId,
      },
      viewerRelationship: "self" as const,
    };
  },
});

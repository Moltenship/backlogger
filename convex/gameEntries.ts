import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const publicProfilePrefix = "u";
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

async function getPublicUserProfile(ctx: QueryCtx, publicProfileId: string) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_publicProfileId", (q) => q.eq("publicProfileId", publicProfileId))
    .unique();
}

async function upsertUserProfile(ctx: MutationCtx, identity: UserIdentity, now: number) {
  const userTokenIdentifier = identity.tokenIdentifier;
  const publicProfileId = publicProfileIdFromTokenIdentifier(userTokenIdentifier);
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userTokenIdentifier", (q) => q.eq("userTokenIdentifier", userTokenIdentifier))
    .unique();
  const profile = {
    publicProfileId,
    displayName: identity.name ?? "Player",
    imageUrl: identity.pictureUrl ?? null,
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

async function getUserProfile(ctx: QueryCtx, userTokenIdentifier: string) {
  const stats = await getStats(ctx, userTokenIdentifier);
  const [playing, backlog, completed, dropped] = await Promise.all([
    latestEntriesByStatus(ctx, userTokenIdentifier, "playing"),
    latestEntriesByStatus(ctx, userTokenIdentifier, "backlog"),
    latestEntriesByStatus(ctx, userTokenIdentifier, "completed"),
    latestEntriesByStatus(ctx, userTokenIdentifier, "dropped"),
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
  };
}

function publicProfileIdFromTokenIdentifier(userTokenIdentifier: string) {
  return `${publicProfilePrefix}_${hashString(userTokenIdentifier)}`;
}

function hashString(value: string) {
  let hash = 17;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % Number.MAX_SAFE_INTEGER;
  }

  return Math.abs(hash).toString(36);
}

function statusDelta(status: EntryStatus, from: EntryStatus | null, to: EntryStatus) {
  return (to === status ? 1 : 0) - (from === status ? 1 : 0);
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
    displayName: identity.name ?? "Player",
    imageUrl: identity.pictureUrl ?? null,
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

async function latestEntriesByStatus(
  ctx: QueryCtx,
  userTokenIdentifier: string,
  status: EntryStatus,
) {
  return await ctx.db
    .query("gameEntries")
    .withIndex("by_userTokenIdentifier_and_status_and_updatedAt", (q) =>
      q.eq("userTokenIdentifier", userTokenIdentifier).eq("status", status),
    )
    .order("desc")
    .take(shelfLimit);
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
    const identity = await requireUserIdentity(ctx);
    const userTokenIdentifier = identity.tokenIdentifier;
    assertGameSnapshot(args.game);

    const existing = await ctx.db
      .query("gameEntries")
      .withIndex("by_userTokenIdentifier_and_igdbId", (q) =>
        q.eq("userTokenIdentifier", userTokenIdentifier).eq("igdbId", args.game.igdbId),
      )
      .unique();
    const now = Date.now();
    const rating =
      args.rating === undefined ? (existing?.rating ?? null) : normalizeRating(args.rating);
    const review =
      args.review === undefined ? (existing?.review ?? null) : normalizeReview(args.review);
    const coverUrl = args.game.coverUrl?.trim() ?? null;
    await updateStatsForUpsert(ctx, identity, existing?.status ?? null, args.status, now);

    if (existing) {
      const existingId = existing["_id"];

      await ctx.db.patch(existingId, {
        slug: args.game.slug.trim(),
        name: args.game.name.trim(),
        coverUrl,
        releaseYear: args.game.releaseYear.trim(),
        status: args.status,
        rating,
        review,
        updatedAt: now,
      });

      return existingId;
    }

    return await ctx.db.insert("gameEntries", {
      userTokenIdentifier,
      igdbId: args.game.igdbId,
      slug: args.game.slug.trim(),
      name: args.game.name.trim(),
      coverUrl,
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
    const identity = await viewerIdentity(ctx);
    const userTokenIdentifier = identity?.tokenIdentifier ?? null;

    if (!identity || !userTokenIdentifier) {
      return null;
    }

    const profile = await getUserProfile(ctx, userTokenIdentifier);

    return {
      profile,
      user: {
        name: identity.name ?? "Player",
        image: identity.pictureUrl ?? null,
        publicProfileId: publicProfileIdFromTokenIdentifier(userTokenIdentifier),
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

export const getPublicProfile = query({
  args: {
    publicProfileId: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedPublicProfileId = args.publicProfileId.trim();

    if (!trimmedPublicProfileId.startsWith(`${publicProfilePrefix}_`)) {
      return null;
    }

    const publicUserProfile = await getPublicUserProfile(ctx, trimmedPublicProfileId);

    if (publicUserProfile) {
      return {
        profile: await getUserProfile(ctx, publicUserProfile.userTokenIdentifier),
        user: {
          name: publicUserProfile.displayName,
          image: publicUserProfile.imageUrl,
          publicProfileId: trimmedPublicProfileId,
        },
      };
    }

    const identity = await viewerIdentity(ctx);
    const userTokenIdentifier = identity?.tokenIdentifier ?? null;

    if (
      !identity ||
      !userTokenIdentifier ||
      publicProfileIdFromTokenIdentifier(userTokenIdentifier) !== trimmedPublicProfileId
    ) {
      return null;
    }

    return {
      profile: await getUserProfile(ctx, userTokenIdentifier),
      user: {
        name: identity.name ?? "Player",
        image: identity.pictureUrl ?? null,
        publicProfileId: trimmedPublicProfileId,
      },
    };
  },
});

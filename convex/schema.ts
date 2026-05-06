import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userProfiles: defineTable({
    userTokenIdentifier: v.string(),
    publicProfileId: v.string(),
    displayName: v.string(),
    imageUrl: v.union(v.string(), v.null()),
    updatedAt: v.number(),
  })
    .index("by_userTokenIdentifier", ["userTokenIdentifier"])
    .index("by_publicProfileId", ["publicProfileId"]),
  follows: defineTable({
    followerTokenIdentifier: v.string(),
    followingTokenIdentifier: v.string(),
    followingPublicProfileId: v.string(),
    followingDisplayName: v.string(),
    followingImageUrl: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_followerTokenIdentifier", ["followerTokenIdentifier"])
    .index("by_followingTokenIdentifier", ["followingTokenIdentifier"])
    .index("by_followerTokenIdentifier_and_followingTokenIdentifier", [
      "followerTokenIdentifier",
      "followingTokenIdentifier",
    ]),
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
    playthroughIndex: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userTokenIdentifier_and_igdbId", ["userTokenIdentifier", "igdbId"])
    .index("by_userTokenIdentifier_and_igdbId_and_updatedAt", [
      "userTokenIdentifier",
      "igdbId",
      "updatedAt",
    ])
    .index("by_userTokenIdentifier_and_status", ["userTokenIdentifier", "status"])
    .index("by_userTokenIdentifier_and_status_and_updatedAt", [
      "userTokenIdentifier",
      "status",
      "updatedAt",
    ])
    .index("by_userTokenIdentifier", ["userTokenIdentifier"]),
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
    .index("by_publicProfileId_and_createdAt", [
      "publicProfileId",
      "createdAt",
    ]),
  gameEntryStats: defineTable({
    userTokenIdentifier: v.string(),
    publicProfileId: v.optional(v.string()),
    displayName: v.optional(v.string()),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    total: v.number(),
    backlog: v.number(),
    playing: v.number(),
    completed: v.number(),
    dropped: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userTokenIdentifier", ["userTokenIdentifier"])
    .index("by_publicProfileId", ["publicProfileId"]),
});

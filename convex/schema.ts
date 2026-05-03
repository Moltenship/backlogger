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
    .index("by_userTokenIdentifier_and_status_and_updatedAt", [
      "userTokenIdentifier",
      "status",
      "updatedAt",
    ])
    .index("by_userTokenIdentifier", ["userTokenIdentifier"]),
  gameEntryStats: defineTable({
    userTokenIdentifier: v.string(),
    total: v.number(),
    backlog: v.number(),
    playing: v.number(),
    completed: v.number(),
    dropped: v.number(),
    updatedAt: v.number(),
  }).index("by_userTokenIdentifier", ["userTokenIdentifier"]),
});

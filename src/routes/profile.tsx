import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { Star, UserRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  GAME_ENTRY_STATUS_LABELS,
  GAME_ENTRY_STATUSES,
  type GameEntryProfile,
  type GameEntryStatus,
} from "@/lib/game-entry";
import { Route as RootRoute } from "@/routes/__root";

import { api } from "../../convex/_generated/api";

const PROFILE_SHELF_STATUSES = ["playing", "backlog", "completed", "dropped"] as const;

export const Route = createFileRoute("/profile")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(convexQuery(api.gameEntries.listViewerProfile, {}));
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { isSidebarCollapsed } = useRouteContext({ from: RootRoute.id });
  const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}));
  const { data: profile } = useSuspenseQuery(convexQuery(api.gameEntries.listViewerProfile, {}));
  const isSignedIn = Boolean(user);
  const initials = getInitials(user?.name ?? "User");

  async function signInWithTwitch() {
    await authClient.signIn.social({ provider: "twitch" });
  }

  return (
    <AppShell initialSidebarCollapsed={isSidebarCollapsed}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-border/70 bg-card rounded-lg border p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            {user?.image ? (
              <img src={user.image} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <div className="bg-primary text-primary-foreground grid size-14 place-items-center rounded-full text-lg font-semibold">
                {isSignedIn ? initials : <UserRound className="size-5" />}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">Profile</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {user?.name ?? "Signed out"}
              </h1>
              {isSignedIn ? (
                <p className="text-muted-foreground mt-1 truncate text-sm">Twitch account</p>
              ) : null}
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
          ) : null}

          {!isSignedIn ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={signInWithTwitch}>Sign in with Twitch</Button>
              <p className="text-muted-foreground text-sm">Sign in to build your game library.</p>
            </div>
          ) : null}
        </section>

        {profile ? (
          <div className="mt-5 space-y-5">
            {PROFILE_SHELF_STATUSES.map((status) => (
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
    <div className="border-border/70 bg-background rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ProfileShelf({
  games,
  status,
}: {
  games: GameEntryProfile["shelves"][GameEntryStatus];
  status: GameEntryStatus;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {GAME_ENTRY_STATUS_LABELS[status]}
          </h2>
          <p className="text-muted-foreground text-sm">
            {games.length === 0 ? "No games yet." : `${games.length} recent games`}
          </p>
        </div>
        <Badge variant="secondary">{games.length}</Badge>
      </div>

      {games.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {games.map((game) => (
            <ProfileGameCard key={game.igdbId} game={game} />
          ))}
        </div>
      ) : (
        <div className="border-border/70 bg-card text-muted-foreground rounded-lg border p-5 text-sm">
          Games you mark as {GAME_ENTRY_STATUS_LABELS[status].toLowerCase()} will appear here.
        </div>
      )}
    </section>
  );
}

function ProfileGameCard({ game }: { game: GameEntryProfile["shelves"][GameEntryStatus][number] }) {
  return (
    <Link to="/games/$slug/overview" params={{ slug: game.slug }} className="group min-w-0">
      <div className="bg-muted aspect-[3/4] overflow-hidden rounded-md">
        {game.coverUrl ? (
          <img
            src={game.coverUrl}
            alt=""
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center">
            <span className="text-muted-foreground text-xs font-medium">{game.name}</span>
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-5 font-medium">{game.name}</p>
      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>{game.releaseYear}</span>
        <span className="flex items-center gap-1">
          <Star className="size-3 fill-current" />
          {formatRating(game.rating)}
        </span>
      </div>
    </Link>
  );
}

function formatRating(value: number | null) {
  return value === null ? "N/A" : value.toFixed(value % 1 === 0 ? 0 : 1);
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

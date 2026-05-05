import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { UserRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CountBadge, PROFILE_SHELF_STATUSES, ProfileShelf } from "@/components/profile-library";
import { buttonVariants } from "@/components/ui/button";
import { GAME_ENTRY_STATUS_LABELS, type GameEntryProfile } from "@/lib/game-entry";
import { Route as RootRoute } from "@/routes/__root";

import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/profile/$publicProfileId")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.gameEntries.getPublicProfile, {
        publicProfileId: params.publicProfileId,
      }),
    );
  },
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { publicProfileId } = Route.useParams();
  const { isSidebarCollapsed } = useRouteContext({ from: RootRoute.id });
  const { data } = useSuspenseQuery(
    convexQuery(api.gameEntries.getPublicProfile, {
      publicProfileId,
    }),
  );

  return (
    <AppShell initialSidebarCollapsed={isSidebarCollapsed}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {data ? (
          <PublicProfileContent profile={data.profile} user={data.user} />
        ) : (
          <section className="border-border/70 bg-card rounded-lg border p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">Public profile</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile not found</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              This profile is not public yet or the link is incorrect.
            </p>
            <Link to="/" className={buttonVariants({ className: "mt-4", variant: "outline" })}>
              Go home
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function PublicProfileContent({
  profile,
  user,
}: {
  profile: GameEntryProfile;
  user: { image: string | null; name: string; publicProfileId: string };
}) {
  const initials = getInitials(user.name);

  return (
    <>
      <section className="border-border/70 bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {user.image ? (
            <img src={user.image} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div className="bg-primary text-primary-foreground grid size-14 place-items-center rounded-full text-lg font-semibold">
              {initials || <UserRound className="size-5" />}
            </div>
          )}

          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">Public profile</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{user.name}</h1>
            <p className="text-muted-foreground mt-1 truncate text-sm">Game library</p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          <CountBadge label="Total" value={profile.counts.total} />
          {PROFILE_SHELF_STATUSES.map((status) => (
            <CountBadge
              key={status}
              label={GAME_ENTRY_STATUS_LABELS[status]}
              value={profile.counts[status]}
            />
          ))}
        </div>
      </section>

      <div className="mt-5 space-y-5">
        {PROFILE_SHELF_STATUSES.map((status) => (
          <ProfileShelf
            key={status}
            status={status}
            games={profile.shelves[status]}
            emptyText={`Games marked as ${GAME_ENTRY_STATUS_LABELS[status].toLowerCase()} will appear here.`}
          />
        ))}
      </div>
    </>
  );
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

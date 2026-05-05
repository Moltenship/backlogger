import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { UserRound } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { CountBadge, PROFILE_SHELF_STATUSES, ProfileShelf } from "@/components/profile-library";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { GAME_ENTRY_STATUS_LABELS, type GameEntryProfile } from "@/lib/game-entry";
import { Route as RootRoute } from "@/routes/__root";

import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/profile/$publicProfileId")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.gameEntries.getPublicProfile, {
        publicProfileId: params.publicProfileId,
      }),
    ),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { publicProfileId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const { isAuthenticated, isSidebarCollapsed } = useRouteContext({ from: RootRoute.id });
  const convexAuth = useConvexAuth();
  const canSubscribeToProfile = !isAuthenticated || convexAuth.isAuthenticated;
  const { data } = useQuery(
    convexQuery(
      api.gameEntries.getPublicProfile,
      canSubscribeToProfile
        ? {
            publicProfileId,
          }
        : "skip",
    ),
  );
  const profileData = data ?? loaderData;

  return (
    <AppShell initialSidebarCollapsed={isSidebarCollapsed}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {profileData ? (
          <PublicProfileContent
            profile={profileData.profile}
            user={profileData.user}
            viewerRelationship={profileData.viewerRelationship}
          />
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
  viewerRelationship,
}: {
  profile: GameEntryProfile;
  user: { image: string | null; name: string; publicProfileId: string };
  viewerRelationship: "signedOut" | "self" | "none" | "following" | "followedBy" | "friends";
}) {
  const initials = getInitials(user.name);
  const followPublicProfile = useMutation(api.gameEntries.followPublicProfile);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  async function signInWithTwitch() {
    await authClient.signIn.social({ provider: "twitch" });
  }

  async function followProfile() {
    setIsFollowing(true);
    setFollowError(null);

    try {
      await followPublicProfile({ publicProfileId: user.publicProfileId });
    } catch (error) {
      setFollowError(`Could not follow ${user.name}. ${getErrorMessage(error)}`);
    } finally {
      setIsFollowing(false);
    }
  }

  return (
    <>
      <section className="border-border/70 bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
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

          <FollowButton
            relationship={viewerRelationship}
            isSubmitting={isFollowing}
            onFollow={followProfile}
            onSignIn={signInWithTwitch}
          />
        </div>

        {followError ? <p className="mt-4 text-sm text-red-400">{followError}</p> : null}

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

function FollowButton({
  isSubmitting,
  onFollow,
  onSignIn,
  relationship,
}: {
  isSubmitting: boolean;
  onFollow: () => void;
  onSignIn: () => void;
  relationship: "signedOut" | "self" | "none" | "following" | "followedBy" | "friends";
}) {
  if (relationship === "self") {
    return null;
  }

  if (relationship === "signedOut") {
    return (
      <Button variant="outline" onClick={onSignIn}>
        Sign in to follow
      </Button>
    );
  }

  if (relationship === "friends") {
    return (
      <Button variant="secondary" disabled>
        Friends
      </Button>
    );
  }

  if (relationship === "following") {
    return (
      <Button variant="secondary" disabled>
        Following
      </Button>
    );
  }

  return (
    <Button onClick={onFollow} disabled={isSubmitting}>
      {relationship === "followedBy" ? "Follow back" : "Follow"}
    </Button>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

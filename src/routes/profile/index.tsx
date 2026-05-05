import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, redirect, useRouteContext } from "@tanstack/react-router";
import { UserRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DevAdminLoginButton } from "@/components/dev-admin-login-button";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Route as RootRoute } from "@/routes/__root";

import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/profile/")({
  loader: async ({ context }) => {
    const viewerProfile = await context.queryClient.ensureQueryData(
      convexQuery(api.gameEntries.listViewerProfile, {}),
    );

    if (viewerProfile?.user.publicProfileId) {
      throw redirect({
        to: "/profile/$publicProfileId",
        params: { publicProfileId: viewerProfile.user.publicProfileId },
      });
    }
  },
  component: ProfileIndexPage,
});

function ProfileIndexPage() {
  const { isSidebarCollapsed } = useRouteContext({ from: RootRoute.id });

  async function signInWithTwitch() {
    await authClient.signIn.social({ provider: "twitch" });
  }

  return (
    <AppShell initialSidebarCollapsed={isSidebarCollapsed}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-border/70 bg-card rounded-lg border p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-primary text-primary-foreground grid size-14 place-items-center rounded-full text-lg font-semibold">
              <UserRound className="size-5" />
            </div>

            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">Profile</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight">Signed out</h1>
              <p className="text-muted-foreground mt-1 truncate text-sm">
                Sign in to open your public game library.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={signInWithTwitch}>Sign in with Twitch</Button>
            <DevAdminLoginButton size="default" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

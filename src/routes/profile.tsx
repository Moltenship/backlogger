import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-svh max-w-4xl items-center px-6 py-12">
        <div>
          <p className="text-muted-foreground text-sm">Profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Profile setup comes next.</h1>
        </div>
      </div>
    </AppShell>
  );
}

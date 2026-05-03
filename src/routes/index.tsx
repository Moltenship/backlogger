import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-svh max-w-5xl items-center px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-muted-foreground text-sm">Backlogger</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Track games with IGDB data.
          </h1>
          <p className="text-muted-foreground mt-4 leading-7">
            The first IGDB slice is ready: a server-backed game detail page with game info,
            screenshots, similar games, and mocked friends activity.
          </p>
          <Link
            to="/games/$gameId"
            params={{ gameId: "1942" }}
            className={buttonVariants({ className: "mt-6" })}
          >
            Open game page
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

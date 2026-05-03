import { Link } from "@tanstack/react-router";
import { Gamepad2, Home, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="grid min-h-svh lg:grid-cols-[15rem_1fr]">
        <aside className="border-border/70 bg-card/70 hidden border-r lg:block">
          <div className="sticky top-0 flex h-svh flex-col px-5 py-6">
            <Link to="/" className="mb-8 flex items-center gap-3 text-lg font-semibold">
              <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-md">
                B
              </span>
              Backlogger
            </Link>

            <nav className="space-y-1">
              <NavLink to="/" icon={Home} label="Home" />
              <NavLink
                to="/games/$gameId"
                params={{ gameId: "1942" }}
                icon={Gamepad2}
                label="Games"
              />
              <NavLink to="/profile" icon={UserRound} label="Profile" />
            </nav>

            <div className="border-border/70 text-muted-foreground mt-auto rounded-lg border p-4 text-xs leading-relaxed">
              IGDB data loads through the app server so Twitch credentials stay private.
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  icon: Icon,
  label,
  params,
  to,
}: {
  icon: typeof Home;
  label: string;
  params?: { gameId: string };
  to: "/" | "/games/$gameId" | "/profile";
}) {
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
      )}
      activeProps={{
        className: "bg-accent text-accent-foreground",
      }}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

import { Link } from "@tanstack/react-router";
import { Gamepad2, Home, LogOut, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
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

            <SidebarProfileCard />
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function SidebarProfileCard() {
  const { data: session, isPending } = authClient.useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = session?.user;
  const initials = getInitials(user?.name ?? user?.email ?? "Player");

  async function signInWithTwitch() {
    setIsSubmitting(true);

    try {
      await authClient.signIn.social({
        provider: "twitch",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    setIsSubmitting(true);

    try {
      await authClient.signOut();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isPending) {
    return (
      <div className="border-border/70 mt-auto rounded-lg border p-4">
        <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
        <div className="bg-muted mt-4 h-3 w-24 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-3 w-32 animate-pulse rounded" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="border-border/70 mt-auto rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="bg-muted grid size-10 place-items-center rounded-full">
            <UserRound className="text-muted-foreground size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Guest</p>
            <p className="text-muted-foreground text-xs">Sign in to track games</p>
          </div>
        </div>
        <Button
          className="mt-4 w-full"
          size="sm"
          onClick={signInWithTwitch}
          disabled={isSubmitting}
        >
          Sign in with Twitch
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border/70 mt-auto rounded-lg border p-4">
      <div className="flex items-center gap-3">
        {user.image ? (
          <img src={user.image} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-full text-sm font-medium">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name ?? "Player"}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email ?? "Twitch account"}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Link to="/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Profile
        </Link>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={signOut}
          disabled={isSubmitting}
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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

import { Link } from "@tanstack/react-router";
import { Gamepad2, Home, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "backlogger:sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });

  function toggleSidebar() {
    setIsSidebarCollapsed((value) => {
      const nextValue = !value;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "b" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      toggleSidebar();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div
        className={cn(
          "grid min-h-svh transition-[grid-template-columns] duration-200 lg:grid-cols-[15rem_1fr]",
          isSidebarCollapsed && "lg:grid-cols-[4.75rem_1fr]",
        )}
      >
        <aside className="border-border/70 bg-card/70 hidden border-r lg:block">
          <div
            className={cn(
              "sticky top-0 flex h-svh flex-col px-5 py-6",
              isSidebarCollapsed && "items-center px-3",
            )}
          >
            <div
              className={cn(
                "mb-8 flex w-full items-center gap-2",
                isSidebarCollapsed && "justify-center",
              )}
            >
              {isSidebarCollapsed ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  className="group size-9 p-0"
                >
                  <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-md group-hover:hidden group-focus-visible:hidden">
                    B
                  </span>
                  <PanelLeftOpen className="hidden size-4 group-hover:block group-focus-visible:block" />
                </Button>
              ) : (
                <>
                  <Link
                    to="/"
                    className="flex min-w-0 flex-1 items-center gap-3 text-lg font-semibold"
                  >
                    <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-md">
                      B
                    </span>
                    <span className="truncate">Backlogger</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleSidebar}
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="size-4" />
                  </Button>
                </>
              )}
            </div>

            <nav className={cn("flex w-full flex-col gap-1", isSidebarCollapsed && "items-center")}>
              <NavLink to="/" icon={Home} label="Home" isCollapsed={isSidebarCollapsed} />
              <NavLink
                to="/games/$slug/overview"
                params={{ slug: "the-witcher-3-wild-hunt" }}
                icon={Gamepad2}
                label="Games"
                isCollapsed={isSidebarCollapsed}
              />
              <NavLink
                to="/profile"
                icon={UserRound}
                label="Profile"
                isCollapsed={isSidebarCollapsed}
              />
            </nav>

            <SidebarProfileCard isCollapsed={isSidebarCollapsed} />
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function SidebarProfileCard({ isCollapsed }: { isCollapsed: boolean }) {
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
      <div
        className={cn(
          "border-border/70 mt-auto rounded-lg border p-4",
          isCollapsed && "grid w-10 place-items-center border-0 p-0",
        )}
      >
        <div className="bg-muted size-10 animate-pulse rounded-full" />
        <div
          className={cn("bg-muted mt-4 h-3 w-24 animate-pulse rounded", isCollapsed && "sr-only")}
        />
        <div
          className={cn("bg-muted mt-2 h-3 w-32 animate-pulse rounded", isCollapsed && "sr-only")}
        />
      </div>
    );
  }

  if (!user) {
    if (isCollapsed) {
      return (
        <Button
          className="mt-auto"
          size="icon"
          variant="outline"
          onClick={signInWithTwitch}
          disabled={isSubmitting}
          aria-label="Sign in with Twitch"
        >
          <UserRound className="size-4" />
        </Button>
      );
    }

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

  if (isCollapsed) {
    return (
      <Link to="/profile" className="mt-auto" aria-label="Profile">
        {user.image ? (
          <img src={user.image} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-full text-sm font-medium">
            {initials}
          </div>
        )}
      </Link>
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
  isCollapsed,
  label,
  params,
  to,
}: {
  icon: typeof Home;
  isCollapsed: boolean;
  label: string;
  params?: { slug: string };
  to: "/" | "/games/$slug/overview" | "/profile";
}) {
  return (
    <Link
      to={to}
      params={params}
      aria-label={isCollapsed ? label : undefined}
      className={cn(
        "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
        isCollapsed && "size-10 justify-center px-0 py-0",
      )}
      activeProps={{
        className: "bg-accent text-accent-foreground",
      }}
    >
      <Icon className="size-4" />
      <span className={cn(isCollapsed && "sr-only")}>{label}</span>
    </Link>
  );
}

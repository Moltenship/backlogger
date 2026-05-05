import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Gamepad2, Home, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { DevAdminLoginButton } from "@/components/dev-admin-login-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { api } from "../../convex/_generated/api";

const SIDEBAR_STORAGE_KEY = "backlogger:sidebar-collapsed";
export const SIDEBAR_COOKIE_NAME = "backlogger-sidebar-collapsed";
const SIDEBAR_PERSIST_MAX_AGE = 60 * 60 * 24 * 365;

export function AppShell({
  children,
  initialSidebarCollapsed = false,
}: {
  children: ReactNode;
  initialSidebarCollapsed?: boolean;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    usePersistentSidebarState(initialSidebarCollapsed);

  function toggleSidebar() {
    setIsSidebarCollapsed((value) => !value);
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

function usePersistentSidebarState(
  initialValue: boolean,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);

    if (storedValue === null) {
      return;
    }

    const nextValue = storedValue === "true";

    if (nextValue !== initialValue) {
      setValue(nextValue);
      persistSidebarState(nextValue);
    }
  }, [initialValue]);

  function setPersistentValue(action: SetStateAction<boolean>) {
    setValue((currentValue) => {
      const nextValue = typeof action === "function" ? action(currentValue) : action;
      persistSidebarState(nextValue);
      return nextValue;
    });
  }

  return [value, setPersistentValue];
}

function persistSidebarState(value: boolean) {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${String(value)}; path=/; max-age=${SIDEBAR_PERSIST_MAX_AGE}; SameSite=Lax`;
}

function SidebarProfileCard({ isCollapsed }: { isCollapsed: boolean }) {
  const { data: currentUser } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}));
  const { data: session } = authClient.useSession();
  const syncViewerProfile = useMutation(api.gameEntries.syncViewerProfile);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = session?.user ?? currentUser;
  const initials = getInitials(user?.name ?? "Player");

  useEffect(() => {
    if (!user) {
      return;
    }

    syncViewerProfile({}).catch((error: unknown) => {
      console.error(error);
    });
  }, [syncViewerProfile, user]);

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
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            location.reload();
          },
        },
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <DevAdminLoginButton className="mt-2 w-full" />
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
          <p className="text-muted-foreground truncate text-xs">Twitch account</p>
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

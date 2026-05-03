import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convexQuery, type ConvexQueryClient } from "@convex-dev/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { SIDEBAR_COOKIE_NAME } from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";

import { api } from "../../convex/_generated/api";

import appCss from "../styles.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => await getToken());
const getUiPreferences = createServerFn({ method: "GET" }).handler(() => ({
  isSidebarCollapsed: getCookie(SIDEBAR_COOKIE_NAME) === "true",
}));

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Backlogger",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  beforeLoad: async (ctx) => {
    const [token, uiPreferences] = await Promise.all([getAuth(), getUiPreferences()]);

    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    await ctx.context.queryClient.ensureQueryData(convexQuery(api.auth.getCurrentUser, {}));

    return {
      isAuthenticated: Boolean(token),
      isSidebarCollapsed: uiPreferences.isSidebarCollapsed,
      token,
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });

  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <RootDocument>
        <Outlet />
      </RootDocument>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

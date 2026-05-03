import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient, type ConvexReactClient as ConvexReactClientType } from "convex/react";
import { useState, type ReactNode } from "react";

import { authClient } from "@/lib/auth-client";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [convex] = useState<ConvexReactClientType | null>(() =>
    convexUrl
      ? new ConvexReactClient(convexUrl, {
          expectAuth: true,
        })
      : null,
  );

  if (!convex) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        {children}
      </ConvexBetterAuthProvider>
    </QueryClientProvider>
  );
}

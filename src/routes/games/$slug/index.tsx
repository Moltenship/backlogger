import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/games/$slug/")({
  loader: ({ params }) => {
    throw redirect({
      to: "/games/$slug/overview",
      params,
    });
  },
});

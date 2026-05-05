import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("ssr auth query policy", () => {
  it("keeps auth-tolerant Convex reads subscribed during the client auth handoff", () => {
    expect.assertions(1);

    const files = [
      "src/components/app-shell.tsx",
      "src/routes/games/$slug.tsx",
      "src/routes/profile.$publicProfileId.tsx",
    ];
    const authHandoffGates = files.map((file) => {
      const source = readProjectFile(file);

      return {
        file,
        hasCanSubscribeGate: source.includes("canSubscribeTo"),
        hasSkipFallback: source.includes(': "skip"'),
      };
    });

    expect(authHandoffGates).toStrictEqual([
      {
        file: "src/components/app-shell.tsx",
        hasCanSubscribeGate: false,
        hasSkipFallback: false,
      },
      {
        file: "src/routes/games/$slug.tsx",
        hasCanSubscribeGate: false,
        hasSkipFallback: false,
      },
      {
        file: "src/routes/profile.$publicProfileId.tsx",
        hasCanSubscribeGate: false,
        hasSkipFallback: false,
      },
    ]);
  });
});

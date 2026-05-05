import { describe, expect, it } from "vitest";

import { getFollowButtonState } from "@/lib/profile-relationship";

describe("profile relationship helpers", () => {
  it("hides the follow button while authenticated relationship data is stale", () => {
    expect.assertions(1);

    expect(
      getFollowButtonState({
        isAuthenticated: true,
        relationship: "signedOut",
      }),
    ).toStrictEqual({
      isDisabled: true,
      label: null,
      kind: "hidden",
    });
  });
});

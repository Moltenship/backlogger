export type ViewerRelationship =
  | "signedOut"
  | "self"
  | "none"
  | "following"
  | "followedBy"
  | "friends";

export type FollowButtonState =
  | {
      kind: "hidden";
      isDisabled: true;
      label: null;
    }
  | {
      kind: "signIn" | "follow" | "status";
      isDisabled: boolean;
      label: string;
    };

export function getFollowButtonState({
  isAuthenticated,
  isSubmitting = false,
  relationship,
}: {
  isAuthenticated: boolean;
  isSubmitting?: boolean;
  relationship: ViewerRelationship;
}): FollowButtonState {
  if (relationship === "self") {
    return {
      isDisabled: true,
      label: null,
      kind: "hidden",
    };
  }

  if (relationship === "signedOut") {
    if (isAuthenticated) {
      return {
        isDisabled: true,
        label: null,
        kind: "hidden",
      };
    }

    return {
      isDisabled: false,
      label: "Sign in to follow",
      kind: "signIn",
    };
  }

  if (relationship === "friends") {
    return {
      isDisabled: true,
      label: "Friends",
      kind: "status",
    };
  }

  if (relationship === "following") {
    return {
      isDisabled: true,
      label: "Following",
      kind: "status",
    };
  }

  return {
    isDisabled: isSubmitting,
    label: relationship === "followedBy" ? "Follow back" : "Follow",
    kind: "follow",
  };
}

import { ShieldCheck } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { isDevAdminLoginEnabled, signInDevAdmin } from "@/lib/dev-admin-auth";

export function DevAdminLoginButton({
  className,
  size = "sm",
  variant = "outline",
}: Pick<ComponentProps<typeof Button>, "className" | "size" | "variant">) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isDevAdminLoginEnabled) {
    return null;
  }

  async function signIn() {
    setIsSubmitting(true);

    try {
      await signInDevAdmin();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      className={className}
      size={size}
      variant={variant}
      onClick={signIn}
      disabled={isSubmitting}
    >
      <ShieldCheck data-icon="inline-start" />
      Dev admin
    </Button>
  );
}

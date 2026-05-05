import { authClient } from "@/lib/auth-client";

const devAdminEmail = import.meta.env.VITE_DEV_ADMIN_EMAIL as string | undefined;
const devAdminPassword = import.meta.env.VITE_DEV_ADMIN_PASSWORD as string | undefined;
const devAdminName = (import.meta.env.VITE_DEV_ADMIN_NAME as string | undefined) ?? "Admin Tester";

export const isDevAdminLoginEnabled =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_DEV_ADMIN_LOGIN === "true" &&
  Boolean(devAdminEmail) &&
  Boolean(devAdminPassword);

export async function signInDevAdmin() {
  if (!isDevAdminLoginEnabled || !devAdminEmail || !devAdminPassword) {
    throw new Error("Dev admin login is not enabled.");
  }

  const signInResult = await authClient.signIn.email({
    email: devAdminEmail,
    password: devAdminPassword,
  });

  if (!signInResult.error) {
    location.reload();
    return;
  }

  const signUpResult = await authClient.signUp.email({
    email: devAdminEmail,
    password: devAdminPassword,
    name: devAdminName,
  });

  if (signUpResult.error) {
    throw new Error(signUpResult.error.message ?? "Could not sign in as dev admin.");
  }

  location.reload();
}

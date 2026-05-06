import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { GalleryVerticalEnd } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GithubDark } from "@/components/ui/svgs/githubDark";
import { Twitch } from "@/components/ui/svgs/twitch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { Route as RootRoute } from "@/routes/__root";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

type AuthMode = "login" | "signup";
type SocialProvider = "github" | "twitch";
type LastAuthMethod = "email" | SocialProvider;

const usernameMinLength = 3;

function SignInPage() {
  const { isSidebarCollapsed } = useRouteContext({ from: RootRoute.id });

  return (
    <AppShell initialSidebarCollapsed={isSidebarCollapsed}>
      <div className="bg-muted flex min-h-svh items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link to="/" className="flex items-center gap-2 self-center font-medium">
            <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd data-icon="inline-start" />
            </span>
            Backlogger
          </Link>
          <LoginForm />
        </div>
      </div>
    </AppShell>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [lastMethod, setLastMethod] = useState<LastAuthMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedMethod = authClient.getLastUsedLoginMethod();

    if (storedMethod === "email" || storedMethod === "github" || storedMethod === "twitch") {
      setLastMethod(storedMethod);
    }
  }, []);

  async function signInWithSocial(provider: SocialProvider) {
    setIsSubmitting(true);
    setError(null);

    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/profile",
      });
    } catch (authError) {
      setError(
        `Could not start ${socialProviderLabel(provider)} sign in. ${getErrorMessage(authError)}`,
      );
      setIsSubmitting(false);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const username = normalizeUsername(String(formData.get("username") ?? ""));

    try {
      if (mode === "signup") {
        if (username.length < usernameMinLength) {
          throw new Error("Username must be at least 3 characters.");
        }

        await authClient.signUp.email({
          email,
          name: username,
          password,
          username,
          displayUsername: username,
        });
      } else {
        await authClient.signIn.email({
          email,
          password,
        });
      }

      await navigate({ to: "/profile" });
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            Email login, GitHub, or Twitch with username profile slugs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitEmail}>
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => signInWithSocial("github")}
                  disabled={isSubmitting}
                >
                  <GithubDark data-icon="inline-start" />
                  Continue with GitHub
                  <LastUsedBadge method="github" lastMethod={lastMethod} />
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => signInWithSocial("twitch")}
                  disabled={isSubmitting}
                >
                  <Twitch data-icon="inline-start" />
                  Continue with Twitch
                  <LastUsedBadge method="twitch" lastMethod={lastMethod} />
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="mt-5">
                  <EmailFields mode="login" lastMethod={lastMethod} />
                </TabsContent>
                <TabsContent value="signup" className="mt-5">
                  <EmailFields mode="signup" lastMethod={lastMethod} />
                </TabsContent>
              </Tabs>
              {error ? <FieldError>{error}</FieldError> : null}
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {mode === "login" ? "Login" : "Create account"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function EmailFields({ lastMethod, mode }: { lastMethod: LastAuthMethod | null; mode: AuthMode }) {
  return (
    <FieldGroup>
      {mode === "signup" ? (
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input id="username" name="username" minLength={usernameMinLength} required />
        </Field>
      ) : null}
      <Field>
        <div className="flex items-center gap-2">
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <LastUsedBadge method="email" lastMethod={lastMethod} />
        </div>
        <Input id="email" name="email" type="email" placeholder="m@example.com" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <Input id="password" name="password" type="password" required />
      </Field>
    </FieldGroup>
  );
}

function LastUsedBadge({
  lastMethod,
  method,
}: {
  lastMethod: LastAuthMethod | null;
  method: LastAuthMethod;
}) {
  if (lastMethod !== method) {
    return null;
  }

  return (
    <Badge className="ml-auto" variant="secondary">
      Last used
    </Badge>
  );
}

function socialProviderLabel(provider: SocialProvider) {
  return provider === "github" ? "GitHub" : "Twitch";
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : String(error);
  }

  return String(error);
}

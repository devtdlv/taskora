import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSafeRedirectPath } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in | Taskora",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const redirectPath = getSafeRedirectPath((await searchParams).next);

  // Already signed in, so go straight to where the login would have led,
  // which keeps invitation links working.
  if (await getCurrentUser()) {
    redirect(redirectPath);
  }

  return <LoginForm redirectPath={redirectPath} />;
}

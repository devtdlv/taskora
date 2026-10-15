import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSafeRedirectPath } from "@/lib/redirect";
import { getCurrentUser } from "@/lib/session";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create an account | Taskora",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const redirectPath = getSafeRedirectPath((await searchParams).next);

  // Same as the login page: signed-in users skip the form.
  if (await getCurrentUser()) {
    redirect(redirectPath);
  }

  return <SignupForm redirectPath={redirectPath} />;
}

import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { needsEmailVerification } from "@/lib/email-verification-policy";
import { getCurrentUser } from "@/lib/session";
import { verifyEmailPath } from "@/lib/verify-email-path";

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

// For protected pages and layouts. Every page calls this itself, because
// layouts don't re-run on client-side navigation. The session lookup is cached
// per request, so calling it in both costs no extra query.
export async function requireVerifiedUser(path: string): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (needsEmailVerification(user)) {
    redirect(verifyEmailPath(path));
  }

  return user;
}

type ApiAuthResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse };

// For protected route handlers. Membership and ownership checks still happen
// in each handler after this.
export async function requireVerifiedApiUser(
  unauthorizedMessage: string,
): Promise<ApiAuthResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED", message: unauthorizedMessage },
        { status: 401 },
      ),
    };
  }

  if (needsEmailVerification(user)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "EMAIL_NOT_VERIFIED",
          message: "Verify your email address to continue.",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user };
}

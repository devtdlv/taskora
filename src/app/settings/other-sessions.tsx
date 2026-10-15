"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { verifyEmailPath } from "@/lib/verify-email-path";

function resultMessage(count: number) {
  if (count === 0) {
    return "You weren't signed in anywhere else.";
  }

  return `Signed out of ${count} other ${count === 1 ? "session" : "sessions"}.`;
}

export function OtherSessions() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);

  async function handleSignOut() {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setIsSigningOut(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/account/other-sessions", {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setNotice(resultMessage(data.signedOutSessions ?? 0));
        return;
      }

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (data.error === "EMAIL_NOT_VERIFIED") {
        router.push(verifyEmailPath(window.location.pathname));
        return;
      }

      setError(data.message ?? "Unable to sign out other sessions.");
    } catch {
      setError("Something went wrong while signing out other sessions. Please try again.");
    } finally {
      inFlight.current = false;
      setIsSigningOut(false);
    }
  }

  return (
    <section aria-labelledby="sessions-heading" className="tk-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="sessions-heading" className="tk-section-title">
            Sessions
          </h2>
          <p id="sessions-description" className="mt-1 text-sm leading-6 text-zinc-600">
            Sign out on every other browser and device. You&apos;ll stay signed in here.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-busy={isSigningOut}
          aria-describedby="sessions-description"
          className="tk-btn tk-btn-secondary w-full shrink-0 sm:w-auto"
        >
          {isSigningOut ? "Signing out..." : "Sign out of other sessions"}
        </button>
      </div>

      {error && (
        <div role="alert" className="tk-alert-error mt-4">
          {error}
        </div>
      )}

      {notice && (
        <p role="status" className="mt-4 text-sm text-emerald-700">
          {notice}
        </p>
      )}
    </section>
  );
}

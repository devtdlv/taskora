import Link from "next/link";

import { verifyEmailPath } from "@/lib/verify-email-path";

type EmailStatusProps = {
  email: string;
  verified: boolean;
};

export function EmailStatus({ email, verified }: EmailStatusProps) {
  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm font-medium break-all text-ink">{email}</p>

        <span
          className={`tk-badge shrink-0 self-start sm:self-auto ${
            verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {verified ? "Verified" : "Not verified"}
        </span>
      </div>

      {verified ? (
        <p className="tk-hint">Account emails, such as password resets, are sent here.</p>
      ) : (
        <p className="tk-hint">
          Confirm this address so we can reach you about your account.{" "}
          <Link href={verifyEmailPath("/settings")} className="tk-link">
            Verify your email
          </Link>
        </p>
      )}
    </div>
  );
}

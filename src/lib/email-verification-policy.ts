import "server-only";

// Off unless set to exactly "true", so a missing or mistyped value never
// locks existing accounts out.
export function isEmailVerificationEnforced() {
  return process.env.ENFORCE_EMAIL_VERIFICATION === "true";
}

export function needsEmailVerification(user: { emailVerifiedAt: Date | null }) {
  return isEmailVerificationEnforced() && !user.emailVerifiedAt;
}

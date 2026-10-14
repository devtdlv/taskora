// Login and signup don't need an existing session, so SameSite cookies don't
// stop another site from posting to them (for example, to log a visitor into
// an attacker's account). Browsers always send Origin on cross-site POSTs, so
// a request whose Origin isn't ours is rejected.
//
// In production the trusted origin comes from APP_URL rather than the request,
// so Host and X-Forwarded-* headers are never trusted. If APP_URL is missing,
// browser requests are rejected instead of silently allowed.
export function isTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  // Non-browser clients such as curl don't send Origin and can't be used to
  // forge a request from someone else's browser. Only a missing header counts
  // as absent; an empty or malformed value is compared like any other.
  if (origin === null) {
    return true;
  }

  return origin === getTrustedOrigin(request);
}

function getTrustedOrigin(request: Request) {
  if (process.env.APP_URL) {
    return new URL(process.env.APP_URL).origin;
  }

  if (process.env.NODE_ENV !== "production") {
    return new URL(request.url).origin;
  }

  console.error("APP_URL is not set, so authentication requests are rejected.");
  return null;
}

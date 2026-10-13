const FALLBACK_PATH = "/dashboard";
const INTERNAL_ORIGIN = "http://taskora.internal";

// Only same-site paths are allowed so a crafted ?next= link can't send someone
// to another site after they log in. Browsers treat "//host" and "/\host" as
// links to another host, and URL parsing silently drops tabs and newlines, so
// "/\t/host" becomes "//host". Backslashes and whitespace are rejected
// outright. The path part also can't hold encoded slashes, backslashes, or
// whitespace, which a proxy that decodes paths could turn back into "//host";
// the query may, since nested next values are encoded there. The result is
// then parsed to make sure it stays on this origin.
export function getSafeRedirectPath(next: string | string[] | undefined) {
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    /[\\\s]/.test(next) ||
    /%(2f|5c|09|0a|0d|20)/i.test(next.split(/[?#]/)[0])
  ) {
    return FALLBACK_PATH;
  }

  let url: URL;

  try {
    url = new URL(next, INTERNAL_ORIGIN);
  } catch {
    return FALLBACK_PATH;
  }

  if (url.origin !== INTERNAL_ORIGIN) {
    return FALLBACK_PATH;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

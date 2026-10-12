import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash() {
  return window.location.hash;
}

// The server never sees the fragment, so it renders the loading state.
function getServerHash() {
  return null;
}

// Emailed links carry their token in the fragment, which browsers never send
// to the server or in Referer headers. Returns undefined until the browser has
// read it, null or "" when the link has no token, and the token otherwise.
export function useFragmentToken() {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);

  return hash === null
    ? undefined
    : new URLSearchParams(hash.slice(1)).get("token");
}

// Removes the token from the address bar and the current history entry, while
// keeping the router's history state intact.
export function clearUrlFragment() {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
}

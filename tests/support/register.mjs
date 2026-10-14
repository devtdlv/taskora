// Loaded with node --import before any test file.

import { register } from "node:module";

register("./ts-hooks.mjs", import.meta.url);

// Tests never send email or call other services. Without an API key the email
// module refuses to send, and any request that still gets through fails.
delete process.env.RESEND_API_KEY;

globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  throw new Error(`Network access is disabled in tests (${new URL(url).host}).`);
};

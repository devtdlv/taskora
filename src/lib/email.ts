import "server-only";

import {
  passwordResetEmail,
  verificationEmail,
  type EmailContent,
} from "@/lib/email-templates";

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;
const RESEND_TESTING_DOMAIN = "resend.dev";

// "Name <address@domain>" or a bare address. Line breaks are never allowed.
const SENDER_PATTERN =
  /^(?:[^<>"\r\n]+<([^<>\s@]+@[^<>\s@]+)>|([^<>\s@]+@[^<>\s@]+))$/;

type EmailConfig = {
  apiKey: string;
  from: string;
  appOrigin: string;
};

type EmailConfigError =
  | "MISSING_API_KEY"
  | "INVALID_SENDER"
  | "TESTING_SENDER_IN_PRODUCTION"
  | "INVALID_APP_URL";

export type SendEmailResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "NOT_CONFIGURED"
        | "INVALID_RECIPIENT"
        | "TIMEOUT"
        | "NETWORK_ERROR"
        | "REJECTED"
        | "RATE_LIMITED"
        | "PROVIDER_ERROR";
    };

type TokenLinkPath = "/verify-email/confirm" | "/reset-password";

function getEmailConfig():
  | { ok: true; config: EmailConfig }
  | { ok: false; error: EmailConfigError } {
  const isProduction = process.env.NODE_ENV === "production";
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey) {
    return { ok: false, error: "MISSING_API_KEY" };
  }

  const senderMatch = from?.match(SENDER_PATTERN);

  if (!from || !senderMatch) {
    return { ok: false, error: "INVALID_SENDER" };
  }

  const senderAddress = senderMatch[1] ?? senderMatch[2];
  const senderDomain = senderAddress.split("@")[1].toLowerCase();

  // Resend's testing sender only delivers to the Resend account owner's
  // address, so it can't serve real users. It's only accepted under next dev.
  if (isProduction && senderDomain === RESEND_TESTING_DOMAIN) {
    return { ok: false, error: "TESTING_SENDER_IN_PRODUCTION" };
  }

  const appOrigin = parseAppOrigin(process.env.APP_URL, isProduction);

  if (!appOrigin) {
    return { ok: false, error: "INVALID_APP_URL" };
  }

  return { ok: true, config: { apiKey, from, appOrigin } };
}

// Links in emails always point at APP_URL and never at the request's Host
// header, so a forged Host can't turn a reset email into a link to another site.
function parseAppOrigin(value: string | undefined, isProduction: boolean) {
  if (!value) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const allowedProtocols = isProduction ? ["https:"] : ["https:", "http:"];

  if (
    !allowedProtocols.includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return null;
  }

  return url.origin;
}

// The token goes in the fragment, which browsers never send to the server, so
// it stays out of request logs and Referer headers.
function buildTokenLink(appOrigin: string, path: TokenLinkPath, token: string) {
  const url = new URL(path, appOrigin);
  url.hash = new URLSearchParams({ token }).toString();

  return url.toString();
}

function logDeliveryFailure(
  reason: string,
  details: { status?: number; providerError?: string } = {},
) {
  // Never log the recipient, the message, or the link: the link contains a
  // live token.
  console.error("Email delivery failed:", { reason, ...details });
}

async function sendEmail(
  to: string,
  buildContent: (appOrigin: string) => EmailContent,
): Promise<SendEmailResult> {
  const configResult = getEmailConfig();

  if (!configResult.ok) {
    logDeliveryFailure("NOT_CONFIGURED", { providerError: configResult.error });
    return { ok: false, error: "NOT_CONFIGURED" };
  }

  if (/[\r\n]/.test(to) || !to.includes("@")) {
    return { ok: false, error: "INVALID_RECIPIENT" };
  }

  const { apiKey, from, appOrigin } = configResult.config;
  const content = buildContent(appOrigin);

  let response: Response;

  try {
    response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      logDeliveryFailure("TIMEOUT");
      return { ok: false, error: "TIMEOUT" };
    }

    logDeliveryFailure("NETWORK_ERROR");
    return { ok: false, error: "NETWORK_ERROR" };
  }

  const data: unknown = await response.json().catch(() => null);
  const providerError =
    data && typeof data === "object" && "name" in data
      ? String(data.name)
      : undefined;

  if (!response.ok) {
    logDeliveryFailure("PROVIDER_RESPONSE", {
      status: response.status,
      providerError,
    });

    if (response.status === 429) {
      return { ok: false, error: "RATE_LIMITED" };
    }

    return {
      ok: false,
      error: response.status < 500 ? "REJECTED" : "PROVIDER_ERROR",
    };
  }

  // Only a response that names the created email counts as sent.
  if (
    !data ||
    typeof data !== "object" ||
    !("id" in data) ||
    typeof data.id !== "string"
  ) {
    logDeliveryFailure("MALFORMED_RESPONSE", { status: response.status });
    return { ok: false, error: "PROVIDER_ERROR" };
  }

  return { ok: true, id: data.id };
}

export function sendVerificationEmail(to: string, token: string) {
  return sendEmail(to, (appOrigin) =>
    verificationEmail(
      buildTokenLink(appOrigin, "/verify-email/confirm", token),
    ),
  );
}

export function sendPasswordResetEmail(to: string, token: string) {
  return sendEmail(to, (appOrigin) =>
    passwordResetEmail(buildTokenLink(appOrigin, "/reset-password", token)),
  );
}

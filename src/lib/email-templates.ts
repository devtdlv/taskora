import "server-only";

import {
  EMAIL_VERIFICATION_TOKEN_LIFETIME_MS,
  PASSWORD_RESET_TOKEN_LIFETIME_MS,
} from "@/lib/token";

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function formatLifetime(lifetimeMs: number) {
  const minutes = Math.round(lifetimeMs / 60_000);

  if (minutes % 60 !== 0) {
    return `${minutes} minutes`;
  }

  const hours = minutes / 60;

  return hours === 1 ? "1 hour" : `${hours} hours`;
}

type LayoutOptions = {
  title: string;
  intro: string;
  actionLabel: string;
  link: string;
  expiry: string;
  footer: string;
};

// Inline styles and a table layout because many email clients ignore <style>
// blocks and modern CSS. No images or remote assets, so nothing is fetched
// when the email is opened.
function renderHtml({
  title,
  intro,
  actionLabel,
  link,
  expiry,
  footer,
}: LayoutOptions) {
  const href = escapeHtml(link);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
            <tr>
              <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
                <p style="margin:0 0 24px;font-size:16px;font-weight:600;">Taskora</p>
                <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;font-weight:600;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#3f3f46;">${escapeHtml(intro)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:#18181b;">
                      <a href="${href}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(actionLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:14px;line-height:22px;color:#3f3f46;">${escapeHtml(expiry)}</p>
                <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#52525b;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="margin:4px 0 0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${href}" style="color:#4338ca;">${href}</a></p>
                <hr style="margin:24px 0;border:none;border-top:1px solid #e4e4e7;">
                <p style="margin:0;font-size:13px;line-height:20px;color:#52525b;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText({
  title,
  intro,
  actionLabel,
  link,
  expiry,
  footer,
}: LayoutOptions) {
  return [
    "Taskora",
    "",
    title,
    "",
    intro,
    "",
    `${actionLabel}:`,
    link,
    "",
    expiry,
    "",
    footer,
  ].join("\n");
}

function renderEmail(subject: string, options: LayoutOptions): EmailContent {
  return {
    subject,
    html: renderHtml(options),
    text: renderText(options),
  };
}

export function verificationEmail(link: string) {
  return renderEmail("Verify your email address for Taskora", {
    title: "Verify your email address",
    intro:
      "Thanks for signing up for Taskora. Confirm this is your email address to finish setting up your account.",
    actionLabel: "Verify email address",
    link,
    expiry: `This link expires in ${formatLifetime(EMAIL_VERIFICATION_TOKEN_LIFETIME_MS)} and can only be used once.`,
    footer:
      "If you didn't create a Taskora account, you can ignore this email.",
  });
}

export function passwordResetEmail(link: string) {
  return renderEmail("Reset your Taskora password", {
    title: "Reset your password",
    intro:
      "We received a request to reset the password for your Taskora account. Choose a new password using the link below.",
    actionLabel: "Reset password",
    link,
    expiry: `This link expires in ${formatLifetime(PASSWORD_RESET_TOKEN_LIFETIME_MS)} and can only be used once. Resetting your password signs you out on every device.`,
    footer:
      "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
  });
}

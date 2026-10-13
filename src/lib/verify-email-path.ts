export function verifyEmailPath(next: string) {
  return `/verify-email?next=${encodeURIComponent(next)}`;
}

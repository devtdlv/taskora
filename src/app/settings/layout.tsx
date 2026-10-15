import { AppShell } from "@/components/app-shell";
import { requireVerifiedUser } from "@/lib/auth-guard";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireVerifiedUser("/settings");

  return <AppShell user={user}>{children}</AppShell>;
}

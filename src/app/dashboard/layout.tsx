import { AppShell } from "@/components/app-shell";
import { requireVerifiedUser } from "@/lib/auth-guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireVerifiedUser("/dashboard");

  return <AppShell user={user}>{children}</AppShell>;
}

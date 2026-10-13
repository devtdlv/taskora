import { AppShell } from "@/components/app-shell";
import { requireVerifiedUser } from "@/lib/auth-guard";

export default async function NewWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireVerifiedUser("/workspaces/new");

  return <AppShell user={user}>{children}</AppShell>;
}

import { Breadcrumbs } from "@/components/breadcrumbs";
import { requireVerifiedUser } from "@/lib/auth-guard";

import { CreateWorkspaceForm } from "./create-workspace-form";

export default async function NewWorkspacePage() {
  await requireVerifiedUser("/workspaces/new");

  return (
    <div className="max-w-2xl">
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "New workspace" }]}
      />

      <div className="tk-card mt-4 p-5 sm:p-8">
        <h1 className="tk-page-title">Create a workspace</h1>

        <p className="tk-page-description">
          A workspace is where your team&apos;s projects and tasks live.
          You&apos;ll be its owner.
        </p>

        <div className="mt-8">
          <CreateWorkspaceForm />
        </div>
      </div>
    </div>
  );
}

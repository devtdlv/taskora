import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireVerifiedUser } from "@/lib/auth-guard";
import { getProjectTask } from "@/services/task.service";

type TaskLayoutProps = {
  params: Promise<{ slug: string; projectSlug: string; taskId: string }>;
};

async function loadTask(params: TaskLayoutProps["params"]) {
  const { slug, projectSlug, taskId } = await params;
  const user = await requireVerifiedUser(
    `/workspaces/${slug}/projects/${projectSlug}/tasks/${taskId}`,
  );

  return getProjectTask(user.id, slug, projectSlug, taskId);
}

export async function generateMetadata({
  params,
}: TaskLayoutProps): Promise<Metadata> {
  const task = await loadTask(params);

  if (!task) {
    return {};
  }

  return {
    title: { absolute: `${task.title} - ${task.project.name} | Taskora` },
  };
}

// Like the project layout, this runs outside the task's loading.tsx so a
// missing or inaccessible task gets a real 404 status before streaming starts.
export default async function TaskLayout({
  children,
  params,
}: TaskLayoutProps & { children: React.ReactNode }) {
  if (!(await loadTask(params))) {
    notFound();
  }

  return children;
}

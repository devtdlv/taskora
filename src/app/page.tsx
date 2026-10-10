import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

const features = [
  {
    title: "Workspaces",
    description:
      "Give each team its own workspace, with its own members and projects kept separate from everyone else's.",
  },
  {
    title: "Workspace invitations",
    description:
      "Invite teammates with a link that only works for the email address it was created for.",
  },
  {
    title: "Projects",
    description:
      "Group related tasks into projects so each piece of work has a clear home.",
  },
  {
    title: "Kanban boards",
    description:
      "Move tasks between To do, In progress, and Done, and see exactly where every task stands.",
  },
  {
    title: "Assignments and due dates",
    description:
      "Give every task an owner from your workspace and a date it needs to be finished by.",
  },
  {
    title: "Task comments",
    description:
      "Discuss the work on the task itself, so questions and decisions stay with the work.",
  },
];

const boardColumns = [
  {
    title: "To do",
    tasks: [
      { title: "Finalize onboarding flow", assignee: "Alex", due: "Oct 14" },
      { title: "Write API documentation", assignee: "Jamie", due: "Oct 18" },
    ],
  },
  {
    title: "In progress",
    tasks: [
      { title: "Launch pricing page", assignee: "Theodore", due: "Oct 12" },
      { title: "Review homepage copy", assignee: "Alex", due: "Oct 10" },
    ],
  },
  {
    title: "Done",
    tasks: [
      { title: "Create project workspace", assignee: "Theodore", due: "Oct 2" },
      { title: "Set up design system", assignee: "Jamie", due: "Oct 6" },
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-28 text-center sm:pt-36">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-medium text-zinc-500">
              Project management for focused teams
            </p>

            <h1 className="mt-5 text-5xl font-semibold tracking-tight sm:text-6xl">
              Keep your team and projects moving forward.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              Taskora brings projects, tasks, and team collaboration into one
              workspace so everyone knows what needs to happen next.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="tk-btn tk-btn-primary tk-btn-lg w-full px-5 sm:w-auto"
              >
                Start for free
              </Link>

              <a
                href="#features"
                className="tk-btn tk-btn-secondary tk-btn-lg w-full px-5 sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* Product preview */}
        <section className="mx-auto max-w-6xl px-6 pb-28">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Website launch</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Everything Digital
                </p>
              </div>

              <div className="flex -space-x-2">
                {["TD", "AL", "JM"].map((member) => (
                  <div
                    key={member}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-[10px] font-semibold text-zinc-700"
                  >
                    {member}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3">
              {boardColumns.map((column) => (
                <div key={column.title} className="rounded-xl bg-zinc-100 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-medium">{column.title}</h2>
                    <span className="text-xs text-zinc-500">
                      {column.tasks.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {column.tasks.map((task) => (
                      <div
                        key={task.title}
                        className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                      >
                        <p className="text-sm font-medium">{task.title}</p>

                        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                          <span className="text-zinc-700">{task.assignee}</span>
                          <span>Due {task.due}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="border-y border-zinc-200 bg-zinc-50"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-zinc-500">
                Everything in one place
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built around the way teams actually work.
              </h2>

              <p className="mt-4 text-lg leading-8 text-zinc-600">
                Organize projects, track work, and keep your team aligned
                without jumping between different tools.
              </p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="bg-white p-7">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                    <div className="h-3 w-3 rounded-sm bg-zinc-900" />
                  </div>

                  <h3 className="font-semibold">{feature.title}</h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="mx-auto grid max-w-6xl gap-16 px-6 py-28 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              From idea to done
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Give every piece of work a clear path forward.
            </h2>

            <p className="mt-5 text-lg leading-8 text-zinc-600">
              Break projects into manageable tasks, assign responsibility, and
              move work through your team&apos;s workflow as progress happens.
            </p>

            <div className="mt-8 space-y-6">
              {[
                ["01", "Create the work", "Turn project goals into clear tasks."],
                [
                  "02",
                  "Assign ownership",
                  "Make it clear who is responsible and when it's due.",
                ],
                [
                  "03",
                  "Track progress",
                  "Move tasks through the board until the work is complete.",
                ],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-4">
                  <span className="text-sm font-medium text-zinc-500">
                    {number}
                  </span>

                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">
                Launch pricing page
              </h3>

              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Publish the new pricing page and link to it from the site
                navigation and the signup flow.
              </p>

              <div className="mt-6 border-t border-zinc-100 pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Assignee</span>
                  <span className="font-medium">Theodore</span>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Status</span>
                  <span className="font-medium">In progress</span>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Due date</span>
                  <span className="font-medium">Oct 12</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Collaboration */}
        <section className="border-y border-zinc-200 bg-zinc-950 text-white">
          <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-medium text-zinc-400">
                Work together
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Keep the conversation next to the work.
              </h2>

              <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-400">
                Comments and assignments stay connected to each task, giving
                your team the context they need without searching through
                separate conversations.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold">
                  AL
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Alex Lee</span>
                    <span className="text-xs text-zinc-400">10:42 AM</span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    The pricing page is ready for review. I also updated the
                    signup link we discussed yesterday.
                  </p>
                </div>
              </div>

              <div className="my-6 border-t border-zinc-800" />

              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-zinc-950">
                  TD
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Theodore</span>
                    <span className="text-xs text-zinc-400">10:48 AM</span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Looks good. I&apos;ll give it one last check and move the
                    task to Done.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-6 py-28 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Give your team a clearer way to work.
            </h2>

            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Create a workspace, bring your projects together, and keep
              everyone focused on what comes next.
            </p>

            <Link
              href="/signup"
              className="tk-btn tk-btn-primary tk-btn-lg mt-8 px-5"
            >
              Create your workspace
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-zinc-950">Taskora</p>

          <p>Project management for focused teams.</p>
        </div>
      </footer>
    </div>
  );
}
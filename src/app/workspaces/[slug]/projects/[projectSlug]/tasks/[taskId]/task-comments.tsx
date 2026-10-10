"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

import { getInitials } from "@/lib/initials";

type Comment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  isOwn: boolean;
};

type TaskCommentsProps = {
  taskUrl: string;
  comments: Comment[];
};

export function TaskComments({ taskUrl, comments }: TaskCommentsProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{
    commentId: string;
    message: string;
  } | null>(null);

  const isPostBusy = isPosting || (isRefreshing && deletingId === null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPostBusy) {
      return;
    }

    setFormError("");
    setIsPosting(true);

    try {
      const response = await fetch(`/api${taskUrl}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        setFormError(
          data.fields?.body?.[0] ??
            data.message ??
            "Unable to post your comment.",
        );
        return;
      }

      startTransition(() => {
        setBody("");
        router.refresh();
      });
    } catch {
      setFormError("Something went wrong while posting. Please try again.");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm("Delete this comment? This can't be undone.")) {
      return;
    }

    setDeleteError(null);
    setDeletingId(commentId);

    try {
      const response = await fetch(`/api${taskUrl}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      // A 404 means the comment is already gone, so refreshing is still the
      // right way to bring the list up to date.
      if (response.ok || response.status === 404) {
        startTransition(() => {
          setDeletingId(null);
          router.refresh();
        });
        return;
      }

      const data = await response.json();
      setDeleteError({
        commentId,
        message: data.message ?? "Unable to delete the comment.",
      });
      setDeletingId(null);
    } catch {
      setDeleteError({
        commentId,
        message: "Something went wrong while deleting. Please try again.",
      });
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="comments-heading" className="tk-card p-5 sm:p-8">
      <div className="flex items-center gap-2">
        <h2 id="comments-heading" className="tk-section-title">
          Comments
        </h2>
        {comments.length > 0 && (
          <span className="tk-badge">{comments.length}</span>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No comments yet. Start the conversation below.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3 py-4 first:pt-2">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700"
              >
                {getInitials(comment.authorName)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 text-sm">
                    <span className="font-medium text-ink">
                      {comment.authorName}
                    </span>{" "}
                    {/* Formatted in the viewer's own time zone, which can
                        differ from the server's during the first render. */}
                    <time
                      dateTime={comment.createdAt}
                      suppressHydrationWarning
                      className="text-xs text-zinc-500"
                    >
                      {new Date(comment.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>

                  {comment.isOwn && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId !== null}
                      className="-mx-2 inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === comment.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>

                <p className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap text-zinc-700">
                  {comment.body}
                </p>

                {deleteError?.commentId === comment.id && (
                  <p role="alert" className="mt-2 text-xs text-red-600">
                    {deleteError.message}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 border-t border-line pt-5"
        onSubmit={handleSubmit}
      >
        <label htmlFor="comment" className="tk-label">
          Add a comment
        </label>

        <textarea
          id="comment"
          name="body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          placeholder="Write a comment"
          aria-invalid={Boolean(formError)}
          aria-describedby={formError ? "comment-error" : undefined}
          className="tk-input tk-textarea mt-2"
        />

        {formError && (
          <p id="comment-error" role="alert" className="tk-field-error">
            {formError}
          </p>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={isPostBusy || body.trim() === ""}
            className="tk-btn tk-btn-primary w-full sm:w-auto"
          >
            {isPostBusy ? "Posting..." : "Post comment"}
          </button>
        </div>
      </form>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

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
    <section className="mt-10 border-t border-zinc-200 pt-8">
      <h2 className="tk-section-title">Comments</h2>

      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="tk-card px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium text-zinc-900">
                    {comment.authorName}
                  </span>{" "}
                  {/* Formatted in the viewer's own time zone, which can differ
                      from the server's during the first render. */}
                  <time
                    dateTime={comment.createdAt}
                    suppressHydrationWarning
                    className="text-zinc-500"
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
                    className="rounded-sm text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === comment.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">
                {comment.body}
              </p>

              {deleteError?.commentId === comment.id && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                  {deleteError.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        <label htmlFor="comment" className="sr-only">
          Comment
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
          className="tk-input tk-textarea"
        />

        {formError && (
          <p id="comment-error" role="alert" className="tk-field-error">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={isPostBusy || body.trim() === ""}
          className="tk-btn tk-btn-primary"
        >
          {isPostBusy ? "Posting..." : "Post comment"}
        </button>
      </form>
    </section>
  );
}

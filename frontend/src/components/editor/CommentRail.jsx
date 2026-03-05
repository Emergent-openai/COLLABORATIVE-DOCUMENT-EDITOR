import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function CommentRail({
  activeBlockId,
  blocks,
  className = "",
  comments,
  disabled,
  onAddComment,
  onAnnotationSave,
  onClose,
  onFocusBlock,
  session,
}) {
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const activeBlock = blocks.find((block) => block.id === activeBlockId);

  useEffect(() => {
    setNoteDraft(activeBlock?.annotation || "");
  }, [activeBlock?.annotation, activeBlockId]);

  const threads = useMemo(() => {
    const mapped = blocks
      .map((block) => ({
        block,
        comments: comments.filter((comment) => comment.block_id === block.id),
      }))
      .filter((thread) => thread.comments.length > 0 || thread.block.annotation);

    return mapped.sort((left, right) => {
      if (left.block.id === activeBlockId) {
        return -1;
      }
      if (right.block.id === activeBlockId) {
        return 1;
      }
      return 0;
    });
  }, [activeBlockId, blocks, comments]);

  const handleSubmit = async () => {
    if (!draft.trim() || !activeBlockId || disabled) {
      return;
    }

    setSubmitting(true);
    const added = await onAddComment(activeBlockId, draft);
    setSubmitting(false);

    if (added) {
      setDraft("");
    }
  };

  const handleSaveNote = async () => {
    if (!activeBlockId) {
      return;
    }

    setSavingNote(true);
    await onAnnotationSave(activeBlockId, noteDraft);
    setSavingNote(false);
  };

  return (
    <aside
      className={`flex h-full w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white ${className}`}
      data-testid="comment-rail-panel"
    >
      <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Comments</p>
        </div>
        <button
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          data-testid="comments-rail-close-button"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-slate-200 px-4 py-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Selected block</p>
          <p className="mt-2 text-sm font-semibold text-slate-900" data-testid="comment-active-block-label">
            {activeBlock ? activeBlock.section : "Select a block"}
          </p>
          <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500" data-testid="comment-active-block-preview">
            {activeBlock?.content || "Choose a block in the document to add a note or comment."}
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Block note</p>
          <textarea
            className="mt-2 min-h-[96px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#1A73E8]"
            data-testid="annotation-side-input"
            disabled={!activeBlock || disabled}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Add a side note for this block..."
            value={noteDraft}
          />
          <Button
            className="mt-3 rounded-md bg-[#1A73E8] text-white hover:bg-[#1557B0]"
            data-testid="annotation-side-save-button"
            disabled={!activeBlock || savingNote}
            onClick={handleSaveNote}
            type="button"
          >
            {savingNote ? "Saving..." : "Save note"}
          </Button>
        </div>
      </div>

      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8" data-testid="comment-author-avatar">
            <AvatarImage alt={session.name} src={session.avatar_url} />
            <AvatarFallback>{session.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-slate-900">Add a comment</p>
            <p className="text-xs text-slate-500">Reply to the selected block</p>
          </div>
        </div>

        <textarea
          className="mt-3 min-h-[88px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#1A73E8]"
          data-testid="comment-input"
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={disabled ? "Return to live mode to comment" : "Comment on the selected block..."}
          value={draft}
        />
        <Button
          className="mt-3 w-full rounded-md bg-slate-900 text-white hover:bg-slate-800"
          data-testid="comment-submit-button"
          disabled={disabled || !draft.trim() || !activeBlockId || submitting}
          onClick={handleSubmit}
          type="button"
        >
          <Send className="mr-2 h-4 w-4" />
          {submitting ? "Sending..." : "Comment"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Threaded feedback</p>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
            {comments.length} total
          </span>
        </div>

        {threads.length ? (
          <div className="space-y-3">
            {threads.map((thread) => {
              const isActive = thread.block.id === activeBlockId;

              return (
                <div
                  className={`rounded-lg border p-3 shadow-sm transition-colors ${
                    isActive
                      ? "border-[#1A73E8] bg-[#F8FBFF]"
                      : "border-slate-200 bg-white"
                  }`}
                  data-testid={`comment-thread-card-${thread.block.id}`}
                  key={thread.block.id}
                >
                  <button
                    className="w-full text-left"
                    data-testid={`comment-thread-trigger-${thread.block.id}`}
                    onClick={() => onFocusBlock(thread.block.id, thread.block.page_id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{thread.block.section}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {thread.comments.length} comment{thread.comments.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <MessageSquareText className="mt-0.5 h-4 w-4 text-slate-400" />
                    </div>
                  </button>

                  {thread.block.annotation ? (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid={`comment-thread-note-${thread.block.id}`}>
                      {thread.block.annotation}
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-3">
                    {thread.comments.map((comment) => (
                      <div
                        className="rounded-md border border-slate-200 bg-white px-3 py-2.5"
                        data-testid={`comment-item-${comment.id}`}
                        key={comment.id}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage alt={comment.author_name} src={comment.avatar_url} />
                            <AvatarFallback>{comment.author_name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{comment.author_name}</p>
                            <p className="text-[11px] text-slate-400">
                              {new Date(comment.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500" data-testid="comment-empty-state">
            No notes or comment threads yet.
          </div>
        )}
      </div>
    </aside>
  );
}
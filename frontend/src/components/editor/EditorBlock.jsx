import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { GripVertical, MessageSquarePlus, Sparkles, Trash2, X } from "lucide-react";
import { buildRemoteTypingPreview } from "@/components/editor/editorConfig";

export default function EditorBlock({
  aiSuggestion,
  block,
  collaboratorsEditing,
  dragPosition,
  fontFamily,
  fontSize,
  isActive,
  isDragTarget,
  isFocusFlashing,
  isPreviewing,
  isSelected,
  onChange,
  onDragOver,
  onDragStart,
  onDrop,
  onDismissSuggestion,
  onDelete,
  onFocus,
  onKeyDown,
  onOpenComments,
  onSelect,
  registerRef,
  remoteGhost,
  textStyles,
}) {
  const textareaRef = useRef(null);
  const remotePreview = remoteGhost
    ? buildRemoteTypingPreview(block.content, remoteGhost.content)
    : null;

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 34)}px`;
  }, [aiSuggestion, block.content, block.type, remoteGhost]);

  const editingColor = collaboratorsEditing[0]?.color || "#FF0080";
  const hasEditors = collaboratorsEditing.length > 0;
  const textFormattingClassName = [
    textStyles?.includes("bold") ? "font-semibold" : "",
    textStyles?.includes("italic") ? "italic" : "",
    textStyles?.includes("underline") ? "underline decoration-1 underline-offset-4" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const typographyStyle = {
    fontFamily: fontFamily || undefined,
    fontSize: fontSize ? `${fontSize}px` : undefined,
  };

  return (
    <motion.div
      className="editor-block-shell group mx-auto mb-2 w-full px-0.5 py-1.5"
      data-editing={hasEditors}
      data-flash={isFocusFlashing}
      data-selected={isSelected}
      data-testid={`editor-block-${block.id}`}
      layout
      onDragOver={(event) => onDragOver(event, block.id)}
      onDrop={() => onDrop(block.id)}
      ref={(node) => registerRef(block.id, node)}
      style={{ "--editing-color": editingColor }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      {isDragTarget ? (
        <div
          className="drag-guide"
          style={{ [dragPosition === "before" ? "top" : "bottom"]: "-0.2rem" }}
        />
      ) : null}

      <div className="relative flex gap-3 rounded-[0.5rem] border border-transparent px-1 py-1.5 sm:px-2 sm:py-2">
        <div className="block-side-actions hidden w-10 shrink-0 items-start justify-center gap-2 pt-1 md:flex md:flex-col">
          <button
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            data-testid={`drag-handle-${block.id}`}
            draggable={!isPreviewing}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", block.id);
              onDragStart(block.id);
            }}
            type="button"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <button
            className={`rounded-md p-1.5 transition hover:bg-slate-100 ${
              block.annotation ? "text-[#1A73E8]" : "text-slate-400 hover:text-slate-700"
            }`}
            data-testid={`annotation-toggle-${block.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onFocus(block.id);
              onOpenComments(block.id);
            }}
            type="button"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          <button
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            data-testid={`delete-block-button-${block.id}`}
            disabled={isPreviewing}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(block.id);
            }}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {hasEditors
              ? collaboratorsEditing.map((collaborator) => (
                  <span
                    className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                    data-testid={`editing-indicator-${block.id}-${collaborator.session_id}`}
                    key={collaborator.session_id}
                    style={{ backgroundColor: `${collaborator.color}20` }}
                  >
                    {collaborator.name}
                  </span>
                ))
              : null}
            {aiSuggestion && !remotePreview ? (
              <div
                className="inline-flex items-center gap-2 rounded-md border border-[#D2E3FC] bg-[#F8FBFF] px-2 py-1 text-[10px] text-slate-600"
                data-testid={`ai-suggestion-chip-${block.id}`}
              >
                <span className="inline-flex items-center gap-1 font-medium text-[#174EA6]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Suggestion
                </span>
                <span className="text-slate-500">Tab to accept</span>
                <button
                  className="rounded-sm p-0.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
                  data-testid={`dismiss-ai-suggestion-${block.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDismissSuggestion(block.id, block.content);
                  }}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>

          <div
            className={`rounded-[0.3rem] px-2 py-2 transition-colors ${
              isActive ? "bg-transparent ring-1 ring-[#D2E3FC]" : "bg-transparent"
            }`}
            onClick={(event) => onSelect(block.id, event)}
          >
            {block.type === "divider" ? (
              <div className="space-y-3 py-5" data-testid={`divider-block-${block.id}`}>
                <div className="h-px w-full bg-slate-300" />
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Turn the page
                </p>
              </div>
            ) : (
              <div className="editor-text-shell">
                <pre
                  aria-hidden="true"
                  className={`editor-text-mirror ${textFormattingClassName}`}
                  data-type={block.type}
                  style={typographyStyle}
                >
                  {remotePreview ? (
                    <>
                      {remotePreview.prefix || ""}
                      <span className="remote-inline-anchor" data-testid={`remote-inline-anchor-${block.id}`}>
                        <span
                          className="remote-inline-label"
                          data-testid={`remote-inline-label-${block.id}`}
                          style={{ backgroundColor: remoteGhost.color }}
                        >
                          {remoteGhost.name}
                        </span>
                        <span
                          className="remote-inline-caret"
                          data-testid={`remote-inline-caret-${block.id}`}
                          style={{ backgroundColor: remoteGhost.color }}
                        />
                        <span className="remote-inline-text">
                          {remotePreview.inserted || "\u200b"}
                        </span>
                      </span>
                      {remotePreview.suffix || ""}
                    </>
                  ) : (
                    <>
                      {block.content || " "}
                      {aiSuggestion ? <span className="ghost-inline">{aiSuggestion}</span> : null}
                    </>
                  )}
                </pre>
                <textarea
                  className={`editor-textarea ${textFormattingClassName}`}
                  data-testid={`editor-textarea-${block.id}`}
                  data-type={block.type}
                  disabled={isPreviewing}
                  onChange={(event) => onChange(block.id, event.target.value)}
                  onFocus={() => onFocus(block.id)}
                  onKeyDown={(event) => onKeyDown(event, block)}
                  placeholder={block.placeholder}
                  ref={textareaRef}
                  spellCheck={false}
                  style={typographyStyle}
                  value={block.content}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
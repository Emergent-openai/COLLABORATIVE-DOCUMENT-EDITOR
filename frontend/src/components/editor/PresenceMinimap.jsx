import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function PresenceMinimap({
  blocks,
  className = "",
  currentPageId,
  onClose,
  onFocusBlock,
  onSelectPage,
  pages,
  participants,
}) {
  return (
    <aside
      className={`glass-panel flex h-full w-full flex-col rounded-[1rem] p-4 ${className}`}
      data-testid="presence-minimap-panel"
    >
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Overview</p>
          <h2 className="mt-2 text-base font-semibold text-slate-900">Page map & collaborator locations</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-500" data-testid="minimap-participant-count">
            {participants.length} live
          </span>
          {onClose ? (
            <button
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              data-testid="minimap-close-button"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1 no-scrollbar">
        {pages.map((page) => {
          const pageBlocks = blocks.filter((block) => block.page_id === page.id);
          const pageParticipants = participants.filter(
            (participant) => participant.active_page === page.id,
          );

          return (
            <div
              className={`minimap-page-card relative w-full rounded-[0.95rem] p-4 text-left transition-transform hover:-translate-y-0.5 ${
                currentPageId === page.id ? "ring-2 ring-slate-900/10" : ""
              }`}
              data-testid={`minimap-page-card-${page.id}`}
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPage(page.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{page.title}</p>
                  <p className="text-xs text-slate-500">{page.subtitle}</p>
                </div>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: page.accent }}
                />
              </div>

              <div className="relative rounded-[0.85rem] bg-slate-50/90 p-3">
                <div className="space-y-2">
                  {pageBlocks.map((block, index) => (
                    <div
                      className={`rounded-full ${block.type === "heading" ? "h-3" : "h-2.5"} ${
                        block.type === "divider" ? "bg-slate-300" : "bg-slate-200"
                      } ${index % 2 === 0 ? "w-[92%]" : "w-[76%]"}`}
                      data-testid={`minimap-block-${block.id}`}
                      key={block.id}
                    />
                  ))}
                </div>

                {pageParticipants.map((participant) => (
                  <motion.button
                    animate={{ top: `${Math.max(4, (participant.position_ratio || 0) * 100)}%` }}
                      className="absolute right-2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-md border-2 border-white shadow-lg"
                    data-testid={`minimap-participant-dot-${participant.session_id}`}
                    key={participant.session_id}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (participant.active_block_id) {
                        onFocusBlock(participant.active_block_id, participant.active_page);
                      } else {
                        onSelectPage(participant.active_page);
                      }
                    }}
                    style={{ backgroundColor: participant.color }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
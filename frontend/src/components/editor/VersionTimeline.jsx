import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VersionTimeline({
  onClose,
  onPreviewChange,
  onRestore,
  onReturnLive,
  previewIndex,
  versions,
}) {
  const maxIndex = Math.max(versions.length - 1, 0);
  const currentIndex = previewIndex === null ? maxIndex : previewIndex;
  const activeVersion = versions[currentIndex];

  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className="timeline-shell flex h-full w-full flex-col rounded-[1rem] px-4 pb-4 pt-10 text-slate-900"
      data-testid="version-history-timeline"
      initial={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">History</p>
          {onClose ? (
            <button
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              data-testid="version-history-close-button"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900" data-testid="active-version-label">
            {activeVersion?.label || "Live draft"}
          </p>
          <p className="text-sm text-slate-600">Browse earlier states without crowding the editor.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {previewIndex !== null ? (
            <Button
              className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              data-testid="timeline-return-live-button"
              onClick={onReturnLive}
              type="button"
              variant="secondary"
            >
              Return live
            </Button>
          ) : null}
          <Button
            className="rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            data-testid="timeline-restore-button"
            disabled={previewIndex === null || !activeVersion}
            onClick={() => activeVersion && onRestore(activeVersion.id)}
            type="button"
          >
            Restore
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <input
          className="timeline-slider"
          data-testid="version-history-slider"
          max={maxIndex}
          min={0}
          onChange={(event) => onPreviewChange(Number(event.target.value))}
          type="range"
          value={currentIndex}
        />
        <div className="flex items-center justify-between gap-2">
          {versions.map((version, index) => (
            <button
              className={`h-3 w-3 rounded-full transition-transform ${
                index === currentIndex
                  ? "scale-125 bg-slate-900 shadow-sm"
                  : "bg-slate-300 hover:bg-slate-400"
              }`}
              data-testid={`version-dot-${version.id}`}
              key={version.id}
              onClick={() => onPreviewChange(index)}
              title={version.label}
              type="button"
            />
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 no-scrollbar">
        {versions.map((version, index) => {
          const isSelected = index === currentIndex;

          return (
            <button
              className={`w-full rounded-[0.8rem] border px-3 py-3 text-left transition-colors ${
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              data-testid={`version-item-${version.id}`}
              key={version.id}
              onClick={() => onPreviewChange(index)}
              type="button"
            >
              <p className="text-sm font-semibold">{version.label}</p>
              <p className={`mt-1 text-xs ${isSelected ? "text-white/80" : "text-slate-600"}`}>
                {version.reason}
              </p>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
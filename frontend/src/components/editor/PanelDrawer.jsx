import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function PanelDrawer({ children, onClose, open, panelKey, position = "right" }) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            animate={{ opacity: 1 }}
            className="editor-panel-backdrop"
            data-testid={`${panelKey}-panel-backdrop`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className={`editor-side-panel ${position === "left" ? "editor-side-panel--left" : "editor-side-panel--right"}`}
            data-testid={`${panelKey}-panel-drawer`}
            exit={{ opacity: 0, x: position === "left" ? -28 : 28 }}
            initial={{ opacity: 0, x: position === "left" ? -28 : 28 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative h-full">
              <button
                className="absolute right-3 top-3 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
                data-testid={`${panelKey}-panel-close-button`}
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
              {children}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
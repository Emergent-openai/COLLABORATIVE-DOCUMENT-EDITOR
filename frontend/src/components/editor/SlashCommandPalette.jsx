import { AnimatePresence, motion } from "framer-motion";

export default function SlashCommandPalette({
  commands,
  open,
  query,
  selectedIndex,
  onSelect,
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="slash-panel glass-panel fixed bottom-36 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-[1.65rem] p-3"
          data-testid="slash-command-palette"
          exit={{ opacity: 0, y: 18, scale: 0.96 }}
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">
                Slash command
              </p>
              <p className="text-sm font-medium text-slate-700" data-testid="slash-command-query">
                {query ? `Filtering “${query}”` : "Choose a block style or AI spark"}
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[11px] text-slate-500">
              ↑ ↓ ↵
            </div>
          </div>

          <div className="space-y-2">
            {commands.map((command, index) => {
              const Icon = command.icon;
              const active = index === selectedIndex;
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                    active
                      ? "bg-slate-900 text-white shadow-2xl"
                      : "bg-white/70 text-slate-700 hover:bg-white"
                  }`}
                  data-testid={`slash-command-option-${command.id}`}
                  key={command.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(command);
                  }}
                  type="button"
                >
                  <div
                    className={`rounded-2xl p-3 ${
                      active ? "bg-white/14" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{command.label}</p>
                    <p className={`text-sm ${active ? "text-white/72" : "text-slate-500"}`}>
                      {command.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
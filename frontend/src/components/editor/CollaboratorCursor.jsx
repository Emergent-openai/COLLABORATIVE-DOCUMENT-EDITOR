import { motion } from "framer-motion";

export default function CollaboratorCursor({ participant }) {
  if (!participant?.cursor || participant.is_typing) {
    return null;
  }

  const shortName = participant.name.split(" ")[0];

  return (
    <motion.div
      animate={{ x: participant.cursor.x, y: participant.cursor.y }}
      className="pointer-events-none absolute z-40"
      data-testid={`collaborator-cursor-${participant.session_id}`}
      transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.5 }}
    >
      <div className="relative">
        <svg
          className="drop-shadow-sm"
          fill="none"
          height="22"
          viewBox="0 0 18 18"
          width="22"
        >
          <path
            d="M2.2 1.4 14.4 9.6l-5 0.6 2 5.2-1.9 0.7-2-5.2-3.8 3.7V1.4Z"
            fill={participant.color}
            stroke="white"
            strokeLinejoin="round"
            strokeWidth="1.1"
          />
        </svg>

        <div
          className="absolute left-4 top-[-0.85rem] z-[70] flex max-w-[9rem] items-center gap-1.5 rounded-md px-2 py-1 text-white shadow-md"
          data-testid={`collaborator-cursor-label-${participant.session_id}`}
          style={{ backgroundColor: participant.color }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" />
          <p className="truncate text-[11px] font-semibold leading-none text-white">{shortName}</p>
        </div>
      </div>
    </motion.div>
  );
}
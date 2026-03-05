import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const particles = Array.from({ length: 22 }, (_, index) => ({
  id: index,
  color: ["#FF0080", "#FFB020", "#00CC99", "#7928CA", "#0070F3"][index % 5],
  left: 8 + (index % 11) * 8,
  rotate: index * 24,
  distance: 140 + (index % 7) * 22,
}));

export default function ConfettiBurst({ active, onComplete }) {
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onComplete();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active ? (
        <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" data-testid="publish-confetti-burst">
          {particles.map((particle) => (
            <motion.span
              animate={{
                opacity: [0, 1, 1, 0],
                x: [0, particle.distance * (particle.id % 2 === 0 ? 1 : -1)],
                y: [-60, 240 + particle.id * 10],
                rotate: [particle.rotate, particle.rotate + 180],
                scale: [0.8, 1, 0.92],
              }}
              className="absolute top-10 h-4 w-2 rounded-full"
              initial={{ opacity: 0, x: 0, y: -40 }}
              key={particle.id}
              style={{ backgroundColor: particle.color, left: `${particle.left}%` }}
              transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>
      ) : null}
    </AnimatePresence>
  );
}
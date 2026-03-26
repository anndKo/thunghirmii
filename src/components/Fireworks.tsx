import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  speed: number;
  size: number;
}

const COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"];

const Fireworks = ({ active }: { active: boolean }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    const newParticles: Particle[] = [];
    // Create 3 bursts
    for (let burst = 0; burst < 3; burst++) {
      const cx = 20 + Math.random() * 60; // % x
      const cy = 15 + Math.random() * 30; // % y
      for (let i = 0; i < 20; i++) {
        newParticles.push({
          id: burst * 20 + i,
          x: cx,
          y: cy,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          angle: (Math.PI * 2 * i) / 20 + Math.random() * 0.3,
          speed: 2 + Math.random() * 4,
          size: 3 + Math.random() * 4,
        });
      }
    }
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 2000);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-firework-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            "--fw-tx": `${Math.cos(p.angle) * p.speed * 20}px`,
            "--fw-ty": `${Math.sin(p.angle) * p.speed * 20}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default Fireworks;

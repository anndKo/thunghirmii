// @ts-nocheck
import { useEffect, useState, useRef } from 'react';

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF4757', '#2ED573', '#1E90FF'];
const MILESTONES = [3, 7, 30, 60, 90, 180, 365, 730];
const MILESTONE_LABELS: Record<number, string> = {
  3: '🔥 3 ngày liên tiếp!',
  7: '⚡ 7 ngày liên tiếp!',
  30: '🌟 30 ngày liên tiếp!',
  60: '💎 60 ngày liên tiếp!',
  90: '👑 90 ngày liên tiếp!',
  180: '🚀 180 ngày liên tiếp!',
  365: '🏆 1 năm liên tiếp!',
  730: '🌈 2 năm liên tiếp!',
};

interface Props {
  streak: number;
  userId: string;
}

export function MilestoneCelebration({ streak, userId }: Props) {
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!streak || !userId) return;
    const milestone = MILESTONES.find(m => streak === m);
    if (!milestone) return;

    const key = `milestone_${userId}_${milestone}`;
    if (localStorage.getItem(key)) return;

    localStorage.setItem(key, '1');
    setLabel(MILESTONE_LABELS[milestone] || `🎉 ${milestone} ngày!`);
    setActive(true);

    const timer = setTimeout(() => setActive(false), 4000);
    return () => clearTimeout(timer);
  }, [streak, userId]);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Confetti {
      x: number; y: number; w: number; h: number;
      color: string; rot: number; rotSpeed: number;
      vx: number; vy: number; gravity: number; opacity: number;
    }

    const confetti: Confetti[] = [];
    for (let i = 0; i < 150; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: 6 + Math.random() * 8,
        h: 4 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        gravity: 0.05 + Math.random() * 0.05,
        opacity: 1,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      confetti.forEach(c => {
        if (c.opacity <= 0) return;
        alive = true;
        c.x += c.vx;
        c.vy += c.gravity;
        c.y += c.vy;
        c.rot += c.rotSpeed;
        if (c.y > canvas.height + 20) c.opacity = 0;
        if (c.y > canvas.height * 0.7) c.opacity -= 0.02;

        ctx.save();
        ctx.globalAlpha = Math.max(0, c.opacity);
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      });
      if (alive) animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-background/90 backdrop-blur-sm border border-border rounded-2xl px-8 py-6 shadow-2xl animate-scale-in text-center">
          <p className="text-4xl mb-2">{label.split(' ')[0]}</p>
          <p className="text-lg font-bold text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground mt-1">Chúc mừng bạn đã đạt mốc mới!</p>
        </div>
      </div>
    </div>
  );
}

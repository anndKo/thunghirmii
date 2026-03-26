// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

const POPUP_CLOSE_KEY = 'minigame_popup_close_count';
const MAX_CLOSES = 2;

export function MiniGamePopup() {
  const { user } = useAuth();
  const [game, setGame] = useState(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Check close count
    const closeCount = parseInt(localStorage.getItem(POPUP_CLOSE_KEY) || '0', 10);
    if (closeCount >= MAX_CLOSES) return;

    const fetchActive = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('mini_games')
        .select('*')
        .lte('start_time', now)
        .gte('end_time', now)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const g = data[0];
        // Check visibility
        if (g.visibility === 'authenticated' && !user) return;
        
        setGame(g);
        // Position: right side, center vertically
        setPosition({ x: 8, y: window.innerHeight / 2 - 28 });
        setTimeout(() => setVisible(true), 300);
        setTimeout(() => setAnimated(true), 600);
      }
    };
    fetchActive();
  }, [user]);

  const handleClose = () => {
    setVisible(false);
    // Increment close count
    const count = parseInt(localStorage.getItem(POPUP_CLOSE_KEY) || '0', 10);
    localStorage.setItem(POPUP_CLOSE_KEY, String(count + 1));
    setTimeout(() => setGame(null), 300);
  };

  // Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    setDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  };

  const handleTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    const touch = e.touches[0];
    setDragging(true);
    dragOffset.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (cx, cy) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 60, cx - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, cy - dragOffset.current.y)),
      });
    };
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e) => { handleMove(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); };
    const onEnd = () => setDragging(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragging]);

  if (!game) return null;

  return (
    <div
      className={`fixed z-[9999] cursor-grab active:cursor-grabbing transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
      style={{ left: position.x, top: position.y, touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className={`relative group ${animated ? 'animate-bounce-gentle' : ''}`}>
        <a
          href={game.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-xl border-2 border-primary/30 hover:border-primary hover:shadow-2xl transition-all duration-300 hover:scale-110"
          onClick={(e) => { if (dragging) e.preventDefault(); }}
        >
          <img src={game.logo_url} alt={game.title} className="w-full h-full object-cover" />
        </a>
        <button
          onClick={handleClose}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform opacity-50 hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

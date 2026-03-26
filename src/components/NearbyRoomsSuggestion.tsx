// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2, X } from 'lucide-react';

interface Props {
  roomId: string;
  roomLat: number | null;
  roomLng: number | null;
  onClose?: () => void;
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function NearbyRoomsSuggestion({ roomId, roomLat, roomLng, onClose }: Props) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [nearbyRooms, setNearbyRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          setShowSuggestion(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showSuggestion) return;
    const fetchNearby = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('rooms')
        .select('id, title, images, latitude, longitude, price')
        .eq('is_available', true)
        .neq('id', roomId);

      if (!data || !roomLat || !roomLng) {
        setNearbyRooms((data || []).slice(0, 3));
      } else {
        const withDist = data
          .filter(r => r.latitude && r.longitude)
          .map(r => ({ ...r, dist: getDistance(roomLat, roomLng, r.latitude, r.longitude) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);
        setNearbyRooms(withDist.length > 0 ? withDist : (data || []).slice(0, 3));
      }
      setLoading(false);
    };
    fetchNearby();
  }, [showSuggestion, roomId, roomLat, roomLng]);

  if (!showSuggestion) {
    return (
      <div className="rounded-2xl bg-card border border-border shadow-xl p-5 text-center">
        <p className="text-sm text-muted-foreground">⏳ Trong lúc chờ phản hồi, bạn có thể xem các phòng gần đây...</p>
        <p className="text-lg font-bold text-primary mt-2">{countdown}s</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border shadow-2xl p-5 relative">
      {onClose && (
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Phòng trọ gần đây bạn có thể quan tâm</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : nearbyRooms.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy phòng gần đây.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {nearbyRooms.map(room => (
            <button
              key={room.id}
              onClick={() => { onClose?.(); navigate(`/rooms/${room.id}`); }}
              className="group cursor-pointer text-left"
            >
              <div className="aspect-square rounded-xl overflow-hidden border border-border shadow-sm">
                <img
                  src={room.images?.[0] || '/placeholder.svg'}
                  alt={room.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-tight">{room.title}</p>
              {room.price && <p className="text-xs font-semibold text-primary mt-0.5">{(room.price / 1000000).toFixed(1)}tr</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

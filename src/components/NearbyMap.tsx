// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin, Navigation, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAccuratePosition } from '@/lib/gps-accuracy';
import { LocationPermissionDialog } from '@/components/LocationPermissionDialog';

interface Room {
  id: string;
  title: string;
  price: number;
  address_detail: string;
  latitude: number;
  longitude: number;
  is_available: boolean;
  distance?: number;
}

interface NearbyMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NearbyMap({ open, onOpenChange }: NearbyMapProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyRooms, setNearbyRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const roomRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [zoomLevel, setZoomLevel] = useState(300);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (open) {
      requestLocation();
    }
  }, [open]);
  useEffect(() => {
    const preventPageZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
  
    

  document.addEventListener("wheel", preventPageZoom, { passive: false });

  return () => {
    document.removeEventListener("wheel", preventPageZoom);
  };
}, []);

  const requestLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const pos = await getAccuratePosition();
      setUserLocation(pos);
      await fetchNearbyRooms(pos.lat, pos.lng);
    } catch (err: any) {
      const msg = err.message || 'Không thể lấy vị trí.';
      setError(msg);
      // Only show permission dialog when user denied location access
      if (msg.includes('cho phép') || msg.includes('cài đặt')) {
        setShowPermissionDialog(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyRooms = async (lat: number, lng: number) => {
    const { data } = await supabase
      .from('rooms')
      .select('id, title, price, address_detail, latitude, longitude, is_available')
      .eq('is_available', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (data) {
      const roomsWithDistance = data
        .map((room: any) => ({
          ...room,
          distance: calculateDistance(lat, lng, room.latitude, room.longitude),
        }))
        .sort((a: Room, b: Room) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 20);

      setNearbyRooms(roomsWithDistance);
      // Dispatch reward event for find_nearby
      window.dispatchEvent(new CustomEvent('reward-action', { detail: { actionType: 'find_nearby' } }));
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (deg: number): number => deg * (Math.PI / 180);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const formatDistance = (distance: number) => {
    if (distance < 1) return `${Math.round(distance * 1000)}m`;
    if (distance < 10) return `${distance.toFixed(2)}km`;
    return `${distance.toFixed(1)}km`;
  };

  const getPositionStyle = (room: Room) => {
    if (!userLocation) return {};
    const latDiff = room.latitude - userLocation.lat;
    const lngDiff = room.longitude - userLocation.lng;
    const scale = zoomLevel;
    const x = 50 + lngDiff * scale + offset.x;
    const y = 50 - latDiff * scale + offset.y;
    return {
      left: `${Math.max(5, Math.min(95, x))}%`,
      top: `${Math.max(5, Math.min(95, y))}%`,
    };
  };
  const lastDistance = useRef<number | null>(null);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
  
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
  
    const distance = Math.sqrt(dx * dx + dy * dy);
  
    if (lastDistance.current) {
      const diff = distance - lastDistance.current;
    
      setZoomLevel((prev) => {
        const next = prev + diff * 2;
        return Math.max(150, Math.min(1200, next));
      });
    }
    
    lastDistance.current = distance;
  };
  const handleTouchStartDrag = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
  
    dragStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  const handleTouchMoveDrag = (e: React.TouchEvent) => {
    if (!dragStart.current || e.touches.length !== 1) return;
  
    const dx = (e.touches[0].clientX - dragStart.current.x) / 5;
    const dy = (e.touches[0].clientY - dragStart.current.y) / 5;
  
    setOffset((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  
    dragStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  const handleMouseDown = (e: React.MouseEvent) => {
      dragStart.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragStart.current) return;
    
      const dx = (e.clientX - dragStart.current.x) / 8;
      const dy = (e.clientY - dragStart.current.y) / 8;
    
      setOffset((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
    
      dragStart.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseUp = () => {
      dragStart.current = null;
    };
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-hide flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Navigation className="h-5 w-5 text-primary" />
            Tìm kiếm gần đây
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Đang xác định vị trí...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-destructive text-sm">{error}</p>
              <div className="flex flex-col items-center gap-2">
                <Button onClick={() => setShowPermissionDialog(true)} variant="outline" size="sm">
                  Hướng dẫn bật vị trí
                </Button>
                <Button onClick={requestLocation} size="sm">Thử lại</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-3 h-full min-h-0">
              {/* Map visualization */}
              <div
                className="relative h-[200px] sm:h-[300px] lg:h-[400px] rounded-lg overflow-hidden border-2 border-primary/20 flex-shrink-0 cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
              
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}

                onWheel={(e) => {
                  if (!e.ctrlKey) return; // chỉ zoom khi giữ Ctrl
                
                  e.preventDefault();
                  e.stopPropagation();
                
                  setZoomLevel((prev) => {
                    const next = prev - e.deltaY * 0.5;
                    return Math.max(150, Math.min(1200, next));
                  });
                }}
              
                onTouchStart={handleTouchStartDrag}
                onTouchMove={(e) => {
                  if (e.touches.length === 2) {
                    handleTouchMove(e); // pinch zoom
                  } else if (e.touches.length === 1) {
                    handleTouchMoveDrag(e); // drag map
                  }
                }}
                
                onTouchEnd={() => {
                  dragStart.current = null;
                  lastDistance.current = null;
                }}
              >
                <div 
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
                      linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                  }}
                />
                
                <div 
                  className="absolute rounded-full border border-primary/20"
                  style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '60%' }}
                />
                <div 
                  className="absolute rounded-full border border-primary/10"
                  style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '85%', height: '85%' }}
                />

                <div 
                  className="absolute z-20 flex items-center justify-center"
                  style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                >
                  <div className="relative">
                    <div className="absolute -inset-2 bg-primary/30 rounded-full animate-ping" />
                    <div className="relative bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
                      <Navigation className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {nearbyRooms.map((room) => (
                  <button
                    key={room.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110 ${
                      selectedRoom?.id === room.id ? 'scale-125 z-30' : 'z-10'
                    }`}
                    style={getPositionStyle(room)}
                    onClick={() => {
                      setSelectedRoom(room);
                    
                      const el = roomRefs.current[room.id];
                      if (el) {
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center"
                        });
                      }
                    }}
                  >
                    <div className={`p-1.5 sm:p-2 rounded-full shadow-lg border-2 ${
                      selectedRoom?.id === room.id 
                        ? 'bg-accent text-accent-foreground border-accent' 
                        : 'bg-card text-primary border-primary/50 hover:border-primary'
                    }`}>
                      <Home className="h-3 w-3 sm:h-4 sm:w-4" />
                    </div>
                  </button>
                ))}

                {nearbyRooms.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Không có phòng trọ gần đây có tọa độ</p>
                  </div>
                )}
              </div>

              {/* Room list */}
              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 flex-shrink-0">
                  {nearbyRooms.length} phòng trọ gần bạn
                </p>
                <div className="h-[300px] sm:h-[380px] lg:h-[360px] overflow-y-auto scrollbar-thin">
                  <div className="space-y-3 pr-6">
                    {nearbyRooms.map((room) => (
                      <div
                        key={room.id}
                        ref={(el) => (roomRefs.current[room.id] = el)}
                        className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedRoom?.id === room.id 
                            ? 'border-primary bg-primary/5 shadow-sm' 
                            : 'hover:bg-muted/50 border-border'
                        }`}
                        onClick={() => setSelectedRoom(room)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm truncate">{room.title}</h4>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {room.address_detail}
                            </p>
                            <p className="text-xs sm:text-sm font-semibold text-primary mt-1">
                              {formatPrice(room.price)}/tháng
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary">
                              <MapPin className="h-3 w-3" />
                              <span className="text-xs font-semibold whitespace-nowrap">
                                {formatDistance(room.distance || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button asChild size="sm" className="w-full mt-2 h-8 text-xs">
                          <Link to={`/rooms/${room.id}`}>Xem chi tiết</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <LocationPermissionDialog
      open={showPermissionDialog}
      onOpenChange={setShowPermissionDialog}
      onAccept={requestLocation}
    />
    </>
  );
}

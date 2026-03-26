// @ts-nocheck
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Home, Search, Send, Loader2, MapPin, DollarSign, Ruler } from 'lucide-react';

interface RoomInfoSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (content: string, roomId: string) => void;
}

export function RoomInfoSendDialog({ open, onOpenChange, onSend }: RoomInfoSendDialogProps) {
  const { toast } = useToast();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<any>(null);

  const handleSearch = async () => {
    if (!roomCode.trim()) return;
    setLoading(true);
    setRoom(null);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode.trim())
      .single();
    
    if (data && !error) {
      setRoom(data);
    } else {
      toast({ title: 'Không tìm thấy phòng', description: `Mã trọ "${roomCode}" không tồn tại.`, variant: 'destructive' });
    }
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1).replace('.0', '')} triệu/tháng`;
    if (price >= 1000) return `${(price / 1000).toFixed(0)}k/tháng`;
    return `${price}đ/tháng`;
  };

  const handleSend = () => {
    if (!room) return;
    const address = [room.address_detail, room.ward, room.district, room.province].filter(Boolean).join(', ');
    const content = [
      `🏠 THÔNG TIN PHÒNG TRỌ`,
      `📋 ${room.title}`,
      `📍 ${address}`,
      `💰 Giá: ${formatPrice(room.price)}`,
      room.area ? `📐 Diện tích: ${room.area}m²` : '',
      room.deposit_amount ? `🔒 Đặt cọc: ${formatPrice(room.deposit_amount)}` : '',
      room.description ? `📝 ${room.description.slice(0, 100)}${room.description.length > 100 ? '...' : ''}` : '',
      `\n🔑 Mã phòng: ${room.room_code}`,
    ].filter(Boolean).join('\n');

    onSend(content, room.id);
    onOpenChange(false);
    setRoom(null);
    setRoomCode('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRoom(null); setRoomCode(''); } }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Gửi thông tin phòng trọ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nhập mã phòng trọ..."
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <Button onClick={handleSearch} disabled={loading || !roomCode.trim()} size="icon" className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {room && (
            <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
              {room.images?.[0] && (
                <img src={room.images[0]} alt={room.title} className="w-full h-32 object-cover rounded-lg" />
              )}
              <h3 className="font-semibold text-sm">{room.title}</h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{[room.address_detail, room.ward, room.district, room.province].filter(Boolean).join(', ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{formatPrice(room.price)}</span>
                </div>
                {room.area && (
                  <div className="flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{room.area}m²</span>
                  </div>
                )}
              </div>
              <Button onClick={handleSend} className="w-full gap-2 bg-gradient-primary">
                <Send className="h-4 w-4" />
                Gửi thông tin phòng
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

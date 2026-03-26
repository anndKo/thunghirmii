// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, ArrowUp, Star, Pencil, Check, X, Trash2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoomWithPriority {
  id: string;
  title: string;
  room_number: string;
  room_code: string;
  price: number;
  district: string;
  province: string;
  priority: number;
  approval_status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export default function AdminRoomPriorityDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RoomWithPriority[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RoomWithPriority | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('id, title, room_number, room_code, price, district, province, priority, approval_status')
      .eq('approval_status', 'approved')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) setRooms(data as RoomWithPriority[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchRooms();
  }, [open, fetchRooms]);

  const filtered = rooms.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.room_code?.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.room_number.toLowerCase().includes(q);
  });

  const topRooms = rooms.filter(r => r.priority > 0).sort((a, b) => b.priority - a.priority);

  const handleSavePriority = async (roomId: string) => {
    const val = parseInt(editValue);
    if (isNaN(val) || val < 0) {
      toast({ title: 'Lỗi', description: 'Số ưu tiên phải >= 0', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('rooms').update({ priority: val }).eq('id', roomId);
    setSaving(false);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật', variant: 'destructive' });
    } else {
      toast({ title: 'Đã cập nhật!', description: `Ưu tiên đã đặt = ${val}` });
      setEditingId(null);
      fetchRooms();
    }
  };

  const handleRemoveTop = async () => {
    if (!removeTarget) return;
    setSaving(true);
    const { error } = await supabase.from('rooms').update({ priority: 0 }).eq('id', removeTarget.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể xoá top', variant: 'destructive' });
    } else {
      toast({ title: 'Đã xoá khỏi top!', description: `${removeTarget.title} đã trở về bình thường` });
      fetchRooms();
    }
    setRemoveTarget(null);
  };

  const startEdit = (room: RoomWithPriority) => {
    setEditingId(room.id);
    setEditValue(String(room.priority));
  };

  const RoomRow = ({ room, showRemove }: { room: RoomWithPriority; showRemove?: boolean }) => (
    <div className={cn(
      "border rounded-lg p-3 flex items-center gap-3 transition-colors",
      room.priority > 0 ? "border-primary/40 bg-primary/5" : "bg-card"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{room.title}</p>
          {room.priority > 0 && (
            <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 shrink-0">
              <Star className="h-3 w-3" />Top {room.priority}
            </Badge>
          )}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
          <span>Phòng: {room.room_number}</span>
          <Badge variant="outline" className="font-mono text-[10px] h-4">{room.room_code}</Badge>
          <span>{formatCurrency(room.price)}</span>
        </div>
      </div>

      {editingId === room.id ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            type="number" min={0} value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="w-20 h-8 text-center text-sm" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSavePriority(room.id); if (e.key === 'Escape') setEditingId(null); }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSavePriority(room.id)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => startEdit(room)}>
            <Pencil className="h-3 w-3" />
            {room.priority > 0 ? 'Sửa' : 'Đặt top'}
          </Button>
          {showRemove && (
            <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setRemoveTarget(room)}>
              <Trash2 className="h-3 w-3" />Xoá top
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-primary" />
              Đưa trọ lên top
            </DialogTitle>
            <DialogDescription>
              Đặt số ưu tiên cho phòng trọ. Số càng lớn thì phòng hiển thị càng lên đầu. Số 0 = bình thường.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="manage" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manage" className="gap-1.5">
                <Crown className="h-4 w-4" />
                Quản lí top ({topRooms.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5">
                <Search className="h-4 w-4" />
                Tất cả phòng
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manage" className="flex-1 min-h-0 mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : topRooms.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Chưa có phòng nào lên top</p>
                  <p className="text-xs mt-1">Chuyển sang tab "Tất cả phòng" để đặt top</p>
                </div>
              ) : (
                <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
                  <div className="space-y-2 pr-2">
                    {topRooms.map(room => <RoomRow key={room.id} room={room} showRemove />)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="all" className="flex-1 min-h-0 mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Tìm theo mã phòng, tên, số phòng..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <ScrollArea className="flex-1 min-h-0 max-h-[45vh]">
                  <div className="space-y-2 pr-2">
                    {filtered.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">Không tìm thấy phòng nào</div>
                    ) : filtered.map(room => <RoomRow key={room.id} room={room} showRemove={room.priority > 0} />)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={v => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá khỏi top?</AlertDialogTitle>
            <AlertDialogDescription>
              Phòng <strong>{removeTarget?.title}</strong> (Top {removeTarget?.priority}) sẽ trở về hiển thị bình thường.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveTop} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Xoá top
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

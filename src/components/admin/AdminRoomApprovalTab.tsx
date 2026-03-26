// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Building2, CheckCircle, XCircle, Eye, MapPin, Phone, User, Ruler,
  Wifi, Zap, Droplets, ImageIcon, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingRoom {
  id: string;
  title: string;
  room_number: string;
  room_code: string;
  price: number;
  area: number | null;
  province: string;
  district: string;
  ward: string;
  address_detail: string;
  description: string | null;
  phone: string;
  amenities: string[] | null;
  images: string[] | null;
  videos: string[] | null;
  electricity_cost: number | null;
  water_cost: number | null;
  water_cost_type: string | null;
  custom_services: any;
  deposit_amount: number | null;
  contract_content: string | null;
  created_at: string;
  landlord_id: string;
  approval_status: string;
}

interface LandlordInfo {
  full_name: string;
  display_id: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export default function AdminRoomApprovalTab() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<PendingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [landlordMap, setLandlordMap] = useState<Record<string, LandlordInfo>>({});
  const [detailRoom, setDetailRoom] = useState<PendingRoom | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ room: PendingRoom; action: 'approve' | 'reject' } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchPendingRooms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRooms(data as PendingRoom[]);
      const landlordIds = [...new Set(data.map(r => r.landlord_id))];
      if (landlordIds.length > 0) {
        const [profiles, settings] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', landlordIds),
          supabase.from('user_settings').select('user_id, display_id').in('user_id', landlordIds),
        ]);
        const map: Record<string, LandlordInfo> = {};
        landlordIds.forEach(id => {
          const p = (profiles.data || []).find(x => x.user_id === id);
          const s = (settings.data || []).find(x => x.user_id === id);
          map[id] = { full_name: p?.full_name || 'N/A', display_id: s?.display_id || 'N/A' };
        });
        setLandlordMap(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPendingRooms(); }, [fetchPendingRooms]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    const { room, action } = confirmAction;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('rooms')
      .update({ approval_status: newStatus })
      .eq('id', room.id);

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật trạng thái', variant: 'destructive' });
    } else {
      toast({
        title: action === 'approve' ? 'Đã duyệt phòng!' : 'Đã từ chối phòng',
        description: room.title,
      });
      // Send notification to landlord
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user?.id) {
        await supabase.from('notifications').insert({
          title: action === 'approve' ? 'Phòng đã được duyệt' : 'Phòng bị từ chối',
          content: action === 'approve'
            ? `Phòng "${room.title}" đã được Admin duyệt và hiển thị cho người thuê.`
            : `Phòng "${room.title}" đã bị từ chối. Vui lòng kiểm tra và đăng lại.`,
          target_role: 'landlord',
          created_by: session.session.user.id,
        });
      }
      setConfirmAction(null);
      setDetailRoom(null);
      fetchPendingRooms();
    }
    setProcessing(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Duyệt phòng trọ
            {rooms.length > 0 && (
              <Badge variant="destructive" className="ml-2">{rooms.length} chờ duyệt</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50 text-green-500" />
              <p>Không có phòng nào chờ duyệt</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3">
                {rooms.map(room => {
                  const landlord = landlordMap[room.landlord_id];
                  return (
                    <div key={room.id} className="border rounded-xl p-4 space-y-3 bg-card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{room.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span>{landlord?.full_name}</span>
                            <Badge variant="outline" className="font-mono text-xs">{landlord?.display_id}</Badge>
                          </div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 shrink-0">
                          Chờ duyệt
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{room.district}, {room.province}</span>
                        {room.area && <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{room.area}m²</span>}
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{room.phone}</span>
                      </div>

                      <p className="text-lg font-bold text-primary">{formatCurrency(room.price)}/tháng</p>

                      {room.images && room.images.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {room.images.slice(0, 4).map((img, i) => (
                            <img key={i} src={img} alt="" className="h-16 w-16 rounded-lg object-cover border shrink-0" />
                          ))}
                          {room.images.length > 4 && (
                            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">
                              +{room.images.length - 4}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => setDetailRoom(room)} className="gap-1">
                          <Eye className="h-4 w-4" />Xem chi tiết
                        </Button>
                        <Button size="sm" onClick={() => setConfirmAction({ room, action: 'approve' })} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                          <CheckCircle className="h-4 w-4" />Duyệt
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ room, action: 'reject' })} className="gap-1">
                          <XCircle className="h-4 w-4" />Từ chối
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Đăng lúc: {new Date(room.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailRoom} onOpenChange={(open) => !open && setDetailRoom(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Chi tiết phòng trọ
            </DialogTitle>
            <DialogDescription>{detailRoom?.title}</DialogDescription>
          </DialogHeader>
          {detailRoom && (
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-4">
                {/* Images */}
                {detailRoom.images && detailRoom.images.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-1"><ImageIcon className="h-4 w-4" />Hình ảnh ({detailRoom.images.length})</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {detailRoom.images.map((img, i) => (
                        <button key={i} onClick={() => setPreviewImage(img)} className="aspect-square rounded-lg overflow-hidden border hover:opacity-80 transition-opacity">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Basic info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Giá thuê</p>
                    <p className="font-bold text-primary text-lg">{formatCurrency(detailRoom.price)}</p>
                  </div>
                  {detailRoom.deposit_amount && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Tiền cọc</p>
                      <p className="font-bold text-orange-600 dark:text-orange-400 text-lg">{formatCurrency(detailRoom.deposit_amount)}</p>
                    </div>
                  )}
                  {detailRoom.area && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Diện tích</p>
                      <p className="font-semibold">{detailRoom.area} m²</p>
                    </div>
                  )}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">Số phòng</p>
                    <p className="font-semibold">{detailRoom.room_number}</p>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <p className="text-sm font-medium mb-1 flex items-center gap-1"><MapPin className="h-4 w-4" />Địa chỉ</p>
                  <p className="text-sm text-muted-foreground">{detailRoom.address_detail}, {detailRoom.ward}, {detailRoom.district}, {detailRoom.province}</p>
                </div>

                {/* Description */}
                {detailRoom.description && (
                  <div>
                    <p className="text-sm font-medium mb-1">Mô tả</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailRoom.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {detailRoom.amenities && detailRoom.amenities.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-1"><Wifi className="h-4 w-4" />Tiện ích</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailRoom.amenities.map((a, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Service costs */}
                <div className="space-y-1 text-sm">
                  <p className="font-medium flex items-center gap-1"><Zap className="h-4 w-4" />Chi phí dịch vụ</p>
                  {detailRoom.electricity_cost && <p className="text-muted-foreground">⚡ Điện: {formatCurrency(detailRoom.electricity_cost)}/kWh</p>}
                  {detailRoom.water_cost && <p className="text-muted-foreground">💧 Nước: {formatCurrency(detailRoom.water_cost)}/{detailRoom.water_cost_type === 'per_month' ? 'tháng' : 'm³'}</p>}
                </div>

                {/* Landlord info */}
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-1 flex items-center gap-1"><User className="h-4 w-4" />Chủ trọ</p>
                  <p>{landlordMap[detailRoom.landlord_id]?.full_name} ({landlordMap[detailRoom.landlord_id]?.display_id})</p>
                  <p className="text-muted-foreground">SĐT: {detailRoom.phone}</p>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDetailRoom(null)}>Đóng</Button>
            {detailRoom && (
              <>
                <Button onClick={() => { setConfirmAction({ room: detailRoom, action: 'approve' }); }} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="h-4 w-4" />Duyệt
                </Button>
                <Button variant="destructive" onClick={() => { setConfirmAction({ room: detailRoom, action: 'reject' }); }} className="gap-1">
                  <XCircle className="h-4 w-4" />Từ chối
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'approve' ? 'Xác nhận duyệt phòng?' : 'Xác nhận từ chối phòng?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'approve'
                ? `Phòng "${confirmAction?.room.title}" sẽ được hiển thị cho người thuê trọ.`
                : `Phòng "${confirmAction?.room.title}" sẽ bị từ chối và không hiển thị.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={processing}
              className={cn(
                confirmAction?.action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-destructive hover:bg-destructive/90'
              )}
            >
              {processing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {confirmAction?.action === 'approve' ? 'Duyệt' : 'Từ chối'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image preview */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setPreviewImage(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={previewImage} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

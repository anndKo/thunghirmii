// @ts-nocheck
import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { RoomCard } from '@/components/RoomCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ReportDialog } from '@/components/ReportDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMessages } from '@/hooks/useMessages';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Search, Clock, CheckCircle, XCircle, ArrowRight, Home, MapPin, Phone, DollarSign, Flag, ExternalLink, LogOut, CalendarClock } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

interface Room {
  id: string; title: string; room_number: string; room_code?: string; price: number; area: number | null;
  province: string; district: string; ward: string; address_detail: string; phone: string;
  images: string[] | null; is_available: boolean; amenities: string[] | null; landlord_id: string;
}

interface RoomRequest {
  id: string; room_id: string; message: string | null; status: string; admin_note: string | null;
  created_at: string; rooms: Room;
}

export default function TenantDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { sendMessage, findAdminUser } = useMessages();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'suggestions';
  const [suggestedRooms, setSuggestedRooms] = useState<Room[]>([]);
  const [myRequests, setMyRequests] = useState<RoomRequest[]>([]);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSending, setLeaveSending] = useState(false);
  const [paymentDeadlineDay, setPaymentDeadlineDay] = useState<number | null>(null);

  useEffect(() => { if (user && role === 'tenant') fetchData(); }, [user, role]);

  const fetchData = async () => {
    setLoading(true);
    const [roomsRes, requestsRes, rentedRes, deadlineRes] = await Promise.all([
      supabase.from('rooms').select('id,title,room_number,room_code,price,area,province,district,ward,address_detail,phone,images,is_available,amenities,landlord_id').eq('is_available', true).limit(6),
      supabase.from('room_requests').select('id,room_id,message,status,admin_note,created_at,rooms(*)').eq('tenant_id', user?.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('rooms').select('*').eq('tenant_id', user?.id),
      supabase.from('payment_deadlines').select('deadline_day').eq('user_id', user?.id).eq('role', 'tenant').maybeSingle(),
    ]);

    if (roomsRes.data) setSuggestedRooms([...roomsRes.data].sort(() => Math.random() - 0.5) as Room[]);
    if (requestsRes.error) toast({ title: t('error'), description: t('cannotLoadRooms'), variant: 'destructive' });
    else setMyRequests(requestsRes.data as RoomRequest[]);
    if (rentedRes.data) setMyRooms(rentedRes.data as Room[]);
    if (deadlineRes?.data) setPaymentDeadlineDay(deadlineRes.data.deadline_day);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{t('statusPending')}</Badge>;
      case 'approved': case 'accepted': return <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />{t('statusApproved')}</Badge>;
      case 'forwarded': return <Badge className="bg-primary text-primary-foreground"><ArrowRight className="h-3 w-3 mr-1" />{t('statusForwarded')}</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{t('statusRejected')}</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleLeaveRoom = async () => {
    const myRoom = myRooms[0];
    if (!myRoom || !user || !leaveReason.trim()) return;
    setLeaveSending(true);
    const adminId = await findAdminUser();
    if (!adminId) {
      toast({ title: t('error'), description: 'Không tìm thấy Admin', variant: 'destructive' });
      setLeaveSending(false);
      return;
    }
    const msg = `🚪 YÊU CẦU RỜI TRỌ

🏠 Thông tin phòng:
━━━━━━━━━━━━━━━━━━
📍 Phòng: ${myRoom.room_number}
🏷️ Mã phòng: ${myRoom.room_code || 'N/A'}
📝 Tiêu đề: ${myRoom.title}
💰 Giá: ${new Intl.NumberFormat('vi-VN').format(myRoom.price)}đ/tháng
📐 Diện tích: ${myRoom.area ? myRoom.area + ' m²' : 'N/A'}
📞 SĐT: ${myRoom.phone}
🗺️ Địa chỉ: ${myRoom.address_detail}, ${myRoom.ward}, ${myRoom.district}

📋 Lý do rời trọ:
${leaveReason.trim()}

⚠️ Người thuê muốn rời khỏi phòng trọ này. Vui lòng xem xét và xử lý.`;

    await sendMessage(adminId, msg);
    toast({ title: 'Đã gửi yêu cầu!', description: 'Yêu cầu rời trọ đã được gửi đến Admin.' });
    setLeaveDialogOpen(false);
    setLeaveReason('');
    setLeaveSending(false);
  };

  if (authLoading) return (<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== 'tenant') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <div className="container px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">{t('dashboard')} - {t('roleTenant')}</h1>
          <p className="text-sm text-muted-foreground">{t('suggestedRooms')}</p>
        </div>

        <Tabs defaultValue={initialTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid grid-cols-3 tenant-tabs bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm p-1 w-full lg:w-fit"> {/* Thêm lớp "tenant-tabs" vào đây */}
            <TabsTrigger
              value="suggestions"
              className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2"
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{t('suggestions')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2"
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">
                {t('requests')} ({myRequests.length})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="myroom"
              className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2"
            >
              <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{t('myRoom')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : suggestedRooms.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {suggestedRooms.map((room) => (<RoomCard key={room.id} room={room} showActions={true} />))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('noSuggestions')}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : myRequests.length > 0 ? (
              <div className="space-y-4">
                {myRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                     <div className="min-w-0 flex-1">
                          <CardTitle className="text-base sm:text-lg truncate">{request.rooms.title}</CardTitle>
                          <CardDescription className="text-xs sm:text-sm truncate">{request.rooms.address_detail}, {request.rooms.ward}, {request.rooms.district}</CardDescription>
                        </div>
                        <div className="shrink-0">{getStatusBadge(request.status)}</div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <p><strong>{t('price')}:</strong> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(request.rooms.price)}{t('perMonth')}</p>
                        {request.message && (<p><strong>{t('messageOptional')}:</strong> {request.message}</p>)}
                        {request.admin_note && (<p className="text-primary"><strong>{t('adminNote')}:</strong> {request.admin_note}</p>)}
                        <p className="text-muted-foreground">{new Date(request.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('noRequests')}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="myroom">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : myRooms.length > 0 ? (
              <div className="space-y-4">
                {/* Payment deadline badge */}
                {paymentDeadlineDay && (
                  <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/50 dark:border-blue-800/30 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center shrink-0">
                      <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-blue-800 dark:text-blue-300">Ngày đóng trọ hàng tháng</p>
                      <p className="text-[11px] sm:text-xs text-blue-600/80 dark:text-blue-400/80">Hạn thanh toán: <span className="font-bold text-blue-700 dark:text-blue-300">ngày {paymentDeadlineDay}</span> mỗi tháng</p>
                    </div>
                    <Badge className="bg-blue-500 text-white border-0 text-xs sm:text-sm px-2.5 py-0.5 sm:px-3 sm:py-1 shadow-sm shrink-0">
                      Ngày {paymentDeadlineDay}
                    </Badge>
                  </div>
                )}
                {myRooms.map((myRoom) => (
              <Card key={myRoom.id} className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-transparent dark:from-orange-950/20 dark:via-amber-950/10 dark:to-transparent shadow-lg ring-1 ring-orange-200/50 dark:ring-orange-800/30 overflow-hidden">
                <CardHeader className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-primary" />{myRoom.title}</CardTitle>
                      <CardDescription>{t('roomNumber')}: {myRoom.room_number}{myRoom.room_code ? ` | ${t('roomCode')}: ${myRoom.room_code}` : ''}</CardDescription>
                    </div>
                    <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 shadow-sm gap-1">
                      <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
                      Đang thuê
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Lease date info */}
                    <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2">
                      <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">Ngày bắt đầu thuê:</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {new Date(myRoom.created_at || myRoom.updated_at || '').toLocaleDateString('vi-VN')}
                      </Badge>
                    </div>
                    {myRoom.images && myRoom.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {myRoom.images.slice(0, 4).map((img, idx) => (<img key={idx} src={img} alt="" className="h-32 w-48 object-cover rounded-xl flex-shrink-0 shadow-sm" />))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /><span className="font-semibold">{new Intl.NumberFormat('vi-VN').format(myRoom.price)}đ{t('perMonth')}</span></div>
                      {myRoom.area && (<div className="flex items-center gap-2"><span className="text-primary font-bold">{t('sqm')}</span><span>{myRoom.area} {t('sqm')}</span></div>)}
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><span>{myRoom.address_detail}</span></div>
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /><span>{myRoom.phone}</span></div>
                    </div>
                    {myRoom.amenities && myRoom.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1">{myRoom.amenities.map((a, i) => (<Badge key={i} variant="outline" className="text-xs">{a}</Badge>))}</div>
                    )}
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      <Button asChild variant="default" size="sm" className="gap-1.5 sm:gap-2 rounded-xl bg-gradient-primary hover:opacity-90 shadow-soft text-xs sm:text-sm">
                        <Link to={`/rooms/${myRoom.id}?from=myroom`}><ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{t('viewRoom')}</Link>
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 sm:gap-2 border-destructive/40 text-destructive/80 hover:bg-destructive/8 hover:text-destructive hover:border-destructive/60 rounded-xl transition-colors duration-200 text-xs sm:text-sm" onClick={() => setReportDialogOpen(true)}>
                        <Flag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{t('reportRoom')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 sm:gap-2 border-orange-300/60 text-orange-500/80 hover:bg-orange-500/8 hover:text-orange-600 hover:border-orange-400/70 dark:border-orange-600/40 dark:text-orange-400/80 dark:hover:bg-orange-500/10 dark:hover:text-orange-400 rounded-xl transition-colors duration-200 text-xs sm:text-sm"
                        onClick={() => setLeaveDialogOpen(true)}
                      >
                        <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Muốn rời trọ
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('noRooms')}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {myRooms.length > 0 && (
        <ReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} roomId={myRooms[0].id} roomTitle={myRooms[0].title} roomCode={myRooms[0].room_code} reporterId={user?.id} />
      )}

      {/* Leave room dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <LogOut className="h-5 w-5" />
              Yêu cầu rời trọ
            </DialogTitle>
            <DialogDescription>
              Vui lòng nhập lý do bạn muốn rời phòng trọ. Yêu cầu sẽ được gửi đến Admin xử lý.
            </DialogDescription>
          </DialogHeader>
          {myRooms.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-1.5 text-sm">
              <p className="font-medium">{myRooms[0].title}</p>
              <p className="text-muted-foreground">Phòng: {myRooms[0].room_number} {myRooms[0].room_code ? `| Mã: ${myRooms[0].room_code}` : ''}</p>
              <p className="text-muted-foreground">{myRooms[0].address_detail}</p>
            </div>
          )}
          <Textarea
            value={leaveReason}
            onChange={e => setLeaveReason(e.target.value)}
            placeholder="Nhập lý do rời trọ (bắt buộc)..."
            rows={3}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>Hủy</Button>
            <Button 
              onClick={handleLeaveRoom} 
              disabled={leaveSending || !leaveReason.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {leaveSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LogOut className="h-4 w-4 mr-1" />}
              Xác nhận rời trọ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

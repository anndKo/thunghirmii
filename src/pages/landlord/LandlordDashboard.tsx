// @ts-nocheck
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Home, Clock, CheckCircle, XCircle, Eye, Pencil, Trash2, Inbox } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Room {
  id: string;
  title: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  rejection_reason: string | null;
  created_at: string;
  room_images: { url: string }[];
}

interface RentalRequest {
  id: string;
  full_name: string;
  phone: string;
  message: string | null;
  created_at: string;
  rooms: { title: string };
}

const LandlordDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, requests: 0 });

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);

    const { data: roomsData } = await supabase
      .from('rooms')
      .select('id, title, price, status, rejection_reason, created_at, room_images(url)')
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: false });

    if (roomsData) {
      setRooms(roomsData as unknown as Room[]);
      setStats((prev) => ({
        ...prev,
        total: roomsData.length,
        pending: roomsData.filter((r: any) => r.status === 'pending').length,
        approved: roomsData.filter((r: any) => r.status === 'approved').length,
      }));
    }

    const { data: requestsData } = await supabase
      .from('rental_requests')
      .select('id, full_name, phone, message, created_at, rooms(title)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (requestsData) {
      setRequests(requestsData as unknown as RentalRequest[]);
      setStats((prev) => ({ ...prev, requests: requestsData.length }));
    }

    setLoading(false);
  };

  const handleDeleteRoom = async (roomId: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) toast({ title: 'Lỗi', description: 'Không thể xóa phòng.', variant: 'destructive' });
    else { toast({ title: 'Thành công', description: 'Đã xóa phòng trọ.' }); fetchData(); }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)} triệu`;
    return `${price.toLocaleString('vi-VN')} đ`;
  };

  const getStatusBadge = (status: Room['status']) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</Badge>;
      case 'approved': return <Badge className="gap-1 bg-green-500"><CheckCircle className="w-3 h-3" /> Đã duyệt</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Từ chối</Badge>;
      case 'hidden': return <Badge variant="outline" className="gap-1"><Eye className="w-3 h-3" /> Đã ẩn</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container py-8 space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Quản lý phòng trọ</h1>
        <Button asChild><Link to="/landlord/rooms/new"><Plus className="w-4 h-4 mr-2" />Đăng phòng mới</Link></Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tổng số phòng</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Chờ duyệt</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Đang hiển thị</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.approved}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Yêu cầu thuê</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{stats.requests}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="rooms" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rooms">Phòng của tôi</TabsTrigger>
          <TabsTrigger value="requests">Yêu cầu thuê ({stats.requests})</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-4">
          {rooms.length > 0 ? (
            <div className="space-y-4">
              {rooms.map((room) => (
                <Card key={room.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-md overflow-hidden bg-muted shrink-0">
                        {room.room_images[0] ? (
                          <img src={room.room_images[0].url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Home className="w-8 h-8 text-muted-foreground" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold truncate">{room.title}</h3>
                          {getStatusBadge(room.status)}
                        </div>
                        <p className="text-lg font-bold text-primary">{formatPrice(room.price)}/tháng</p>
                        {room.status === 'rejected' && room.rejection_reason && (
                          <p className="text-sm text-destructive">Lý do từ chối: {room.rejection_reason}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="outline" size="icon"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa phòng trọ?</AlertDialogTitle>
                              <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRoom(room.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center"><Home className="w-8 h-8 text-muted-foreground" /></div>
              <h3 className="text-lg font-medium">Chưa có phòng nào</h3>
              <p className="text-muted-foreground">Bắt đầu đăng phòng trọ đầu tiên của bạn.</p>
              <Button asChild><Link to="/landlord/rooms/new"><Plus className="w-4 h-4 mr-2" />Đăng phòng mới</Link></Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{request.full_name}</h4>
                        <p className="text-sm text-muted-foreground">Quan tâm: {request.rooms.title}</p>
                      </div>
                      <Badge variant="outline">{new Date(request.created_at).toLocaleDateString('vi-VN')}</Badge>
                    </div>
                    <p className="text-primary font-medium">{request.phone}</p>
                    {request.message && <p className="text-sm text-muted-foreground">{request.message}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center"><Inbox className="w-8 h-8 text-muted-foreground" /></div>
              <h3 className="text-lg font-medium">Chưa có yêu cầu nào</h3>
              <p className="text-muted-foreground">Khi có người quan tâm đến phòng của bạn, thông tin sẽ hiển thị ở đây.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LandlordDashboard;

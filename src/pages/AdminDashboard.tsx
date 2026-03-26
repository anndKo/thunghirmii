// @ts-nocheck
// force rebuild
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Loader2, Shield, Users, Building2, Mail, Menu, UserCog, Coins,
  LayoutGrid, BookOpen, Flag, Bell, CreditCard, KeyRound, Landmark, ShieldCheck, ClipboardList, Star, MessageSquare, Gamepad2, Trophy,
} from 'lucide-react';

// Lazy load tab components
const AdminRequestsTab = lazy(() => import('@/components/admin/AdminRequestsTab'));
const AdminUsersTab = lazy(() => import('@/components/admin/AdminUsersTab'));
const AdminRoomsTab = lazy(() => import('@/components/admin/AdminRoomsTab'));
const AdminPaymentTab = lazy(() => import('@/components/AdminPaymentTab').then(m => ({ default: m.AdminPaymentTab })));
const AdminPasswordResetTab = lazy(() => import('@/components/admin/AdminPasswordResetTab'));
const AdminDepositsTab = lazy(() => import('@/components/admin/AdminDepositsTab'));
const AdminProtectionPasswordTab = lazy(() => import('@/components/admin/AdminProtectionPasswordTab'));
const AdminRoomApprovalTab = lazy(() => import('@/components/admin/AdminRoomApprovalTab'));
const AdminRoomPriorityDialog = lazy(() => import('@/components/admin/AdminRoomPriorityDialog'));
const AdminTopRoomTab = lazy(() => import('@/components/admin/AdminTopRoomTab'));
const AdminFeedbackTab = lazy(() => import('@/components/admin/AdminFeedbackTab'));
const AccountManagementDialog = lazy(() => import('@/components/AccountManagementDialog').then(m => ({ default: m.AccountManagementDialog })));
const AdminNotificationDialog = lazy(() => import('@/components/AdminNotificationDialog').then(m => ({ default: m.AdminNotificationDialog })));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
);

export default function AdminDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'requests';
  const tenantFilter = searchParams.get('tenant') || '';
  const roomFilter = searchParams.get('room') || '';
  const highlightRequestId = searchParams.get('highlight') || '';

  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionType, setActionType] = useState('forward');
  const [submitting, setSubmitting] = useState(false);
  const [accountMgmtOpen, setAccountMgmtOpen] = useState(false);
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);

  const [stats, setStats] = useState({ totalUsers: 0, totalRooms: 0, pendingRequests: 0, pendingApprovals: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Parallel fetch all data
    const [profilesRes, rolesRes, roomsRes, requestsRes, pendingRoomsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, phone'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('rooms').select('id,title,room_number,room_code,price,province,district,is_available,created_at,landlord_id,tenant_id,approval_status').order('created_at', { ascending: false }),
      supabase.from('room_requests').select('*, rooms (title, room_number, landlord_id)').order('created_at', { ascending: false }),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    ]);

    // Process users
    if (profilesRes.data && rolesRes.data) {
      const combined = profilesRes.data.map(p => {
        const userRole = rolesRes.data.find(r => r.user_id === p.user_id);
        return { id: p.user_id, profile: { full_name: p.full_name, phone: p.phone }, role: userRole?.role || null };
      });
      setUsers(combined);
      setStats(prev => ({ ...prev, totalUsers: combined.length, pendingApprovals: pendingRoomsRes.count || 0 }));
    }

    // Process rooms - fetch landlord info in parallel
    if (roomsRes.data) {
      const landlordIds = [...new Set(roomsRes.data.map(r => r.landlord_id))].filter(Boolean);
      if (landlordIds.length > 0) {
        const [landlordProfiles, landlordSettings] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', landlordIds),
          supabase.from('user_settings').select('user_id, display_id').in('user_id', landlordIds),
        ]);
        const settingsMap = new Map((landlordSettings.data || []).map(s => [s.user_id, s.display_id]));
        const landlordMap = new Map((landlordProfiles.data || []).map(p => [p.user_id, { full_name: p.full_name, display_id: settingsMap.get(p.user_id) || null }]));
        const formatted = roomsRes.data.map(r => ({ ...r, landlord: landlordMap.get(r.landlord_id) || null }));
        setRooms(formatted);
        setStats(prev => ({ ...prev, totalRooms: formatted.length }));
      } else {
        setRooms(roomsRes.data.map(r => ({ ...r, landlord: null })));
        setStats(prev => ({ ...prev, totalRooms: roomsRes.data.length }));
      }
    }

    // Process requests
    if (requestsRes.data) {
      const tenantIds = [...new Set(requestsRes.data.map(r => r.tenant_id))].filter(Boolean);
      if (tenantIds.length > 0) {
        const { data: tenantProfiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', tenantIds);
        const profileMap = new Map((tenantProfiles || []).map(p => [p.user_id, { full_name: p.full_name, phone: p.phone }]));
        const formatted = requestsRes.data.map(r => ({ ...r, tenant: profileMap.get(r.tenant_id) || { full_name: 'Không xác định', phone: null } }));
        setRequests(formatted);
        setStats(prev => ({ ...prev, pendingRequests: formatted.filter(r => r.status === 'pending').length }));
      } else {
        setRequests(requestsRes.data.map(r => ({ ...r, tenant: { full_name: 'Không xác định', phone: null } })));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && role === 'admin') fetchData();
  }, [user, role, fetchData]);

  // Clear highlight param from URL after consuming it so reload won't re-trigger
  useEffect(() => {
    if (highlightRequestId) {
      const timeout = setTimeout(() => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('highlight');
          return next;
        }, { replace: true });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [highlightRequestId, setSearchParams]);

  // Listen for navigate-admin-request events from ChatPanel (no reload)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { tenant, room } = e.detail || {};
      const params: Record<string, string> = { tab: 'requests' };
      if (tenant) params.tenant = tenant;
      if (room) params.room = room;
      setSearchParams(params, { replace: true });
    };
    window.addEventListener('navigate-admin-request', handler as any);
    return () => window.removeEventListener('navigate-admin-request', handler as any);
  }, [setSearchParams]);

  const handleRequestAction = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);

    if (actionType === 'accept') {
      const { error: roomError } = await supabase.from('rooms').update({ tenant_id: selectedRequest.tenant_id, is_available: false }).eq('id', selectedRequest.room_id);
      if (roomError) { toast({ title: 'Lỗi', description: 'Không thể cập nhật phòng', variant: 'destructive' }); setSubmitting(false); return; }
      const { error } = await supabase.from('room_requests').update({ status: 'approved', admin_note: adminNote || null }).eq('id', selectedRequest.id);
      setSubmitting(false);
      if (error) { toast({ title: 'Lỗi', description: 'Không thể cập nhật yêu cầu', variant: 'destructive' }); }
      else { toast({ title: 'Thành công!', description: 'Đã chấp nhận yêu cầu.' }); setActionDialogOpen(false); setSelectedRequest(null); setAdminNote(''); fetchData(); }
    } else {
      const newStatus = actionType === 'forward' ? 'forwarded' : 'rejected';
      const { error } = await supabase.from('room_requests').update({ status: newStatus, admin_note: adminNote || null }).eq('id', selectedRequest.id);
      setSubmitting(false);
      if (error) { toast({ title: 'Lỗi', description: 'Không thể cập nhật yêu cầu', variant: 'destructive' }); }
      else {
        // Auto-send message to landlord when forwarding
        if (actionType === 'forward' && selectedRequest.rooms?.landlord_id) {
          const roomInfo = t('autoMsgForwardRequest', { roomTitle: selectedRequest.rooms.title, roomNumber: selectedRequest.rooms.room_number, requesterName: selectedRequest.tenant?.full_name || t('autoMsgUnknown'), requesterPhone: selectedRequest.tenant?.phone || t('autoMsgNoData'), message: selectedRequest.message || t('autoMsgNoData'), adminNote: adminNote || t('autoMsgNoData') });
          await supabase.from('messages').insert({
            sender_id: user.id,
            receiver_id: selectedRequest.rooms.landlord_id,
            content: roomInfo,
            room_id: selectedRequest.room_id,
          });
        }
        toast({ title: 'Thành công!', description: actionType === 'forward' ? 'Đã chuyển tiếp và gửi tin nhắn cho chủ trọ' : 'Đã từ chối' });
        setActionDialogOpen(false); setSelectedRequest(null); setAdminNote(''); fetchData();
      }
    }
  };

  const openActionDialog = (request, type) => {
    setSelectedRequest(request);
    setActionType(type);
    setAdminNote('');
    setActionDialogOpen(true);
  };

  const openDeleteDialog = (request) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;
    setSubmitting(true);
    const { error } = await supabase.from('room_requests').delete().eq('id', requestToDelete.id);
    setSubmitting(false);
    if (error) { toast({ title: 'Lỗi', description: 'Không thể xóa yêu cầu', variant: 'destructive' }); }
    else { toast({ title: 'Thành công!', description: 'Đã xóa yêu cầu.' }); setDeleteDialogOpen(false); setRequestToDelete(null); fetchData(); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Quản lý người dùng, phòng trọ và yêu cầu thuê phòng</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSearchParams({ tab: 'room-approval' })} className="gap-2 relative">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Duyệt phòng trọ</span>
              {stats.pendingApprovals > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {stats.pendingApprovals}
                </Badge>
              )}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <LayoutGrid className="h-4 w-4" /><span className="hidden sm:inline">Tổng hợp chức năng</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/admin/guides')} className="gap-2"><BookOpen className="h-4 w-4" />Quản lí hướng dẫn</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNotifDialogOpen(true)} className="gap-2"><Bell className="h-4 w-4" />Tạo thông báo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/reports')} className="gap-2"><Flag className="h-4 w-4 text-destructive" />Các báo cáo phòng trọ</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchParams({ tab: 'protection' })} className="gap-2"><ShieldCheck className="h-4 w-4" />{t('protectionPasswordMgmt')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityDialogOpen(true)} className="gap-2"><Star className="h-4 w-4 text-amber-500" />Đưa trọ lên top</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchParams({ tab: 'feedbacks' })} className="gap-2"><MessageSquare className="h-4 w-4 text-green-500" />Phản hồi người dùng</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/minigames')} className="gap-2"><Gamepad2 className="h-4 w-4 text-purple-500" />Tạo Mini Game</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/ranking')} className="gap-2"><Trophy className="h-4 w-4 text-yellow-500" />Quản lí Ranking</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/admin/reward-exchange')} className="gap-2"><Coins className="h-4 w-4 text-amber-500" />Quản lí điểm thưởng</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><Menu className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAccountMgmtOpen(true)} className="gap-2"><UserCog className="h-4 w-4" />Quản lí tài khoản</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tổng người dùng</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.totalUsers}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tổng phòng trọ</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.totalRooms}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Yêu cầu chờ xử lý</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-accent">{stats.pendingRequests}</div></CardContent>
          </Card>
        </div>

        <Tabs value={initialTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="requests" className="gap-2"><Mail className="h-4 w-4" /><span className="hidden sm:inline">Yêu cầu</span></TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Người dùng</span></TabsTrigger>
            <TabsTrigger value="rooms" className="gap-2"><Building2 className="h-4 w-4" /><span className="hidden sm:inline">Phòng trọ</span></TabsTrigger>
            <TabsTrigger value="payments" className="gap-2"><CreditCard className="h-4 w-4" /><span className="hidden sm:inline">Thanh toán</span></TabsTrigger>
            <TabsTrigger value="password-reset" className="gap-2"><KeyRound className="h-4 w-4" /><span className="hidden sm:inline">Lấy lại MK</span></TabsTrigger>
            <TabsTrigger value="deposits" className="gap-2"><Landmark className="h-4 w-4" /><span className="hidden sm:inline">Tiền cọc</span></TabsTrigger>
            <TabsTrigger value="protection" className="gap-2"><ShieldCheck className="h-4 w-4" /><span className="hidden sm:inline">{t('protectionPasswordMgmt')}</span></TabsTrigger>
            <TabsTrigger value="top-room" className="gap-2"><Star className="h-4 w-4 text-amber-500" /><span className="hidden sm:inline">Đưa trọ lên top</span></TabsTrigger>
            <TabsTrigger value="feedbacks" className="gap-2"><MessageSquare className="h-4 w-4 text-green-500" /><span className="hidden sm:inline">Phản hồi</span></TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Suspense fallback={<TabLoader />}>
              <AdminRequestsTab
                requests={requests}
                loading={loading}
                tenantFilter={tenantFilter}
                roomFilter={roomFilter}
                highlightRequestId={highlightRequestId}
                onOpenAction={openActionDialog}
                onDeleteRequest={openDeleteDialog}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="users">
            <Suspense fallback={<TabLoader />}>
              <AdminUsersTab users={users} loading={loading} />
            </Suspense>
          </TabsContent>

          <TabsContent value="rooms">
            <Suspense fallback={<TabLoader />}>
              <AdminRoomsTab rooms={rooms} loading={loading} onRefresh={fetchData} />
            </Suspense>
          </TabsContent>

          <TabsContent value="payments">
            <Suspense fallback={<TabLoader />}>
              <AdminPaymentTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="password-reset">
            <Suspense fallback={<TabLoader />}>
              <AdminPasswordResetTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="deposits">
            <Suspense fallback={<TabLoader />}>
              <AdminDepositsTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="protection">
            <Suspense fallback={<TabLoader />}>
              <AdminProtectionPasswordTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="room-approval">
            <Suspense fallback={<TabLoader />}>
              <AdminRoomApprovalTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="top-room">
            <Suspense fallback={<TabLoader />}>
              <AdminTopRoomTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="feedbacks">
            <Suspense fallback={<TabLoader />}>
              <AdminFeedbackTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'forward' ? 'Chuyển yêu cầu cho chủ trọ' : actionType === 'accept' ? 'Chấp nhận yêu cầu thuê phòng' : 'Từ chối yêu cầu'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'forward' ? 'Thông tin người thuê sẽ được gửi đến chủ trọ.' : actionType === 'accept' ? 'Người thuê sẽ được thêm vào phòng.' : 'Người thuê sẽ nhận được thông báo từ chối.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ghi chú (tùy chọn)</Label>
              <Textarea placeholder="Thêm ghi chú..." value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Hủy</Button>
            <Button
              onClick={handleRequestAction}
              disabled={submitting}
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              className={actionType === 'accept' ? 'bg-green-600 hover:bg-green-700' : actionType === 'forward' ? 'bg-gradient-primary hover:opacity-90' : ''}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionType === 'forward' ? 'Chuyển tiếp' : actionType === 'accept' ? 'Chấp nhận' : 'Từ chối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa yêu cầu</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa yêu cầu thuê phòng "{requestToDelete?.rooms?.title}" của {requestToDelete?.tenant?.full_name}? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteRequest} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        {accountMgmtOpen && <AccountManagementDialog open={accountMgmtOpen} onOpenChange={setAccountMgmtOpen} />}
        {notifDialogOpen && <AdminNotificationDialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen} />}
        {priorityDialogOpen && <AdminRoomPriorityDialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen} />}
      </Suspense>
    </div>
  );
}

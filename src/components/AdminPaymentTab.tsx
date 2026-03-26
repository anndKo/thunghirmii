// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2, CheckCircle, Clock, Search, AlertTriangle, CalendarClock, Check, History,
} from 'lucide-react';

interface PaymentUser {
  user_id: string;
  full_name: string;
  phone: string | null;
  display_id: string;
  role: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  room_title?: string;
  room_id?: string;
  rent_amount?: number;
  tenant_rooms?: { id: string; title: string; price: number; room_code?: string }[];
  deadline_day?: number;
  deadline_id?: string;
  paid_month?: string;
  payment_status: 'paid' | 'waiting' | 'none';
}

interface ActionLog {
  id: string;
  action_type: string;
  target_user_name: string | null;
  details: string | null;
  created_at: string;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPaymentStatus(deadlineDay?: number, paidMonth?: string): 'paid' | 'waiting' | 'none' {
  if (!deadlineDay) return 'none';
  const currentMonth = getCurrentMonth();
  if (paidMonth === currentMonth) return 'paid';
  const today = new Date().getDate();
  if (today >= deadlineDay) return 'waiting';
  return 'none';
}

const actionTypeLabels: Record<string, string> = {
  set_deadline: 'Đặt hạn thanh toán',
  confirm_payment: 'Xác nhận thanh toán',
  set_shared_deadline: 'Đặt hạn chung chủ trọ',
};

export function AdminPaymentTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<PaymentUser[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PaymentUser | null>(null);

  // Deadline dialog
  const [deadlineDialogOpen, setDeadlineDialogOpen] = useState(false);
  const [deadlineTarget, setDeadlineTarget] = useState<{ userId: string | null; role: string; name: string } | null>(null);
  const [deadlineDay, setDeadlineDay] = useState<string>('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  // Shared landlord deadline
  const [sharedLandlordDay, setSharedLandlordDay] = useState<number | null>(null);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<ActionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => { fetchPaymentData(); }, []);

  const logAction = useCallback(async (actionType: string, targetUserId: string | null, targetUserName: string, details: string) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) return;
    await (supabase as any).from('payment_action_logs').insert({
      admin_id: session.session.user.id,
      action_type: actionType,
      target_user_id: targetUserId,
      target_user_name: targetUserName,
      details,
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data } = await (supabase as any)
      .from('payment_action_logs')
      .select('id, action_type, target_user_name, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setHistoryLogs(data || []);
    setHistoryLoading(false);
  }, []);

  const openHistory = () => {
    setHistoryOpen(true);
    fetchHistory();
  };

  const fetchPaymentData = async () => {
    setLoading(true);

    const [
      { data: profiles },
      { data: roles },
      { data: paymentInfos },
      { data: rooms },
      { data: deadlines },
      { data: userSettings },
    ] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, phone'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('landlord_payment_info').select('*'),
      supabase.from('rooms').select('id, title, tenant_id, landlord_id, price, room_code'),
      (supabase as any).from('payment_deadlines').select('*'),
      supabase.from('user_settings').select('user_id, display_id'),
    ]);

    const displayIdMap = new Map((userSettings || []).map((s: any) => [s.user_id, s.display_id || 'N/A']));

    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    const paymentMap = new Map((paymentInfos || []).map(p => [p.user_id, p]));

    const tenantDeadlineMap = new Map();
    const landlordDeadlineMap = new Map();
    let sharedDay: number | null = null;

    (deadlines || []).forEach((d: any) => {
      if (d.role === 'landlord' && !d.user_id) {
        sharedDay = d.deadline_day;
      } else if (d.role === 'landlord' && d.user_id) {
        landlordDeadlineMap.set(d.user_id, d);
      } else if (d.role === 'tenant' && d.user_id) {
        tenantDeadlineMap.set(d.user_id, d);
      }
    });
    setSharedLandlordDay(sharedDay);

    const result: PaymentUser[] = [];

    (profiles || []).forEach(p => {
      const role = roleMap.get(p.user_id);
      if (role === 'landlord') {
        const pi = paymentMap.get(p.user_id);
        const ld = landlordDeadlineMap.get(p.user_id);
        const day = sharedDay || undefined;
        const paidMonth = ld?.paid_month || undefined;
        const status = getPaymentStatus(day, paidMonth);

        result.push({
          user_id: p.user_id, full_name: p.full_name, phone: p.phone, role: 'landlord',
          display_id: displayIdMap.get(p.user_id) || 'N/A',
          bank_name: pi?.bank_name || '', account_number: pi?.account_number || '',
          account_holder: pi?.account_holder || '', deadline_day: day, deadline_id: ld?.id || undefined,
          paid_month: paidMonth, payment_status: status,
        });
      }
    });

    (profiles || []).forEach(p => {
      const role = roleMap.get(p.user_id);
      if (role === 'tenant') {
        // Find ALL rooms rented by this tenant
        const tenantRooms = (rooms || []).filter(r => r.tenant_id === p.user_id);
        const td = tenantDeadlineMap.get(p.user_id);
        const day = td?.deadline_day || undefined;
        const paidMonth = td?.paid_month || undefined;
        const status = getPaymentStatus(day, paidMonth);

        result.push({
          user_id: p.user_id, full_name: p.full_name, phone: p.phone, role: 'tenant',
          display_id: displayIdMap.get(p.user_id) || 'N/A',
          room_title: tenantRooms.length > 0 ? tenantRooms[0].title : '',
          room_id: tenantRooms.length > 0 ? tenantRooms[0].id : '',
          rent_amount: tenantRooms.length > 0 ? tenantRooms[0].price : 0,
          tenant_rooms: tenantRooms.map(r => ({ id: r.id, title: r.title, price: r.price, room_code: r.room_code })),
          deadline_day: day, deadline_id: td?.id || undefined, paid_month: paidMonth, payment_status: status,
        });
      }
    });

    setUsers(result);
    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search) || u.display_id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || u.payment_status === statusFilter;
      return matchRole && matchSearch && matchStatus;
    });
  }, [users, roleFilter, search, statusFilter]);

  const waitingCount = useMemo(() => users.filter(u => u.payment_status === 'waiting').length, [users]);
  const paidCount = useMemo(() => users.filter(u => u.payment_status === 'paid').length, [users]);

  const sendNotification = useCallback(async (title: string, content: string, targetRole: string) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) return;
    await supabase.from('notifications').insert({
      title, content, target_role: targetRole, created_by: session.session.user.id,
    });
  }, []);

  const openDeadlineDialog = (userId: string | null, role: string, name: string, currentDay?: number) => {
    setDeadlineTarget({ userId, role, name });
    setDeadlineDay(currentDay ? String(currentDay) : '');
    setDeadlineDialogOpen(true);
  };

  const saveDeadline = async () => {
    if (!deadlineTarget || !deadlineDay) return;
    const dayNum = parseInt(deadlineDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      toast({ title: 'Lỗi', description: 'Ngày hạn phải từ 1-31', variant: 'destructive' });
      return;
    }
    setSavingDeadline(true);

    const { userId, role, name } = deadlineTarget;

    if (role === 'landlord' && !userId) {
      const { data: existing } = await (supabase as any)
        .from('payment_deadlines').select('id').is('user_id', null).eq('role', 'landlord').maybeSingle();

      if (existing) {
        await (supabase as any).from('payment_deadlines').update({ deadline_day: dayNum, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await (supabase as any).from('payment_deadlines').insert({ user_id: null, role: 'landlord', deadline_day: dayNum, deadline_date: new Date().toISOString().split('T')[0] });
      }

      await logAction('set_shared_deadline', null, 'Tất cả chủ trọ', `Đặt hạn chung: ngày ${dayNum} hàng tháng`);
      await sendNotification('Hạn thanh toán chủ trọ', `Admin đã đặt hạn thanh toán chung cho tất cả chủ trọ: ngày ${dayNum} hàng tháng`, 'landlord');
    } else if (role === 'tenant' && userId) {
      const { data: existing } = await (supabase as any)
        .from('payment_deadlines').select('id').eq('user_id', userId).eq('role', 'tenant').maybeSingle();

      if (existing) {
        await (supabase as any).from('payment_deadlines').update({ deadline_day: dayNum, updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await (supabase as any).from('payment_deadlines').insert({ user_id: userId, role: 'tenant', deadline_day: dayNum, deadline_date: new Date().toISOString().split('T')[0] });
      }

      await logAction('set_deadline', userId, name, `Đặt hạn thanh toán: ngày ${dayNum} hàng tháng`);
      await sendNotification('Hạn thanh toán', `Admin đã đặt hạn thanh toán cho ${name}: ngày ${dayNum} hàng tháng`, 'tenant');
    }

    toast({ title: 'Đã đặt hạn thanh toán', description: `${name}: ngày ${dayNum} hàng tháng` });
    setSavingDeadline(false);
    setDeadlineDialogOpen(false);
    fetchPaymentData();
  };

  const handleConfirmPayment = async (u: PaymentUser) => {
    setConfirming(u.user_id);
    const currentMonth = getCurrentMonth();

    if (u.role === 'tenant') {
      if (u.deadline_id) {
        await (supabase as any).from('payment_deadlines').update({
          paid_month: currentMonth, is_paid: true, paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', u.deadline_id);
      } else if (u.deadline_day) {
        await (supabase as any).from('payment_deadlines').insert({
          user_id: u.user_id, role: 'tenant', deadline_day: u.deadline_day,
          deadline_date: new Date().toISOString().split('T')[0],
          paid_month: currentMonth, is_paid: true, paid_at: new Date().toISOString(),
        });
      }
      await logAction('confirm_payment', u.user_id, u.full_name, `Xác nhận thanh toán tháng ${currentMonth} cho người thuê`);
      await sendNotification('Xác nhận thanh toán', `Thanh toán tháng ${new Date().getMonth() + 1} của ${u.full_name} đã được xác nhận`, 'tenant');
    } else if (u.role === 'landlord') {
      const { data: existing } = await (supabase as any)
        .from('payment_deadlines').select('id').eq('user_id', u.user_id).eq('role', 'landlord').maybeSingle();

      if (existing) {
        await (supabase as any).from('payment_deadlines').update({
          paid_month: currentMonth, is_paid: true, paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await (supabase as any).from('payment_deadlines').insert({
          user_id: u.user_id, role: 'landlord', deadline_day: sharedLandlordDay || 1,
          deadline_date: new Date().toISOString().split('T')[0],
          paid_month: currentMonth, is_paid: true, paid_at: new Date().toISOString(),
        });
      }
      await logAction('confirm_payment', u.user_id, u.full_name, `Xác nhận thanh toán tháng ${currentMonth} cho chủ trọ`);
      await sendNotification('Xác nhận thanh toán', `Thanh toán tháng ${new Date().getMonth() + 1} của chủ trọ ${u.full_name} đã được xác nhận`, 'landlord');
    }

    toast({ title: 'Thành công', description: `Đã xác nhận thanh toán cho ${u.full_name}` });
    setConfirming(null);
    fetchPaymentData();
  };

  const getStatusBadge = (u: PaymentUser) => {
    if (u.payment_status === 'paid') {
      return (
        <Badge className="bg-green-600 text-white gap-1 w-fit">
          <CheckCircle className="h-3 w-3" /> Đã thanh toán
        </Badge>
      );
    }
    if (u.payment_status === 'waiting') {
      return (
        <Badge variant="destructive" className="gap-1 w-fit">
          <AlertTriangle className="h-3 w-3" /> Chờ thanh toán
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1 w-fit">
        <Clock className="h-3 w-3" /> Chưa đến hạn
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm theo tên, SĐT, ID người thuê..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Vai trò" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="landlord">Chủ trọ</SelectItem>
                <SelectItem value="tenant">Người thuê</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="paid">Đã thanh toán ({paidCount})</SelectItem>
                <SelectItem value="waiting">Chờ thanh toán ({waitingCount})</SelectItem>
                <SelectItem value="none">Chưa đến hạn</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={openHistory}>
              <History className="h-4 w-4" />
              Lịch sử
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shared landlord deadline button */}
      {(roleFilter === 'all' || roleFilter === 'landlord') && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">
                Hạn thanh toán chung chủ trọ: {sharedLandlordDay
                  ? <strong>Ngày {sharedLandlordDay} hàng tháng</strong>
                  : <span className="text-muted-foreground">Chưa đặt</span>}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => openDeadlineDialog(null, 'landlord', 'Tất cả chủ trọ', sharedLandlordDay || undefined)}
            >
              <CalendarClock className="h-4 w-4" />
              Đặt hạn chủ trọ
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Waiting alert */}
      {waitingCount > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              Có {waitingCount} người đang chờ thanh toán
            </span>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Họ tên</TableHead>
                <TableHead className="min-w-[100px]">ID người thuê</TableHead>
                <TableHead className="min-w-[90px]">SĐT</TableHead>
                <TableHead className="min-w-[90px]">Vai trò</TableHead>
                <TableHead className="min-w-[130px]">Thông tin TT</TableHead>
                <TableHead className="min-w-[120px]">Hạn thanh toán</TableHead>
                <TableHead className="min-w-[120px]">Trạng thái</TableHead>
                <TableHead className="min-w-[140px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.user_id} className={u.payment_status === 'waiting' ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{u.display_id}</Badge></TableCell>
                    <TableCell className="text-sm">{u.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'landlord' ? 'default' : 'secondary'}>
                        {u.role === 'landlord' ? 'Chủ trọ' : 'Người thuê'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.role === 'landlord' ? (
                        <div className="text-xs space-y-0.5">
                          {u.bank_name ? (
                            <>
                              <p><strong>NH:</strong> {u.bank_name}</p>
                              <p><strong>STK:</strong> {u.account_number}</p>
                              <p><strong>Tên:</strong> {u.account_holder}</p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Chưa cập nhật</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs space-y-1">
                          {u.tenant_rooms && u.tenant_rooms.length > 1 ? (
                            u.tenant_rooms.map((room, idx) => (
                              <div key={room.id} className={idx > 0 ? 'pt-1 border-t border-border/50' : ''}>
                                <p><strong>Phòng:</strong> {room.title}</p>
                                <p className="text-muted-foreground font-mono text-[10px]">Mã: {room.room_code || room.id}</p>
                                <p><strong>Tiền:</strong> {new Intl.NumberFormat('vi-VN').format(room.price)}đ</p>
                              </div>
                            ))
                          ) : (
                            <>
                              <p><strong>Phòng:</strong> {u.room_title || 'Chưa thuê'}</p>
                              {u.rent_amount ? <p><strong>Tiền:</strong> {new Intl.NumberFormat('vi-VN').format(u.rent_amount)}đ</p> : null}
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {u.deadline_day ? (
                          <span className={`text-xs font-medium ${u.payment_status === 'waiting' ? 'text-destructive' : 'text-foreground'}`}>
                            Ngày {u.deadline_day} hàng tháng
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Chưa đặt</span>
                        )}
                        {u.role === 'tenant' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary"
                            onClick={() => openDeadlineDialog(u.user_id, 'tenant', u.full_name, u.deadline_day)}
                          >
                            <CalendarClock className="h-3 w-3" />
                            Đặt hạn
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(u)}
                        {u.payment_status === 'paid' && u.paid_month && (
                          <span className="text-[10px] text-muted-foreground">
                            Tháng {u.paid_month}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {u.payment_status !== 'paid' && u.deadline_day && (
                          <Button
                            size="sm"
                            onClick={() => setConfirmTarget(u)}
                            disabled={confirming === u.user_id}
                            className="bg-green-600 hover:bg-green-700 text-xs h-7"
                          >
                            {confirming === u.user_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1" />
                            )}
                            Xác nhận TT
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Deadline Dialog */}
      <Dialog open={deadlineDialogOpen} onOpenChange={setDeadlineDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Đặt hạn thanh toán
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Đặt hạn cho: <strong>{deadlineTarget?.name}</strong>
            </p>
            <div className="space-y-1">
              <Label className="text-sm">Ngày trong tháng (1-31)</Label>
              <Input
                type="number"
                min={1}
                max={31}
                placeholder="VD: 5"
                value={deadlineDay}
                onChange={(e) => setDeadlineDay(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Hệ thống sẽ tự động chuyển trạng thái sang "Chờ thanh toán" vào ngày này mỗi tháng
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeadlineDialogOpen(false)}>Huỷ</Button>
            <Button onClick={saveDeadline} disabled={!deadlineDay || savingDeadline}>
              {savingDeadline && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Lịch sử thao tác thanh toán
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Chưa có lịch sử thao tác</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[55vh] pr-2">
              <div className="space-y-3">
                {historyLogs.map(log => (
                  <div key={log.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {actionTypeLabels[log.action_type] || log.action_type}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {log.target_user_name && (
                      <p className="text-sm font-medium">{log.target_user_name}</p>
                    )}
                    {log.details && (
                      <p className="text-xs text-muted-foreground">{log.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm payment AlertDialog */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(v) => { if (!v) setConfirmTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận thanh toán?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xác nhận thanh toán tháng {getCurrentMonth()} cho <strong>{confirmTarget?.full_name}</strong> ({confirmTarget?.role === 'landlord' ? 'Chủ trọ' : 'Người thuê'})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTarget) {
                  handleConfirmPayment(confirmTarget);
                  setConfirmTarget(null);
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

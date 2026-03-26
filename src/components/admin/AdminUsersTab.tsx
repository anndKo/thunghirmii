// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import {
  Search, Loader2, ShieldBan, ShieldCheck, Smartphone, Eye, History,
  Monitor, Globe, Fingerprint, Cpu, Clock, Headphones, Mail, Phone, MessageSquare,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface UserWithRole {
  id: string;
  profile: { full_name: string; phone: string | null } | null;
  role: string | null;
  display_id?: string;
  email?: string;
}

interface DeviceInfo {
  id: string;
  fingerprint_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
}

interface BlockedDevice {
  id: string;
  fingerprint_hash: string;
  reason: string;
  blocked_at: string;
  blocked_until: string | null;
}

interface SecurityLog {
  id: string;
  event_type: string;
  fingerprint_hash: string | null;
  ip_address: string | null;
  email: string | null;
  risk_score: number | null;
  created_at: string;
  metadata: any;
}

interface Props {
  users: UserWithRole[];
  loading: boolean;
}

function parseUA(ua: string | null) {
  if (!ua) return { browser: 'N/A', os: 'N/A', device: 'N/A' };
  let browser = 'Khác';
  let os = 'Khác';
  
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  const device = ua.includes('Mobile') ? 'Điện thoại' : 'Máy tính';
  return { browser, os, device };
}

export default function AdminUsersTab({ users: initialUsers, loading: initialLoading }: Props) {
  const { toast } = useToast();
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Extended user data
  const [userSettings, setUserSettings] = useState<Record<string, string>>({});
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [deviceMap, setDeviceMap] = useState<Record<string, DeviceInfo[]>>({});
  const [blockedFingerprints, setBlockedFingerprints] = useState<Set<string>>(new Set());
  const [blockedDevicesData, setBlockedDevicesData] = useState<BlockedDevice[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Dialogs
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [deviceDialogUser, setDeviceDialogUser] = useState<UserWithRole | null>(null);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ userId: string; fingerprint: string; userName: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [unblockTarget, setUnblockTarget] = useState<{ fingerprint: string; userId?: string; userName: string } | null>(null);
  const [unblockConfirmOpen, setUnblockConfirmOpen] = useState(false);
  const [securityLogsOpen, setSecurityLogsOpen] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [securityLogsLoading, setSecurityLogsLoading] = useState(false);
  const [securityLogsUser, setSecurityLogsUser] = useState<UserWithRole | null>(null);

  // Support requests
  const [supportRequestsOpen, setSupportRequestsOpen] = useState(false);
  const [supportRequests, setSupportRequests] = useState<any[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [selectedSupport, setSelectedSupport] = useState<any | null>(null);
  const [supportDetailOpen, setSupportDetailOpen] = useState(false);
  const [supportAdminNote, setSupportAdminNote] = useState('');

  const fetchSupportRequests = async () => {
    setSupportLoading(true);
    const { data } = await supabase
      .from('device_support_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setSupportRequests(data || []);
    setSupportLoading(false);
  };

  const openSupportRequests = () => {
    setSupportRequestsOpen(true);
    fetchSupportRequests();
  };

  const handleSupportStatus = async (id: string, status: string) => {
    await supabase.from('device_support_requests').update({
      status,
      admin_note: supportAdminNote.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: status === 'resolved' ? 'Đã xử lý' : 'Đã từ chối' });
    setSupportDetailOpen(false);
    setSelectedSupport(null);
    setSupportAdminNote('');
    fetchSupportRequests();
  };


  const fetchExtendedData = useCallback(async () => {
    setDataLoading(true);
    const userIds = initialUsers.map(u => u.id);
    if (userIds.length === 0) { setDataLoading(false); return; }

    const [settingsRes, devicesRes, blockedRes, emailsRes] = await Promise.all([
      supabase.from('user_settings').select('user_id, display_id').in('user_id', userIds),
      supabase.from('device_fingerprints').select('*').in('user_id', userIds),
      supabase.from('blocked_devices').select('*'),
      supabase.functions.invoke('list-auth-users'),
    ]);

    // Settings map
    const sMap: Record<string, string> = {};
    (settingsRes.data || []).forEach(s => { sMap[s.user_id] = s.display_id; });
    setUserSettings(sMap);

    // Email map from auth users
    const eMap: Record<string, string> = {};
    if (emailsRes.data?.users) {
      (emailsRes.data.users as { id: string; email: string }[]).forEach(u => { eMap[u.id] = u.email; });
    }
    setUserEmails(eMap);

    // Device map
    const dMap: Record<string, DeviceInfo[]> = {};
    (devicesRes.data || []).forEach(d => {
      if (!dMap[d.user_id]) dMap[d.user_id] = [];
      dMap[d.user_id].push(d);
    });
    setDeviceMap(dMap);

    // Blocked fingerprints
    const blocked = new Set<string>();
    (blockedRes.data || []).forEach(b => blocked.add(b.fingerprint_hash));
    setBlockedFingerprints(blocked);
    setBlockedDevicesData(blockedRes.data || []);

    setDataLoading(false);
  }, [initialUsers]);

  useEffect(() => {
    if (!initialLoading && initialUsers.length > 0) fetchExtendedData();
  }, [initialLoading, initialUsers, fetchExtendedData]);

  // Check if user has any blocked device or is banned
  const [bannedUserIds, setBannedUserIds] = useState<Set<string>>(new Set());

  // Fetch banned users
  useEffect(() => {
    const fetchBanned = async () => {
      const { data } = await supabase.from('banned_users').select('user_id');
      setBannedUserIds(new Set((data || []).map(b => b.user_id)));
    };
    if (!initialLoading) fetchBanned();
  }, [initialLoading, initialUsers]);

  const isUserBlocked = (userId: string): boolean => {
    if (bannedUserIds.has(userId)) return true;
    const devices = deviceMap[userId] || [];
    return devices.some(d => blockedFingerprints.has(d.fingerprint_hash));
  };

  const filteredUsers = useMemo(() => {
    return initialUsers.filter(u => {
      const displayId = userSettings[u.id] || '';
      const email = userEmails[u.id] || '';
      const matchesSearch = !userSearch ||
        u.profile?.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.profile?.phone?.includes(userSearch) ||
        displayId.toLowerCase().includes(userSearch.toLowerCase()) ||
        email.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const blocked = isUserBlocked(u.id);
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'blocked' && blocked) ||
        (statusFilter === 'active' && !blocked);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [initialUsers, userSearch, userRoleFilter, statusFilter, userSettings, userEmails, deviceMap, blockedFingerprints]);

  const getRoleBadge = (roleValue: string | null) => {
    switch (roleValue) {
      case 'admin': return <Badge className="bg-accent text-accent-foreground">Admin</Badge>;
      case 'landlord': return <Badge className="bg-primary text-primary-foreground">Chủ trọ</Badge>;
      case 'tenant': return <Badge className="bg-secondary text-secondary-foreground">Người thuê</Badge>;
      default: return <Badge variant="outline">Không xác định</Badge>;
    }
  };

  // Block device (or ban user if no device yet)
  const handleBlockDevice = async () => {
    if (!blockTarget || !blockReason.trim()) {
      toast({ title: 'Vui lòng nhập lý do chặn', variant: 'destructive' });
      return;
    }

    // Always ban the user account
    await supabase.from('banned_users').upsert({
      user_id: blockTarget.userId,
      banned_by: (await supabase.auth.getUser()).data.user?.id || '',
      reason: blockReason.trim(),
    }, { onConflict: 'user_id' });

    // If device fingerprint exists, also block the device immediately
    if (blockTarget.fingerprint) {
      await supabase.functions.invoke('security-check', {
        body: {
          action: 'admin_block_device',
          fingerprint_hash: blockTarget.fingerprint,
          reason: blockReason.trim(),
        },
      });
    }

    toast({ title: 'Đã chặn', description: blockTarget.fingerprint
      ? `Thiết bị của ${blockTarget.userName} đã bị chặn`
      : `Tài khoản ${blockTarget.userName} đã bị cấm. Thiết bị sẽ bị chặn khi họ đăng nhập.`
    });
    fetchExtendedData();
    // Refresh banned users
    const { data: banData } = await supabase.from('banned_users').select('user_id');
    setBannedUserIds(new Set((banData || []).map(b => b.user_id)));
    setBlockConfirmOpen(false);
    setBlockTarget(null);
    setBlockReason('');
  };

  // Unblock device and unban user
  const handleUnblockDevice = async () => {
    if (!unblockTarget) return;

    // Unblock device if fingerprint exists
    if (unblockTarget.fingerprint) {
      await supabase.functions.invoke('security-check', {
        body: {
          action: 'admin_unblock_device',
          fingerprint_hash: unblockTarget.fingerprint,
        },
      });
    }

    // Also remove from banned_users
    if (unblockTarget.userId) {
      await supabase.from('banned_users').delete().eq('user_id', unblockTarget.userId);
    }

    toast({ title: 'Đã bỏ chặn', description: `${unblockTarget.userName} đã được mở khóa` });
    fetchExtendedData();
    // Refresh banned users
    const { data: banData } = await supabase.from('banned_users').select('user_id');
    setBannedUserIds(new Set((banData || []).map(b => b.user_id)));
    setUnblockConfirmOpen(false);
    setUnblockTarget(null);
  };

  // View device info
  const openDeviceDialog = (user: UserWithRole) => {
    setDeviceDialogUser(user);
    setDeviceDialogOpen(true);
  };

  // View security logs
  const openSecurityLogs = async (user: UserWithRole) => {
    setSecurityLogsUser(user);
    setSecurityLogsOpen(true);
    setSecurityLogsLoading(true);

    const devices = deviceMap[user.id] || [];
    const fingerprints = devices.map(d => d.fingerprint_hash);

    if (fingerprints.length > 0) {
      const { data } = await supabase
        .from('security_audit_log')
        .select('*')
        .or(`user_id.eq.${user.id},fingerprint_hash.in.(${fingerprints.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(50);
      setSecurityLogs(data || []);
    } else {
      const { data } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setSecurityLogs(data || []);
    }
    setSecurityLogsLoading(false);
  };

  const isLoading = initialLoading || dataLoading;

  const eventTypeLabels: Record<string, string> = {
    login_success: 'Đăng nhập thành công',
    login_failed: 'Đăng nhập thất bại',
    login_blocked: 'Bị chặn đăng nhập',
    device_blocked: 'Thiết bị bị chặn',
    lockout: 'Khóa tạm thời',
    bot_detected: 'Phát hiện bot',
  };

  return (
    <>
      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo ID, tên, email, SĐT..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Vai trò" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="landlord">Chủ trọ</SelectItem>
                <SelectItem value="tenant">Người thuê</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="blocked">Đã chặn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Support requests button */}
      <div className="mb-4 flex justify-end">
        <Button variant="outline" className="gap-2" onClick={openSupportRequests}>
          <Headphones className="h-4 w-4" />
          Phản hồi liên hệ
          {supportRequests.filter(r => r.status === 'pending').length > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs">{supportRequests.filter(r => r.status === 'pending').length}</Badge>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[90px]">ID</TableHead>
                  <TableHead className="min-w-[130px]">Tên</TableHead>
                  <TableHead className="min-w-[160px]">Email / SĐT</TableHead>
                  <TableHead className="min-w-[120px]">Thiết bị</TableHead>
                  <TableHead className="min-w-[80px]">Vai trò</TableHead>
                  <TableHead className="min-w-[100px]">Trạng thái</TableHead>
                  <TableHead className="min-w-[200px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Không có dữ liệu
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const blocked = isUserBlocked(user.id);
                    const devices = deviceMap[user.id] || [];
                    const latestDevice = devices[0];
                    const uaParsed = parseUA(latestDevice?.user_agent);
                    const displayId = userSettings[user.id] || '—';
                    const email = userEmails[user.id] || '';

                    return (
                      <TableRow key={user.id} className={blocked ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{displayId}</span>
                        </TableCell>
                        <TableCell className="font-medium">{user.profile?.full_name || 'N/A'}</TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {email && <p className="truncate max-w-[180px]">{email}</p>}
                            {user.profile?.phone && <p className="text-muted-foreground">{user.profile.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {latestDevice ? (
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Monitor className="h-3 w-3 text-muted-foreground" />
                                <span>{uaParsed.device}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Globe className="h-3 w-3 text-muted-foreground" />
                                <span>{uaParsed.browser} / {uaParsed.os}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Chưa ghi nhận</span>
                          )}
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          {blocked ? (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldBan className="h-3 w-3" />Đã chặn
                            </Badge>
                          ) : (
                            <Badge className="gap-1 bg-green-600 text-white">
                              <ShieldCheck className="h-3 w-3" />Hoạt động
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {/* View device info */}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openDeviceDialog(user)}>
                              <Smartphone className="h-3 w-3" />Thiết bị
                            </Button>
                            {/* Security logs */}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openSecurityLogs(user)}>
                              <History className="h-3 w-3" />Log
                            </Button>
                            {/* Block/Unblock */}
                            {user.role !== 'admin' && (
                              blocked ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-green-500 text-green-600 hover:bg-green-50"
                                  onClick={() => {
                                    const fp = devices.find(d => blockedFingerprints.has(d.fingerprint_hash));
                                    setUnblockTarget({ fingerprint: fp?.fingerprint_hash || '', userId: user.id, userName: user.profile?.full_name || 'N/A' });
                                    setUnblockConfirmOpen(true);
                                  }}
                                >
                                  <ShieldCheck className="h-3 w-3" />Bỏ chặn
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    setBlockTarget({ userId: user.id, fingerprint: devices.length > 0 ? devices[0].fingerprint_hash : '', userName: user.profile?.full_name || 'N/A' });
                                    setBlockConfirmOpen(true);
                                  }}
                                >
                                  <ShieldBan className="h-3 w-3" />Chặn
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Device Info Dialog */}
      <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Thông tin thiết bị — {deviceDialogUser?.profile?.full_name}
            </DialogTitle>
            <DialogDescription>Chi tiết tất cả thiết bị đã đăng nhập</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {(deviceMap[deviceDialogUser?.id || ''] || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Chưa ghi nhận thiết bị nào</p>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {(deviceMap[deviceDialogUser?.id || ''] || []).map((dev, idx) => {
                  const ua = parseUA(dev.user_agent);
                  const isBlocked = blockedFingerprints.has(dev.fingerprint_hash);
                  return (
                    <div key={dev.id} className={`border rounded-lg p-3 space-y-2 ${isBlocked ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Thiết bị #{idx + 1}</span>
                        {isBlocked ? (
                          <Badge variant="destructive" className="text-xs gap-1"><ShieldBan className="h-3 w-3" />Đã chặn</Badge>
                        ) : (
                          <Badge className="text-xs gap-1 bg-green-600 text-white"><ShieldCheck className="h-3 w-3" />Hoạt động</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span><strong>Loại:</strong> {ua.device}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span><strong>Trình duyệt:</strong> {ua.browser}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span><strong>Hệ điều hành:</strong> {ua.os}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span><strong>IP:</strong> {dev.ip_address || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-full">
                          <Fingerprint className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate"><strong>Fingerprint:</strong> {dev.fingerprint_hash.substring(0, 16)}...</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-full">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span><strong>Lần cuối:</strong> {new Date(dev.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Security Logs Dialog */}
      <Dialog open={securityLogsOpen} onOpenChange={setSecurityLogsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Lịch sử bảo mật — {securityLogsUser?.profile?.full_name}
            </DialogTitle>
            <DialogDescription>Nhật ký đăng nhập và sự kiện bảo mật</DialogDescription>
          </DialogHeader>
          {securityLogsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : securityLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Chưa có lịch sử bảo mật</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-2">
                {securityLogs.map(log => {
                  const isSuccess = log.event_type === 'login_success';
                  const isBlocked = log.event_type === 'login_blocked' || log.event_type === 'device_blocked';
                  return (
                    <div key={log.id} className={`border rounded-lg p-3 space-y-1 ${isBlocked ? 'border-destructive/30 bg-destructive/5' : isSuccess ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' : ''}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge
                          variant={isBlocked ? 'destructive' : isSuccess ? 'default' : 'secondary'}
                          className={`text-xs ${isSuccess ? 'bg-green-600 text-white' : ''}`}
                        >
                          {eventTypeLabels[log.event_type] || log.event_type}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {log.ip_address && <p>IP: {log.ip_address}</p>}
                        {log.fingerprint_hash && <p>FP: {log.fingerprint_hash.substring(0, 16)}...</p>}
                        {log.risk_score !== null && log.risk_score > 0 && (
                          <p className="text-destructive">Điểm rủi ro: {log.risk_score}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Block Confirm */}
      <AlertDialog open={blockConfirmOpen} onOpenChange={(open) => { setBlockConfirmOpen(open); if (!open) setBlockReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldBan className="h-5 w-5 text-destructive" />
              Chặn người dùng & thiết bị
            </AlertDialogTitle>
            <AlertDialogDescription>
              Chặn <strong>{blockTarget?.userName}</strong>. {blockTarget?.fingerprint 
                ? 'Thiết bị hiện tại sẽ bị chặn ngay lập tức.' 
                : 'Chưa ghi nhận thiết bị — thiết bị sẽ tự động bị chặn khi họ đăng nhập lần tới.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium">Lý do chặn <span className="text-destructive">*</span></Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-none"
              placeholder="Nhập lý do chặn thiết bị..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockDevice} disabled={!blockReason.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Chặn thiết bị
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock Confirm */}
      <AlertDialog open={unblockConfirmOpen} onOpenChange={setUnblockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Bỏ chặn thiết bị
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn bỏ chặn thiết bị của <strong>{unblockTarget?.userName}</strong>? Người dùng sẽ có thể đăng nhập lại trên thiết bị này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblockDevice} className="bg-green-600 text-white hover:bg-green-700">
              Bỏ chặn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Support Requests Dialog */}
      <Dialog open={supportRequestsOpen} onOpenChange={setSupportRequestsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-primary" />
              Yêu cầu hỗ trợ thiết bị bị khóa
            </DialogTitle>
            <DialogDescription>Danh sách liên hệ từ người dùng bị khóa thiết bị</DialogDescription>
          </DialogHeader>
          {supportLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : supportRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Chưa có yêu cầu hỗ trợ nào</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-2">
                {supportRequests.map(req => (
                  <div
                    key={req.id}
                    className={`border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors ${req.status === 'pending' ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : ''}`}
                    onClick={() => { setSelectedSupport(req); setSupportAdminNote(req.admin_note || ''); setSupportDetailOpen(true); }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{req.email}</span>
                      </div>
                      <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'resolved' ? 'default' : 'destructive'} className="text-xs">
                        {req.status === 'pending' ? 'Chờ xử lý' : req.status === 'resolved' ? 'Đã xử lý' : 'Từ chối'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Phone className="h-3 w-3" />
                      <span>{req.phone}</span>
                      <span className="ml-auto">{new Date(req.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Support Detail Dialog */}
      <Dialog open={supportDetailOpen} onOpenChange={setSupportDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết yêu cầu hỗ trợ</DialogTitle>
          </DialogHeader>
          {selectedSupport && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Email:</strong> {selectedSupport.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span><strong>SĐT:</strong> {selectedSupport.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate"><strong>Fingerprint:</strong> {selectedSupport.fingerprint_hash?.substring(0, 20)}...</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Thời gian:</strong> {new Date(selectedSupport.created_at).toLocaleString('vi-VN')}</span>
                </div>
              </div>
              {selectedSupport.message && (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm">{selectedSupport.message}</p>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm">Ghi chú admin</Label>
                <Textarea
                  placeholder="Ghi chú phản hồi..."
                  value={supportAdminNote}
                  onChange={e => setSupportAdminNote(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
              {selectedSupport.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" onClick={() => handleSupportStatus(selectedSupport.id, 'rejected')}>
                    Từ chối
                  </Button>
                  <Button className="flex-1" onClick={() => handleSupportStatus(selectedSupport.id, 'resolved')}>
                    Đã xử lý
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

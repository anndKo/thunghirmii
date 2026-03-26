// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MediaPreviewDialog } from '@/components/MediaPreviewDialog';
import {
  Search, Loader2, Ban, UserCheck, Shield, Phone, User, AlertTriangle, Image,
} from 'lucide-react';

interface AccountUser {
  user_id: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  is_banned: boolean;
  ban_reason: string | null;
}

interface BanAppeal {
  id: string;
  user_id: string;
  email: string;
  phone: string;
  message: string | null;
  media_urls: string[] | null;
  status: string;
  created_at: string;
  full_name?: string;
}

interface AccountManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountManagementDialog({ open, onOpenChange }: AccountManagementDialogProps) {
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Appeals state
  const [showAppeals, setShowAppeals] = useState(false);
  const [appeals, setAppeals] = useState<BanAppeal[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<string[]>([]);
  const [mediaPreviewIndex, setMediaPreviewIndex] = useState(0);
  const mediaPreviewOpenRef = useRef(false);

  useEffect(() => {
    if (open) fetchAccounts();
  }, [open]);

  const fetchAccounts = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: bans }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, phone'),
      supabase.from('user_roles').select('user_id, role'),
      (supabase as any).from('banned_users').select('user_id, reason'),
    ]);

    if (profiles) {
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      const banMap = new Map((bans || []).map((b: any) => [b.user_id, b.reason]));

      const list: AccountUser[] = profiles.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        role: roleMap.get(p.user_id) || null,
        is_banned: banMap.has(p.user_id),
        ban_reason: (banMap.get(p.user_id) as string) || null,
      }));
      setAccounts(list);
    }
    setLoading(false);
  };

  const fetchAppeals = async () => {
    setAppealsLoading(true);
    const { data } = await (supabase as any).from('ban_appeals').select('*').order('created_at', { ascending: false });
    if (data) {
      const userIds = [...new Set(data.map((a: any) => a.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      setAppeals(data.map((a: any) => ({ ...a, full_name: nameMap.get(a.user_id) || 'Người dùng' })));
    }
    setAppealsLoading(false);
  };

  const handleBan = async () => {
    if (!selectedAccount || !banReason.trim()) {
      toast({ title: 'Vui lòng nhập lí do', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await (supabase as any).from('banned_users').insert({
      user_id: selectedAccount.user_id,
      reason: banReason.trim(),
      banned_by: session?.user?.id,
    });
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể cấm tài khoản', variant: 'destructive' });
    } else {
      toast({ title: 'Đã cấm tài khoản', description: selectedAccount.full_name });
      setBanDialogOpen(false);
      setBanReason('');
      setSelectedAccount(null);
      fetchAccounts();
    }
    setSubmitting(false);
  };

  const handleUnban = async (userId: string) => {
    const { error } = await (supabase as any).from('banned_users').delete().eq('user_id', userId);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể gỡ cấm', variant: 'destructive' });
    } else {
      toast({ title: 'Đã gỡ cấm' });
      fetchAccounts();
      if (showAppeals) fetchAppeals();
    }
  };

  const filtered = accounts.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.full_name?.toLowerCase().includes(s) || a.phone?.includes(s);
  });

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'admin': return <Badge className="bg-accent text-accent-foreground text-xs">Admin</Badge>;
      case 'landlord': return <Badge className="bg-primary text-primary-foreground text-xs">Chủ trọ</Badge>;
      case 'tenant': return <Badge className="bg-secondary text-secondary-foreground text-xs">Người thuê</Badge>;
      default: return <Badge variant="outline" className="text-xs">N/A</Badge>;
    }
  };

  const isImageUrl = (url: string) => /\.(png|jpe?g|jfif|gif|webp|bmp|svg|tiff?)(\?.*)?$/i.test(url);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" onPointerDownOutside={(e) => { if (mediaPreviewOpenRef.current) e.preventDefault(); }} onInteractOutside={(e) => { if (mediaPreviewOpenRef.current) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (mediaPreviewOpenRef.current) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Quản lí tài khoản
            </DialogTitle>
          </DialogHeader>

          {/* Toggle between accounts and appeals */}
          <div className="flex gap-2">
            <Button
              variant={!showAppeals ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setShowAppeals(false)}
            >
              <User className="h-3.5 w-3.5 mr-1" />
              Tài khoản
            </Button>
            <Button
              variant={showAppeals ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => { setShowAppeals(true); fetchAppeals(); }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Kháng nghị
            </Button>
          </div>

          {!showAppeals ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Tìm theo tên, SĐT..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>

              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <ScrollArea className="flex-1 max-h-[55vh] pr-2">
                  <div className="space-y-2">
                    {filtered.map(account => (
                      <div key={account.user_id} className={`p-3 rounded-lg border transition-colors ${account.is_banned ? 'border-destructive/30 bg-destructive/5' : 'border-border hover:bg-muted/50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-sm truncate">{account.full_name || 'Chưa đặt tên'}</span>
                              {getRoleBadge(account.role)}
                              {account.is_banned && <Badge variant="destructive" className="text-xs gap-1"><Ban className="h-3 w-3" />Đã cấm</Badge>}
                            </div>
                            {account.phone && <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{account.phone}</div>}
                            {account.is_banned && account.ban_reason && <p className="text-xs text-destructive mt-1">Lí do: {account.ban_reason}</p>}
                          </div>
                          <div className="flex-shrink-0">
                            {account.role === 'admin' ? null : account.is_banned ? (
                              <Button size="sm" variant="outline" onClick={() => handleUnban(account.user_id)} className="text-xs gap-1"><UserCheck className="h-3 w-3" />Gỡ cấm</Button>
                            ) : (
                              <Button size="sm" variant="destructive" onClick={() => { setSelectedAccount(account); setBanReason(''); setBanDialogOpen(true); }} className="text-xs gap-1"><Ban className="h-3 w-3" />Cấm</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Không tìm thấy tài khoản</p>}
                  </div>
                </ScrollArea>
              )}
              <p className="text-xs text-muted-foreground text-center">Tổng: {filtered.length} tài khoản</p>
            </>
          ) : (
            <>
              {appealsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : appeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">Chưa có kháng nghị nào</p>
                </div>
              ) : (
                <ScrollArea className="flex-1 max-h-[55vh] pr-2">
                  <div className="space-y-3">
                    {appeals.map(appeal => (
                      <div key={appeal.id} className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{appeal.full_name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span>{appeal.email}</span>
                              <span>•</span>
                              <span>{appeal.phone}</span>
                            </div>
                            {appeal.message && <p className="text-sm mt-2 bg-muted/50 p-2 rounded">{appeal.message}</p>}
                            {appeal.media_urls && appeal.media_urls.length > 0 && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {appeal.media_urls.map((url, idx) => (
                                  <button key={idx} onClick={() => { mediaPreviewOpenRef.current = true; setMediaPreviewUrls(appeal.media_urls!); setMediaPreviewIndex(idx); }} className="block">
                                    {isImageUrl(url) ? (
                                      <img src={url} alt="" className="h-14 w-14 object-cover rounded border" />
                                    ) : (
                                      <div className="h-14 w-14 rounded border bg-muted flex items-center justify-center"><Image className="h-5 w-5 text-muted-foreground" /></div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-2">{new Date(appeal.created_at).toLocaleString('vi-VN')}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleUnban(appeal.user_id)} className="text-xs gap-1 shrink-0">
                            <UserCheck className="h-3 w-3" />Gỡ cấm
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <p className="text-xs text-muted-foreground text-center">Tổng: {appeals.length} kháng nghị</p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><Ban className="h-5 w-5" />Cấm tài khoản</AlertDialogTitle>
            <AlertDialogDescription>Tài khoản <strong>{selectedAccount?.full_name}</strong> sẽ không thể đăng nhập hoặc đăng ký lại.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Nhập lí do cấm tài khoản..." value={banReason} onChange={e => setBanReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleBan} disabled={submitting || !banReason.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Xác nhận cấm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaPreviewDialog
        open={mediaPreviewUrls.length > 0}
        onOpenChange={(open) => { if (!open) { setMediaPreviewUrls([]); setMediaPreviewIndex(0); setTimeout(() => { mediaPreviewOpenRef.current = false; }, 300); } }}
        urls={mediaPreviewUrls}
        initialIndex={mediaPreviewIndex}
        type="image"
      />
    </>
  );
}

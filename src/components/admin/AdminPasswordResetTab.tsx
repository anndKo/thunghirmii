// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, CheckCircle, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AdminPasswordResetTab() {
  const { toast } = useToast();
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const fetchResetRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('password_reset_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setResetRequests(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchResetRequests(); }, [fetchResetRequests]);

  const completeResetRequest = async (id: string) => {
    const { error } = await (supabase as any)
      .from('password_reset_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật', variant: 'destructive' });
    } else {
      toast({ title: 'Đã hoàn thành yêu cầu' });
      fetchResetRequests();
    }
  };

  const handleResetPassword = async () => {
    if (!resetNewPassword || resetNewPassword.length < 6) {
      toast({ title: 'Lỗi', description: 'Mật khẩu phải có ít nhất 6 ký tự', variant: 'destructive' });
      return;
    }
    setResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email: resetEmail, newPassword: resetNewPassword }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      toast({ title: 'Thành công', description: `Đã đặt lại mật khẩu cho ${resetEmail}` });
      setResetDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Không thể đặt lại mật khẩu', variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  const pendingCount = resetRequests.filter(r => r.status === 'pending').length;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (resetRequests.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Chưa có yêu cầu lấy lại mật khẩu nào.</CardContent></Card>;
  }

  return (
    <>
      <div className="space-y-4">
        {resetRequests.map((req) => (
          <Card key={req.id}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{req.email}</CardTitle>
                  <CardDescription>SĐT: {req.phone} | {new Date(req.created_at).toLocaleString('vi-VN')}</CardDescription>
                </div>
                {req.status === 'pending' ? (
                  <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Đang chờ</Badge>
                ) : (
                  <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Đã hoàn thành</Badge>
                )}
              </div>
            </CardHeader>
            {req.status === 'pending' && (
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setResetEmail(req.email); setResetNewPassword(''); setResetDialogOpen(true); }}>
                    <KeyRound className="h-4 w-4 mr-1" />Đặt lại mật khẩu
                  </Button>
                  <Button size="sm" onClick={() => completeResetRequest(req.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" />Hoàn thành
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
            <DialogDescription>Đặt mật khẩu mới cho tài khoản: {resetEmail}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mật khẩu mới</Label>
              <Input type="text" placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đặt lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

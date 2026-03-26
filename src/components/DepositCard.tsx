// @ts-nocheck
import { useState, useRef } from 'react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Landmark, Loader2, Upload, CheckCircle, XCircle, ImageIcon, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QrFullscreenDialog } from '@/components/QrFullscreenDialog';

interface DepositPayment {
  id: string;
  sender_id: string;
  receiver_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  amount: number | null;
  transfer_content: string | null;
  status: string;
  receipt_url: string | null;
  qr_url?: string | null;
  type: string;
}

interface DepositCardProps {
  payment: DepositPayment;
  onRefresh?: () => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export function DepositCard({ payment, onRefresh }: DepositCardProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [billViewOpen, setBillViewOpen] = useState(false);
  const [qrFullscreenOpen, setQrFullscreenOpen] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState('');
  const billInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'admin';
  const isReceiver = user?.id === payment.receiver_id;

  const handleUploadBill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `receipts/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('room-media').upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('room-media').getPublicUrl(path);
      await supabase.from('payment_requests').update({ status: 'paid', receipt_url: data.publicUrl }).eq('id', payment.id);
      toast({ title: 'Đã gửi bill thanh toán!' });
      setUploadDialogOpen(false);
      onRefresh?.();
      await sendDepositNotification('admin', 'Người thuê đã gửi bill thanh toán cọc');
    } catch {
      toast({ title: 'Lỗi tải ảnh bill', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const sendDepositNotification = async (targetRole: string, content: string) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) return;
    await supabase.from('notifications').insert({
      title: 'Thông báo tiền cọc',
      content,
      target_role: targetRole,
      created_by: session.session.user.id,
    });
  };

  const handleReject = async () => {
    setUpdating(true);
    await supabase.from('payment_requests').update({ status: 'cancelled' }).eq('id', payment.id);
    setUpdating(false);
    toast({ title: 'Đã từ chối đóng cọc' });
    onRefresh?.();
    await sendDepositNotification('admin', 'Người thuê đã từ chối đóng cọc');
  };

  const handleAdminReview = async (approved: boolean) => {
    setUpdating(true);
    await supabase.from('payment_requests').update({ status: approved ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() }).eq('id', payment.id);
    setUpdating(false);
    toast({ title: approved ? 'Đã xác nhận thanh toán cọc' : 'Đã từ chối thanh toán cọc' });
    onRefresh?.();
    const msg = approved ? 'Admin đã xác nhận thanh toán cọc của bạn' : 'Admin đã từ chối thanh toán cọc của bạn';
    await sendDepositNotification('tenant', msg);
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    cancelled: 'bg-muted text-muted-foreground',
  };

  const statusLabel: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã gửi bill',
    approved: 'Đã xác nhận',
    rejected: 'Từ chối',
    cancelled: 'Đã huỷ',
  };

  return (
    <>
      <Card className="border-2 border-orange-400/60 shadow-lg bg-gradient-to-br from-orange-50 via-background to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 w-full overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-orange-500" />
            Hộp đóng cọc trọ
            <Badge className={cn('ml-auto text-xs', statusColor[payment.status] ?? '')}>{statusLabel[payment.status] ?? payment.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 break-words p-3" style={{ overflow: 'hidden', overflowWrap: 'anywhere' }}>
          {payment.amount !== null && (
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(payment.amount)}</p>
          )}
          {payment.transfer_content && (
            <p><span className="text-muted-foreground">Nội dung CK:</span> {payment.transfer_content}</p>
          )}
          <p><span className="text-muted-foreground">Ngân hàng:</span> {payment.bank_name}</p>
          <p><span className="text-muted-foreground">STK:</span> {payment.account_number}</p>
          <p><span className="text-muted-foreground">Chủ TK:</span> {payment.account_holder}</p>

          {payment.qr_url && (
            <div className="mt-2">
              <p className="text-muted-foreground text-xs mb-1">Mã QR:</p>
              <button onClick={() => { setFullscreenImageUrl(payment.qr_url!); setQrFullscreenOpen(true); }} className="cursor-pointer">
                <img src={payment.qr_url} alt="QR" className="max-h-32 rounded border hover:opacity-80 transition-opacity" />
              </button>
            </div>
          )}

          {/* Receipt/bill preview - admin sees button only */}
          {payment.receipt_url && (
            isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1"
                onClick={() => { setFullscreenImageUrl(payment.receipt_url!); setBillViewOpen(true); }}
              >
                <Eye className="h-4 w-4" />
                Xem bill
              </Button>
            ) : (
              <div className="mt-2">
                <p className="text-muted-foreground text-xs mb-1">Bill thanh toán:</p>
                <button onClick={() => { setFullscreenImageUrl(payment.receipt_url!); setBillViewOpen(true); }} className="cursor-pointer">
                  <img src={payment.receipt_url} alt="Bill" className="max-h-40 rounded border hover:opacity-80 transition-opacity" />
                </button>
              </div>
            )
          )}

          {/* Tenant actions: confirm or reject */}
          {isReceiver && payment.status === 'pending' && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={() => setUploadDialogOpen(true)} disabled={uploading || updating} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-1" />Xác nhận thanh toán
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={uploading || updating}>
                <XCircle className="h-4 w-4 mr-1" />Từ chối
              </Button>
            </div>
          )}

          {/* Admin: view bill + approve/reject */}
          {isAdmin && payment.status === 'paid' && (
            <div className="flex flex-wrap gap-2 mt-3">
              {payment.receipt_url && (
                <Button size="sm" variant="outline" onClick={() => { setFullscreenImageUrl(payment.receipt_url!); setBillViewOpen(true); }}>
                  <Eye className="h-4 w-4 mr-1" />Xem bill
                </Button>
              )}
              <Button size="sm" onClick={() => handleAdminReview(true)} disabled={updating} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-1" />Đã nhận
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleAdminReview(false)} disabled={updating}>
                <XCircle className="h-4 w-4 mr-1" />Từ chối
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload bill dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-orange-500" />Xác nhận thanh toán cọc</DialogTitle>
            <DialogDescription>Tải ảnh bill chuyển khoản để xác nhận đã thanh toán.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {payment.amount !== null && (
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-muted-foreground text-sm">Số tiền cọc</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(payment.amount)}</p>
              </div>
            )}
            <div className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center">
              <input ref={billInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadBill} />
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm mb-2">Tải ảnh bill chuyển khoản</p>
              <Button size="sm" onClick={() => billInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Chọn ảnh & Gửi bill
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill fullscreen viewer */}
      <QrFullscreenDialog open={billViewOpen} onOpenChange={setBillViewOpen} imageUrl={fullscreenImageUrl} />
      <QrFullscreenDialog open={qrFullscreenOpen} onOpenChange={setQrFullscreenOpen} imageUrl={fullscreenImageUrl} />
    </>
  );
}

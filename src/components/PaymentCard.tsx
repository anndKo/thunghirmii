// @ts-nocheck
import { useState, useRef } from 'react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  CreditCard,
  Loader2,
  Upload,
  CheckCircle,
  XCircle,
  MessageCircle,
  ImageIcon,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QrFullscreenDialog } from '@/components/QrFullscreenDialog';

interface PaymentRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  due_day: number;
  amount: number | null;
  note: string | null;
  status: string;
  receipt_url: string | null;
  qr_url?: string | null;
}

interface PaymentCardProps {
  payment: PaymentRequest;
  onRefresh?: () => void;
  onConsult?: () => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export function PaymentCard({ payment, onRefresh, onConsult }: PaymentCardProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [payDetailOpen, setPayDetailOpen] = useState(false);
  const [qrFullscreenOpen, setQrFullscreenOpen] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const detailInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'admin';
  const isReceiver = user?.id === payment.receiver_id;

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `receipts/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('room-media')
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('room-media').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      await supabase
        .from('payment_requests')
        .update({ status: 'paid', receipt_url: publicUrl })
        .eq('id', payment.id);

      toast({ title: 'Đã gửi biên lai!' });
      setPayDetailOpen(false);
      onRefresh?.();
      // Notify admin about bill upload
      await sendPaymentNotification('admin', `Người thuê đã gửi biên lai thanh toán`);
    } catch (err) {
      console.error(err);
      toast({ title: 'Lỗi tải ảnh biên lai', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const sendPaymentNotification = async (targetRole: string, content: string) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) return;
    await supabase.from('notifications').insert({
      title: 'Thông báo thanh toán',
      content,
      target_role: targetRole,
      created_by: session.session.user.id,
    });
  };

  const handleCancel = async () => {
    setUpdating(true);
    await supabase.from('payment_requests').update({ status: 'cancelled' }).eq('id', payment.id);
    setUpdating(false);
    toast({ title: 'Đã huỷ thanh toán' });
    onRefresh?.();
    await sendPaymentNotification('admin', 'Người thuê đã huỷ hộp thanh toán');
  };

  const handleAdminReview = async (approved: boolean) => {
    setUpdating(true);
    await supabase
      .from('payment_requests')
      .update({ status: approved ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', payment.id);
    setUpdating(false);
    toast({ title: approved ? 'Đã xác nhận thanh toán' : 'Đã từ chối thanh toán' });
    onRefresh?.();
    const msg = approved ? 'Admin đã xác nhận thanh toán của bạn' : 'Admin đã từ chối thanh toán của bạn';
    await sendPaymentNotification('tenant', msg);
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-muted text-muted-foreground',
  };

  const statusLabel: Record<string, string> = {
    pending: 'Chờ thanh toán',
    paid: 'Chờ xác nhận',
    approved: 'Đã xác nhận',
    rejected: 'Từ chối',
    cancelled: 'Đã huỷ',
  };

  return (
    <>
      <Card className="border-2 border-primary/50 shadow-lg bg-gradient-to-br from-primary/5 via-background to-accent/10 w-full overflow-hidden" style={{ maxWidth: '100%', minWidth: 0 }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            Hộp thanh toán
            <Badge className={cn('ml-auto text-xs', statusColor[payment.status] ?? '')}>
              {statusLabel[payment.status] ?? payment.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 break-words p-3" style={{ overflow: 'hidden', overflowWrap: 'anywhere' }}>
          <p>
            <span className="text-muted-foreground">Ngân hàng:</span> {payment.bank_name}
          </p>
          <p>
            <span className="text-muted-foreground">STK:</span> {payment.account_number}
          </p>
          <p>
            <span className="text-muted-foreground">Chủ TK:</span> {payment.account_holder}
          </p>
          <p>
            <span className="text-muted-foreground">Ngày thanh toán:</span> {payment.due_day} hàng tháng
          </p>
          {payment.amount !== null && (
            <p>
              <span className="text-muted-foreground">Số tiền:</span> {formatCurrency(payment.amount)}
            </p>
          )}
          {payment.note && (
            <p>
              <span className="text-muted-foreground">Ghi chú:</span> {payment.note}
            </p>
          )}

          {/* QR code preview */}
          {payment.qr_url && (
            <div className="mt-2">
              <p className="text-muted-foreground text-xs mb-1">Mã QR:</p>
              <button
                type="button"
                onClick={() => { setFullscreenImageUrl(payment.qr_url!); setQrFullscreenOpen(true); }}
                className="cursor-pointer"
              >
                <img src={payment.qr_url} alt="QR" className="max-h-32 rounded border hover:opacity-80 transition-opacity" />
              </button>
            </div>
          )}

          {/* Receipt preview - admin sees button, tenant sees thumbnail */}
          {payment.receipt_url && (
            isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1"
                onClick={() => { setFullscreenImageUrl(payment.receipt_url!); setQrFullscreenOpen(true); }}
              >
                <Eye className="h-4 w-4" />
                Xem bill
              </Button>
            ) : (
              <div className="mt-2">
                <p className="text-muted-foreground text-xs mb-1">Biên lai:</p>
                <button
                  type="button"
                  onClick={() => { setFullscreenImageUrl(payment.receipt_url!); setQrFullscreenOpen(true); }}
                  className="cursor-pointer"
                >
                  <img src={payment.receipt_url} alt="Biên lai" className="max-h-40 rounded border hover:opacity-80 transition-opacity" />
                </button>
              </div>
            )
          )}

          {/* Receiver actions */}
          {isReceiver && payment.status === 'pending' && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => setPayDetailOpen(true)}
                disabled={uploading || updating}
              >
                <Upload className="h-4 w-4 mr-1" />
                Thanh toán
              </Button>
              <Button size="sm" variant="destructive" onClick={handleCancel} disabled={uploading || updating}>
                Huỷ
              </Button>
              <Button size="sm" variant="outline" onClick={onConsult} disabled={uploading || updating}>
                <MessageCircle className="h-4 w-4 mr-1" />
                Tư vấn thêm
              </Button>
            </div>
          )}

          {/* Admin review actions */}
          {isAdmin && payment.status === 'paid' && (
            <div className="flex flex-wrap gap-2 mt-3">
              {payment.receipt_url && (
                <Button size="sm" variant="outline" onClick={() => { setFullscreenImageUrl(payment.receipt_url!); setQrFullscreenOpen(true); }}>
                  <Eye className="h-4 w-4 mr-1" />Xem bill
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleAdminReview(true)}
                disabled={updating}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Đã nhận
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAdminReview(false)}
                disabled={updating}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Từ chối
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment detail dialog - shows full info + upload bill */}
      <Dialog open={payDetailOpen} onOpenChange={setPayDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Chi tiết thanh toán
            </DialogTitle>
            <DialogDescription>Kiểm tra thông tin và tải biên lai lên</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p><span className="text-muted-foreground">Ngân hàng:</span> <strong>{payment.bank_name}</strong></p>
              <p><span className="text-muted-foreground">Số tài khoản:</span> <strong>{payment.account_number}</strong></p>
              <p><span className="text-muted-foreground">Chủ tài khoản:</span> <strong>{payment.account_holder}</strong></p>
              <p><span className="text-muted-foreground">Ngày thanh toán:</span> <strong>{payment.due_day} hàng tháng</strong></p>
              {payment.amount !== null && (
                <p><span className="text-muted-foreground">Số tiền:</span> <strong className="text-primary">{formatCurrency(payment.amount)}</strong></p>
              )}
              {payment.note && (
                <p><span className="text-muted-foreground">Ghi chú:</span> {payment.note}</p>
              )}
            </div>
            {payment.qr_url && (
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-2">Quét mã QR để chuyển khoản:</p>
                <img src={payment.qr_url} alt="QR" className="max-h-48 mx-auto rounded border" />
              </div>
            )}
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center">
              <input
                ref={detailInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadReceipt}
              />
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm mb-2">Tải ảnh biên lai chuyển khoản</p>
              <Button
                size="sm"
                onClick={() => detailInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Chọn ảnh & Gửi
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDetailOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Fullscreen */}
      <QrFullscreenDialog
        open={qrFullscreenOpen}
        onOpenChange={setQrFullscreenOpen}
        imageUrl={fullscreenImageUrl}
      />
    </>
  );
}

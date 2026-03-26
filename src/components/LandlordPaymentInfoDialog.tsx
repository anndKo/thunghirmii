import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard } from 'lucide-react';
import { sanitizeInput, checkRateLimit } from '@/lib/validation';

interface LandlordPaymentInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LandlordPaymentInfoDialog({ open, onOpenChange }: LandlordPaymentInfoDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder: '',
  });

  useEffect(() => {
    if (open && user) fetchPaymentInfo();
  }, [open, user]);

  const fetchPaymentInfo = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await (supabase
      .from('landlord_payment_info' as any)
      .select('bank_name, account_number, account_holder')
      .eq('user_id', user.id)
      .maybeSingle() as any);

    if (data) {
      setFormData({
        bank_name: data.bank_name || '',
        account_number: data.account_number || '',
        account_holder: data.account_holder || '',
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    // Rate limit
    if (!checkRateLimit(`landlord_payment_save_${user.id}`, 10, 60000)) {
      toast({ title: 'Lỗi', description: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.', variant: 'destructive' });
      return;
    }

    // Sanitize
    const cleanBank = sanitizeInput(formData.bank_name);
    const cleanAccount = sanitizeInput(formData.account_number);
    const cleanHolder = sanitizeInput(formData.account_holder);

    // Validate
    if (cleanAccount && !/^[0-9]*$/.test(cleanAccount)) {
      toast({ title: 'Lỗi', description: 'Số tài khoản chỉ được chứa số.', variant: 'destructive' });
      return;
    }

    if (cleanBank.length > 100 || cleanAccount.length > 30 || cleanHolder.length > 100) {
      toast({ title: 'Lỗi', description: 'Dữ liệu vượt quá giới hạn cho phép.', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const { error } = await (supabase
      .from('landlord_payment_info' as any)
      .upsert({
        user_id: user.id,
        bank_name: cleanBank,
        account_number: cleanAccount,
        account_holder: cleanHolder,
      }, { onConflict: 'user_id' }) as any);

    setSaving(false);

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể lưu thông tin thanh toán.', variant: 'destructive' });
    } else {
      toast({ title: 'Đã lưu!', description: 'Thông tin thanh toán đã được cập nhật.' });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Thông tin thanh toán
          </DialogTitle>
          <DialogDescription>
            Nhập thông tin ngân hàng để nhận thanh toán từ người thuê
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên ngân hàng</Label>
              <Input value={formData.bank_name} maxLength={100}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="VD: Vietcombank, MB Bank..." />
            </div>
            <div className="space-y-2">
              <Label>Số tài khoản</Label>
              <Input value={formData.account_number} maxLength={30}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value.replace(/\D/g, '') })}
                placeholder="Nhập số tài khoản" />
            </div>
            <div className="space-y-2">
              <Label>Tên tài khoản</Label>
              <Input value={formData.account_holder} maxLength={100}
                onChange={(e) => setFormData({ ...formData, account_holder: e.target.value.toUpperCase() })}
                placeholder="NGUYEN VAN A" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
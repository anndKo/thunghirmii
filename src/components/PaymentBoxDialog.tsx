// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceInput } from '@/components/PriceInput';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, CreditCard, Upload, X, Save } from 'lucide-react';
import { sanitizeInput, validateFileUpload, checkRateLimit } from '@/lib/validation';

interface PaymentBoxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: string;
  senderId: string;
  onSuccess?: (paymentId: string) => void;
}

const SAVED_PAYMENT_INFO_KEY = 'admin_saved_payment_info';

interface SavedPaymentInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  dueDay: string;
  qrUrl?: string;
}

export function PaymentBoxDialog({
  open, onOpenChange, receiverId, senderId, onSuccess,
}: PaymentBoxDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [savedQrUrl, setSavedQrUrl] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem(SAVED_PAYMENT_INFO_KEY);
        if (saved) {
          const info: SavedPaymentInfo = JSON.parse(saved);
          setBankName(info.bankName || '');
          setAccountNumber(info.accountNumber || '');
          setAccountHolder(info.accountHolder || '');
          setDueDay(info.dueDay || '');
          if (info.qrUrl) {
            setSavedQrUrl(info.qrUrl);
            setQrPreview(info.qrUrl);
          }
        }
      } catch {}
    }
  }, [open]);

  const resetForm = () => {
    setBankName(''); setAccountNumber(''); setAccountHolder('');
    setDueDay(''); setAmount(''); setNote('');
    setQrFile(null); setQrPreview(null); setSavedQrUrl(null);
  };

  const handleSaveInfo = () => {
    const info: SavedPaymentInfo = {
      bankName: sanitizeInput(bankName),
      accountNumber: sanitizeInput(accountNumber),
      accountHolder: sanitizeInput(accountHolder),
      dueDay: sanitizeInput(dueDay),
    };
    if (savedQrUrl) info.qrUrl = savedQrUrl;
    localStorage.setItem(SAVED_PAYMENT_INFO_KEY, JSON.stringify(info));
    toast({ title: t('paymentBoxSaved') });
  };

  const handleQrSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateFileUpload(file);
    if (!validation.valid) {
      toast({ title: t('error'), description: validation.error, variant: 'destructive' });
      return;
    }

    setQrFile(file);
    const reader = new FileReader();
    reader.onload = () => setQrPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    // Rate limit check
    if (!checkRateLimit(`payment_submit_${senderId}`, 5, 60000)) {
      toast({ title: t('error'), description: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.', variant: 'destructive' });
      return;
    }

    // Verify auth
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id || session.session.user.id !== senderId) {
      toast({ title: t('error'), description: 'Phiên đăng nhập không hợp lệ.', variant: 'destructive' });
      return;
    }

    // Sanitize inputs
    const cleanBank = sanitizeInput(bankName);
    const cleanAccount = sanitizeInput(accountNumber);
    const cleanHolder = sanitizeInput(accountHolder);
    const cleanDueDay = sanitizeInput(dueDay);
    const cleanNote = sanitizeInput(note);

    if (!cleanBank || !cleanAccount || !cleanHolder || !cleanDueDay) {
      toast({ title: t('paymentBoxMissing'), description: t('paymentBoxMissingDesc'), variant: 'destructive' });
      return;
    }

    // Validate account number - only digits
    if (!/^[0-9]+$/.test(cleanAccount)) {
      toast({ title: t('error'), description: 'Số tài khoản chỉ được chứa số.', variant: 'destructive' });
      return;
    }

    // Validate bank name length
    if (cleanBank.length > 100 || cleanAccount.length > 30 || cleanHolder.length > 100) {
      toast({ title: t('error'), description: 'Dữ liệu vượt quá giới hạn cho phép.', variant: 'destructive' });
      return;
    }

    const dueDayNum = parseInt(cleanDueDay, 10);
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      toast({ title: t('paymentBoxInvalidDay'), description: t('paymentBoxInvalidDayDesc'), variant: 'destructive' });
      return;
    }

    if (cleanNote && cleanNote.length > 1000) {
      toast({ title: t('error'), description: 'Ghi chú không được quá 1000 ký tự.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    let qrUrl: string | null = savedQrUrl;
    if (qrFile) {
      const ext = (qrFile.name.split('.').pop() || 'png').toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        toast({ title: t('error'), description: 'Định dạng file không hợp lệ.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const path = `qr/${senderId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('room-media')
        .upload(path, qrFile, { contentType: qrFile.type });
      if (!uploadErr) {
        const { data } = supabase.storage.from('room-media').getPublicUrl(path);
        qrUrl = data.publicUrl;
        try {
          const saved = localStorage.getItem(SAVED_PAYMENT_INFO_KEY);
          if (saved) {
            const info = JSON.parse(saved);
            info.qrUrl = qrUrl;
            localStorage.setItem(SAVED_PAYMENT_INFO_KEY, JSON.stringify(info));
          }
        } catch {}
      }
    }

    const { data, error } = await supabase
      .from('payment_requests')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        bank_name: cleanBank,
        account_number: cleanAccount,
        account_holder: cleanHolder,
        due_day: dueDayNum,
        amount: amount ? parseFloat(amount) : null,
        note: cleanNote || null,
        qr_url: qrUrl,
      })
      .select('id')
      .single();

    setLoading(false);

    if (error) {
      toast({ title: t('error'), description: t('paymentBoxError'), variant: 'destructive' });
      return;
    }

    toast({ title: t('paymentBoxSuccess') });
    if (session?.session?.user?.id) {
      await supabase.from('notifications').insert({
        title: t('paymentBoxNotifTitle'),
        content: t('paymentBoxNotifContent'),
        target_role: 'tenant',
        created_by: session.session.user.id,
      });
    }
    resetForm();
    onOpenChange(false);
    onSuccess?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t('paymentBoxTitle')}
          </DialogTitle>
          <DialogDescription>{t('paymentBoxDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>{t('paymentBoxBankName')}</Label>
            <Input placeholder="VD: Vietcombank" value={bankName} maxLength={100}
              onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('paymentBoxAccountNumber')}</Label>
            <Input placeholder="VD: 123456789012" value={accountNumber} maxLength={30}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="space-y-2">
            <Label>{t('paymentBoxAccountHolder')}</Label>
            <Input placeholder="VD: NGUYEN VAN A" value={accountHolder} maxLength={100}
              onChange={(e) => setAccountHolder(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label>{t('paymentBoxDueDay')}</Label>
            <Input type="number" min={1} max={31}
              placeholder={t('paymentBoxDueDayPlaceholder')}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)} />
          </div>
          <PriceInput value={amount} onChange={setAmount}
            label={t('paymentBoxAmount')} placeholder="3.000.000" />
          <div className="space-y-2">
            <Label>{t('paymentBoxNote')}</Label>
            <Textarea placeholder={t('paymentBoxNotePlaceholder')} value={note}
              onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
          </div>
          <div className="space-y-2">
            <Label>{t('paymentBoxQrLabel')}</Label>
            <input ref={qrInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden" onChange={handleQrSelect} />
            {qrPreview ? (
              <div className="relative inline-block">
                <img src={qrPreview} alt="QR preview" className="max-h-32 rounded border" />
                <Button type="button" variant="ghost" size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full"
                  onClick={() => { setQrFile(null); setQrPreview(null); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm"
                onClick={() => qrInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />{t('paymentBoxUploadQr')}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={handleSaveInfo} disabled={loading} className="gap-1">
            <Save className="h-4 w-4" />{t('paymentBoxSaveInfo')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{t('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-primary">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('paymentBoxSubmit')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceInput } from '@/components/PriceInput';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Landmark, Upload, X } from 'lucide-react';
import { sanitizeInput, validateFileUpload, checkRateLimit } from '@/lib/validation';

interface DepositBoxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: string;
  senderId: string;
  onSuccess?: (paymentId: string) => void;
}

const SAVED_PAYMENT_INFO_KEY = 'admin_saved_payment_info';

export function DepositBoxDialog({ open, onOpenChange, receiverId, senderId, onSuccess }: DepositBoxDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [amount, setAmount] = useState('');
  const [transferContent, setTransferContent] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [savedQrUrl, setSavedQrUrl] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem(SAVED_PAYMENT_INFO_KEY);
        if (saved) {
          const info = JSON.parse(saved);
          setBankName(info.bankName || '');
          setAccountNumber(info.accountNumber || '');
          setAccountHolder(info.accountHolder || '');
          if (info.qrUrl) { setSavedQrUrl(info.qrUrl); setQrPreview(info.qrUrl); }
        }
      } catch {}
    }
  }, [open]);

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
    // Rate limit
    if (!checkRateLimit(`deposit_submit_${senderId}`, 5, 60000)) {
      toast({ title: t('error'), description: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.', variant: 'destructive' });
      return;
    }

    // Verify auth
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id || session.session.user.id !== senderId) {
      toast({ title: t('error'), description: 'Phiên đăng nhập không hợp lệ.', variant: 'destructive' });
      return;
    }

    // Sanitize
    const cleanBank = sanitizeInput(bankName);
    const cleanAccount = sanitizeInput(accountNumber);
    const cleanHolder = sanitizeInput(accountHolder);
    const cleanTransfer = sanitizeInput(transferContent);

    if (!cleanBank || !cleanAccount || !cleanHolder || !amount.trim()) {
      toast({ title: t('depositBoxMissing'), description: t('depositBoxMissingDesc'), variant: 'destructive' });
      return;
    }

    if (!/^[0-9]+$/.test(cleanAccount)) {
      toast({ title: t('error'), description: 'Số tài khoản chỉ được chứa số.', variant: 'destructive' });
      return;
    }

    if (cleanBank.length > 100 || cleanAccount.length > 30 || cleanHolder.length > 100) {
      toast({ title: t('error'), description: 'Dữ liệu vượt quá giới hạn cho phép.', variant: 'destructive' });
      return;
    }

    if (cleanTransfer && cleanTransfer.length > 500) {
      toast({ title: t('error'), description: 'Nội dung chuyển khoản không được quá 500 ký tự.', variant: 'destructive' });
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
      const { error: uploadErr } = await supabase.storage.from('room-media').upload(path, qrFile, { contentType: qrFile.type });
      if (!uploadErr) {
        const { data } = supabase.storage.from('room-media').getPublicUrl(path);
        qrUrl = data.publicUrl;
      }
    }

    const { data, error } = await supabase.from('payment_requests').insert({
      sender_id: senderId, receiver_id: receiverId,
      bank_name: cleanBank, account_number: cleanAccount,
      account_holder: cleanHolder, due_day: 1,
      amount: parseFloat(amount), note: null,
      transfer_content: cleanTransfer || null,
      qr_url: qrUrl, type: 'deposit',
    }).select('id').single();

    setLoading(false);
    if (error) {
      toast({ title: t('error'), description: t('depositBoxError'), variant: 'destructive' });
      return;
    }

    toast({ title: t('depositBoxSuccess') });
    if (session?.session?.user?.id) {
      await supabase.from('notifications').insert({
        title: t('depositBoxNotifTitle'),
        content: t('depositBoxNotifContent'),
        target_role: 'tenant',
        created_by: session.session.user.id,
      });
    }
    setAmount(''); setTransferContent(''); setQrFile(null);
    onOpenChange(false);
    onSuccess?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            {t('depositBoxTitle')}
          </DialogTitle>
          <DialogDescription>{t('depositBoxDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <PriceInput value={amount} onChange={setAmount} label={t('depositBoxAmount')} placeholder="3.000.000" />
          <div className="space-y-2">
            <Label>{t('depositBoxTransferContent')}</Label>
            <Input placeholder={t('depositBoxTransferPlaceholder')} value={transferContent} maxLength={500}
              onChange={(e) => setTransferContent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('depositBoxBankName')}</Label>
            <Input placeholder="VD: Vietcombank" value={bankName} maxLength={100}
              onChange={(e) => setBankName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('depositBoxAccountNumber')}</Label>
            <Input placeholder="VD: 123456789012" value={accountNumber} maxLength={30}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="space-y-2">
            <Label>{t('depositBoxAccountHolder')}</Label>
            <Input placeholder="VD: NGUYEN VAN A" value={accountHolder} maxLength={100}
              onChange={(e) => setAccountHolder(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label>{t('depositBoxQrLabel')}</Label>
            <input ref={qrInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden" onChange={handleQrSelect} />
            {qrPreview ? (
              <div className="relative inline-block">
                <img src={qrPreview} alt="QR" className="max-h-32 rounded border" />
                <Button type="button" variant="ghost" size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full"
                  onClick={() => { setQrFile(null); setQrPreview(null); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => qrInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />{t('depositBoxUploadQr')}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-primary">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('depositBoxSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
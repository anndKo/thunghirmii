import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, Mail, CheckCircle } from 'lucide-react';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !phone.trim()) {
      toast({ title: 'Vui lòng điền đầy đủ thông tin', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await (supabase as any)
      .from('password_reset_requests')
      .insert({ email: email.trim(), phone: phone.trim() });

    setIsLoading(false);

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể gửi yêu cầu. Vui lòng thử lại.', variant: 'destructive' });
    } else {
      setSubmitted(true);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setEmail('');
      setPhone('');
      setSubmitted(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quên mật khẩu</DialogTitle>
          <DialogDescription>
            Nhập thông tin để gửi yêu cầu lấy lại mật khẩu
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div className="space-y-2">
              <p className="font-semibold text-lg">Đã gửi yêu cầu thành công!</p>
              <p className="text-muted-foreground text-sm">
                Vui lòng chờ liên hệ từ nhân viên tư vấn qua số điện thoại <strong>{phone}</strong> mà bạn đã cung cấp.
              </p>
            </div>
            <Button onClick={() => handleClose(false)} className="mt-4">
              Đóng
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">
                <Mail className="inline h-4 w-4 mr-1" />
                Email đã đăng ký
              </Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-phone">
                <Phone className="inline h-4 w-4 mr-1" />
                Số điện thoại liên hệ
              </Label>
              <Input
                id="forgot-phone"
                type="tel"
                placeholder="0912 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gửi yêu cầu
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// @ts-nocheck
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PasswordChangeForm({ open, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const resetAndClose = () => {
    setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setShowOldPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    onClose();
  };

  const handleChangePassword = async () => {
    if (!pwForm.oldPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      toast({ title: t('error'), description: t('fillAllFields'), variant: 'destructive' });
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast({ title: t('error'), description: t('newPasswordMinLength'), variant: 'destructive' });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: t('error'), description: t('passwordMismatchError'), variant: 'destructive' });
      return;
    }

    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: pwForm.oldPassword,
      });
      if (signInError) {
        toast({ title: t('error'), description: t('wrongOldPassword'), variant: 'destructive' });
        setChangingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword });
      if (error) {
        toast({ title: t('error'), description: error.message, variant: 'destructive' });
      } else {
        toast({ title: t('success'), description: t('passwordChanged') });
        resetAndClose();
      }
    } catch (err) {
      console.error(err);
      toast({ title: t('error'), description: t('cannotChangePassword'), variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={resetAndClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          {t('changePassword')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto space-y-5">
          <div className="space-y-2">
            <Label>{t('oldPassword')}</Label>
            <div className="relative">
              <Input
                type={showOldPw ? 'text' : 'password'}
                value={pwForm.oldPassword}
                onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                placeholder={t('oldPasswordPlaceholder')}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowOldPw(!showOldPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showOldPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('newPassword')}</Label>
            <div className="relative">
              <Input
                type={showNewPw ? 'text' : 'password'}
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                placeholder={t('newPasswordPlaceholder')}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwForm.newPassword && pwForm.newPassword.length < 6 && (
              <p className="text-xs text-destructive">{t('passwordMinLengthError')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('confirmNewPassword')}</Label>
            <div className="relative">
              <Input
                type={showConfirmPw ? 'text' : 'password'}
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                placeholder={t('confirmPasswordPlaceholder')}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
              <p className="text-xs text-destructive">{t('passwordMismatch')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 py-4 border-t">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" className="flex-1" onClick={resetAndClose}>
            {t('cancel')}
          </Button>
          <Button
            className="flex-1"
            onClick={handleChangePassword}
            disabled={changingPassword || !pwForm.oldPassword || !pwForm.newPassword || !pwForm.confirmPassword || pwForm.newPassword !== pwForm.confirmPassword || pwForm.newPassword.length < 6}
          >
            {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('confirmChangePassword')}
          </Button>
        </div>
      </div>
    </div>
  );
}

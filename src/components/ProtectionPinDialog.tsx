// @ts-nocheck
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, ShieldCheck, ShieldX, MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProtectionPinDialog({ userId, onSuccess, onCancel }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(pin)) {
      toast({ title: t('error'), description: t('pinMust6Digits'), variant: 'destructive' });
      return;
    }

    setLoading(true);

    // Fetch protection record
    const { data: record } = await supabase
      .from('protection_passwords')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!record) {
      setLoading(false);
      onSuccess();
      return;
    }

    if (record.is_locked) {
      setLocked(true);
      setLoading(false);
      return;
    }

    // Verify PIN
    const pinHash = btoa(pin);
    if (pinHash === record.pin_hash) {
      // Success - reset fail count
      await supabase
        .from('protection_passwords')
        .update({ fail_count: 0 })
        .eq('id', record.id);
      setLoading(false);
      onSuccess();
    } else {
      // Failed
      const newFailCount = (record.fail_count || 0) + 1;
      const updates: any = { fail_count: newFailCount };
      
      if (newFailCount >= 5) {
        updates.is_locked = true;
        updates.locked_at = new Date().toISOString();
        setLocked(true);
        toast({ title: t('error'), description: t('protectionLockedMsg'), variant: 'destructive' });
      } else {
        toast({ 
          title: t('error'), 
          description: t('wrongProtectionPin', { remaining: 5 - newFailCount }),
          variant: 'destructive' 
        });
      }

      await supabase
        .from('protection_passwords')
        .update(updates)
        .eq('id', record.id);
      
      setPin('');
      setLoading(false);
    }
  };

  if (locked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
        <div className="w-full max-w-md bg-card border rounded-2xl p-8 shadow-xl space-y-6 text-center">
          <ShieldX className="h-16 w-16 text-destructive mx-auto animate-pulse" />
          <h2 className="text-xl font-bold text-destructive">{t('protectionLockedTitle')}</h2>
          <p className="text-muted-foreground text-sm">{t('protectionLockedMsg')}</p>
          
          {!showForgot ? (
            <div className="space-y-3">
              <Button variant="outline" className="w-full" onClick={() => setShowForgot(true)}>
                {t('forgotProtectionPin')}
              </Button>
              <Button variant="ghost" className="w-full" onClick={onCancel}>
                {t('cancel')}
              </Button>
            </div>
          ) : (
            <ForgotForm
              t={t}
              userId={userId}
              forgotEmail={forgotEmail}
              setForgotEmail={setForgotEmail}
              forgotPassword={forgotPassword}
              setForgotPassword={setForgotPassword}
              forgotPhone={forgotPhone}
              setForgotPhone={setForgotPhone}
              onBack={() => setShowForgot(false)}
              onRequestSent={onCancel}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
      <div className="w-full max-w-md bg-card border rounded-2xl p-8 shadow-xl space-y-6">
        <div className="text-center">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-3" />
          <h2 className="text-xl font-bold">{t('protectionPinRequired')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('enterProtectionPin')}</p>
        </div>

        {!showForgot ? (
          <>
            <div className="space-y-2">
              <Label>{t('protectionPin')}</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                autoFocus
              />
            </div>

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={loading || pin.length !== 6}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('confirm')}
            </Button>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm text-primary hover:underline"
              >
                {t('forgotProtectionPin')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-muted-foreground hover:underline"
              >
                {t('cancel')}
              </button>
            </div>
          </>
        ) : (
          <ForgotForm
            t={t}
            userId={userId}
            forgotEmail={forgotEmail}
            setForgotEmail={setForgotEmail}
            forgotPassword={forgotPassword}
            setForgotPassword={setForgotPassword}
            forgotPhone={forgotPhone}
            setForgotPhone={setForgotPhone}
            onBack={() => setShowForgot(false)}
            onRequestSent={onCancel}
          />
        )}
      </div>
    </div>
  );
}

function ForgotForm({ t, userId, forgotEmail, setForgotEmail, forgotPassword, setForgotPassword, forgotPhone, setForgotPhone, onBack, onRequestSent }) {
  const [requestMessage, setRequestMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmitRequest = async () => {
    if (!forgotEmail || !forgotPassword || !forgotPhone) {
      toast({ title: t('error'), description: t('fillAllFields'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    // Verify credentials first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: forgotEmail,
      password: forgotPassword,
    });

    if (signInError) {
      toast({ title: t('error'), description: t('invalidCredentials'), variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('pin_reset_requests')
      .insert({
        user_id: userId,
        email: forgotEmail,
        phone: forgotPhone,
        message: requestMessage || null,
      });

    if (error) {
      toast({ title: t('error'), description: t('cannotSave'), variant: 'destructive' });
    } else {
      toast({ title: t('success'), description: t('pinResetRequestSent') });
      if (onRequestSent) onRequestSent();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4 text-left">
      <h3 className="font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        {t('submitPinResetRequest')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('pinResetRequestDesc')}</p>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="email@example.com" />
      </div>
      <div className="space-y-2">
        <Label>{t('accountPassword')}</Label>
        <Input type="password" value={forgotPassword} onChange={e => setForgotPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="space-y-2">
        <Label>{t('phoneNumber')}</Label>
        <Input type="tel" value={forgotPhone} onChange={e => setForgotPhone(e.target.value)} placeholder="0901234567" />
      </div>
      <div className="space-y-2">
        <Label>{t('message')} ({t('optional')})</Label>
        <Textarea
          value={requestMessage}
          onChange={e => setRequestMessage(e.target.value)}
          placeholder={t('describeYourProblem')}
          rows={3}
        />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>{t('back')}</Button>
        <Button className="flex-1" onClick={handleSubmitRequest} disabled={submitting || !forgotEmail || !forgotPassword || !forgotPhone}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('submit')}
        </Button>
      </div>
    </div>
  );
}

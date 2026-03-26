// @ts-nocheck
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProtectionPasswordSetup({ open, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [existingRecord, setExistingRecord] = useState<any>(null);

  useEffect(() => {
    if (open && user) fetchData();
  }, [open, user]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('protection_passwords')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setExistingRecord(data);
      setEnabled(data.is_enabled);
      setPhone(data.phone);
    } else {
      setExistingRecord(null);
      setEnabled(false);
      setPhone('');
    }
    setPin('');
    setConfirmPin('');
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    // If disabling
    if (!enabled && existingRecord) {
      setSaving(true);
      await supabase.from('protection_passwords').delete().eq('user_id', user.id);
      setSaving(false);
      toast({ title: t('success'), description: t('protectionDisabled') });
      setExistingRecord(null);
      setPin('');
      setConfirmPin('');
      return;
    }

    // Validate
    if (!phone.trim()) {
      toast({ title: t('error'), description: t('phoneRequired'), variant: 'destructive' });
      return;
    }

    if (!existingRecord || pin) {
      // Need to set/update PIN
      if (!/^\d{6}$/.test(pin)) {
        toast({ title: t('error'), description: t('pinMust6Digits'), variant: 'destructive' });
        return;
      }
      if (pin !== confirmPin) {
        toast({ title: t('error'), description: t('pinMismatch'), variant: 'destructive' });
        return;
      }
    }

    setSaving(true);

    const payload: any = {
      user_id: user.id,
      phone: phone.trim(),
      is_enabled: true,
    };

    // Store PIN as simple hash (in production, use bcrypt via edge function)
    if (!existingRecord || pin) {
      payload.pin_hash = btoa(pin); // Base64 encode for basic obfuscation
    }

    if (existingRecord) {
      const { error } = await supabase
        .from('protection_passwords')
        .update(payload)
        .eq('user_id', user.id);
      if (error) {
        toast({ title: t('error'), description: t('cannotSave'), variant: 'destructive' });
      } else {
        toast({ title: t('success'), description: t('protectionSaved') });
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('protection_passwords')
        .insert(payload);
      if (error) {
        toast({ title: t('error'), description: t('cannotSave'), variant: 'destructive' });
      } else {
        toast({ title: t('success'), description: t('protectionSaved') });
        fetchData();
      }
    }

    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t('protectionPassword')}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                <div>
                  <p className="font-medium">{t('enableProtection')}</p>
                  <p className="text-sm text-muted-foreground">{t('protectionDesc')}</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              {enabled && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Phone */}
                  <div className="space-y-2">
                    <Label>{t('phoneNumber')} <span className="text-destructive">*</span></Label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="0901234567"
                    />
                  </div>

                  {/* PIN */}
                  <div className="space-y-2">
                    <Label>
                      {t('protectionPin')} <span className="text-destructive">*</span>
                      {existingRecord && (
                        <span className="text-xs text-muted-foreground ml-2">({t('leaveBlankToKeep')})</span>
                      )}
                    </Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        setPin(v);
                      }}
                      placeholder="••••••"
                    />
                    {pin && !/^\d{6}$/.test(pin) && (
                      <p className="text-xs text-destructive">{t('pinMust6Digits')}</p>
                    )}
                  </div>

                  {/* Confirm PIN */}
                  <div className="space-y-2">
                    <Label>{t('confirmProtectionPin')} <span className="text-destructive">*</span></Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        setConfirmPin(v);
                      }}
                      placeholder="••••••"
                    />
                    {confirmPin && pin !== confirmPin && (
                      <p className="text-xs text-destructive">{t('pinMismatch')}</p>
                    )}
                  </div>

                  {existingRecord?.is_locked && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                      {t('accountLockedByProtection')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-4 border-t">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

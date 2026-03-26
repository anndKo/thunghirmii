// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { ProtectionPasswordSetup } from './ProtectionPasswordSetup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Check, Camera, KeyRound, Globe, UserPen, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

import { AvatarCropDialog } from './AvatarCropDialog';

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProtection?: () => void;
  onOpenPasswordChange?: () => void;
}

export function UserSettingsDialog({ open, onOpenChange, onOpenProtection, onOpenPasswordChange }: UserSettingsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    display_id: '',
    avatar_url: '',
  });

  // Password change state (kept for backward compat, now handled externally)
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showProtectionSetup, setShowProtectionSetup] = useState(false);

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');

  useEffect(() => {
    if (open && user) fetchData();
  }, [open, user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, avatar_url')
      .eq('user_id', user.id)
      .single();

    const { data: settings } = await supabase
      .from('user_settings')
      .select('display_id, avatar_url')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      const p = profile as any;
      setFormData(prev => ({
        ...prev,
        full_name: p.full_name || '',
        phone: p.phone || '',
        avatar_url: p.avatar_url || settings?.avatar_url || '',
      }));
    }

    if (settings) {
      setFormData(prev => ({ ...prev, display_id: settings.display_id }));
    } else {
      const { data: newId } = await supabase.rpc('generate_display_id');
      const displayId = newId || `TT${Date.now().toString().slice(-6)}`;
      await supabase.from('user_settings').insert({ user_id: user.id, display_id: displayId });
      setFormData(prev => ({ ...prev, display_id: displayId }));
    }

    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: t('error'), description: t('selectImageFile'), variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('error'), description: t('imageMaxSize'), variant: 'destructive' });
      return;
    }

    // Read file and open crop dialog
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (blob: Blob) => {
    if (!user) return;

    setUploadingAvatar(true);
    const filePath = `${user.id}/avatar.png`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, { upsert: true, contentType: 'image/png' });

    if (uploadError) {
      toast({ title: t('error'), description: t('cannotUploadImage'), variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: avatarUrl } as any).eq('user_id', user.id);

    setFormData(prev => ({ ...prev, avatar_url: avatarUrl }));
    setUploadingAvatar(false);
    toast({ title: t('success'), description: t('avatarUpdated') });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: formData.full_name, phone: formData.phone })
      .eq('user_id', user.id);

    setSaving(false);

    if (profileError) {
      toast({ title: t('error'), description: t('cannotSave'), variant: 'destructive' });
    } else {
      toast({ title: t('saved'), description: t('infoUpdated') });
      onOpenChange(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(formData.display_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: t('copied'), description: t('idCopied') });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{t('personalSettings')}</DialogTitle>
            <DialogDescription>{t('updateInfoAvatar')}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
            <div className="space-y-4">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <Avatar className="h-20 w-20 border-2 border-primary/20">
                    <AvatarImage src={formData.avatar_url} alt="Avatar" />
                    <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                      {getInitials(formData.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('clickToChangeAvatar')}</p>
              </div>

              {/* Display ID */}
              <div className="space-y-2">
                <Label>{t('yourId')}</Label>
                <div className="flex gap-2">
                  <Input value={formData.display_id} disabled className="bg-muted font-mono ring-offset-0 focus-visible:ring-offset-0" />
                  <Button type="button" variant="outline" size="icon" onClick={copyId}>
                    {copied ? <Check className="h-4 w-4 text-secondary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('idDescription')}</p>
              </div>

              {/* Login Account Email */}
              <div className="space-y-2">
                <Label>{t('loginAccount')}</Label>
                <Input value={user?.email || ""} disabled className="bg-muted ring-offset-0 focus-visible:ring-offset-0" />
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label>{t('fullName')}</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  className="ring-offset-0 focus-visible:ring-offset-0"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>{t('phoneNumber')}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0901234567"
                  className="ring-offset-0 focus-visible:ring-offset-0"
                />
              </div>




              {/* Change Password Button */}
              <div className="border-t pt-4 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { if (onOpenPasswordChange) onOpenPasswordChange(); }}
                >
                  <KeyRound className="h-4 w-4" />
                  {t('changePassword')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { if (onOpenProtection) onOpenProtection(); }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t('protectionPassword')}
                </Button>
              </div>

              {/* Language Selector */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">{t('language')}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={language === 'vi' ? 'default' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => setLanguage('vi')}
                  >
                    <span>🇻🇳</span>
                    {t('vietnamese')}
                  </Button>
                  <Button
                    type="button"
                    variant={language === 'en' ? 'default' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => setLanguage('en')}
                  >
                    <span>🇬🇧</span>
                    {t('english')}
                  </Button>
                </div>
              </div>
            </div>
            </div>
          )}

          <DialogFooter className="shrink-0 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>




      {/* Crop Dialog */}
      <AvatarCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={cropImageSrc}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}

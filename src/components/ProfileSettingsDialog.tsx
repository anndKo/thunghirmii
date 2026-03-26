// @ts-nocheck
import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ProfileData {
  full_name: string;
  phone: string | null;
  address: string | null;
}

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const { user, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    phone: '',
    address: '',
  });
  const [initialized, setInitialized] = useState(false);

  // Instantly populate from AuthContext cache, then refresh in background
  useEffect(() => {
    if (!open || !user) {
      setInitialized(false);
      return;
    }

    // Immediate: use cached auth profile data
    if (authProfile && !initialized) {
      setProfile({
        full_name: (authProfile as any).full_name || '',
        phone: (authProfile as any).phone || '',
        address: user.user_metadata?.address || '',
      });
      setInitialized(true);
    }

    // Background refresh: parallel fetch
    const refresh = async () => {
      const [profileRes, userRes] = await Promise.all([
        supabase.from('profiles').select('full_name, phone').eq('user_id', user.id).single(),
        supabase.auth.getUser(),
      ]);
      
      setProfile({
        full_name: profileRes.data?.full_name || '',
        phone: profileRes.data?.phone || '',
        address: userRes.data?.user?.user_metadata?.address || '',
      });
      setInitialized(true);
    };
    refresh();
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    // Update profile table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
      })
      .eq('user_id', user.id);

    // Update user metadata for address
    const { error: metaError } = await supabase.auth.updateUser({
      data: { address: profile.address }
    });

    setSaving(false);

    if (profileError || metaError) {
      toast({
        title: 'Lỗi',
        description: 'Không thể lưu thông tin. Vui lòng thử lại.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Đã lưu!',
        description: 'Thông tin cá nhân đã được cập nhật.',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cài đặt thông tin cá nhân</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin của bạn để tự động điền khi đăng phòng
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Họ và tên</Label>
            <Input
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div className="space-y-2">
            <Label>Số điện thoại</Label>
            <Input
              value={profile.phone || ''}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="0901234567"
            />
          </div>

          <div className="space-y-2">
            <Label>Địa chỉ mặc định</Label>
            <Input
              value={profile.address || ''}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              placeholder="123 Đường ABC, Quận 1, TP.HCM"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to get saved profile data
export function useSavedProfile() {
  const { user } = useAuth();
  
  const getSavedProfile = async (): Promise<ProfileData | null> => {
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', user.id)
      .single();

    const { data: userData } = await supabase.auth.getUser();
    const address = userData?.user?.user_metadata?.address || '';

    if (profile) {
      return {
        full_name: profile.full_name,
        phone: profile.phone,
        address,
      };
    }

    return null;
  };

  return { getSavedProfile };
}

// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ImagePlus, X, Settings, Trash2, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NotifRecord {
  id: string;
  title: string;
  content: string;
  target_role: string;
  image_url: string | null;
  created_at: string;
  is_active: boolean;
}

const PAYMENT_NOTIF_KEYWORDS = ['Hạn thanh toán', 'Xác nhận thanh toán', 'Chậm hạn thanh toán', 'Cập nhật thanh toán'];

function isPaymentNotif(title: string): boolean {
  return PAYMENT_NOTIF_KEYWORDS.some(k => title.startsWith(k));
}

export function AdminNotificationDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Management fullscreen dialog
  const [manageOpen, setManageOpen] = useState(false);
  const [existingNotifs, setExistingNotifs] = useState<NotifRecord[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchNotifs = async () => {
    setLoadingNotifs(true);
    const { data } = await (supabase as any)
      .from('notifications')
      .select('id, title, content, target_role, image_url, created_at, is_active')
      .order('created_at', { ascending: false })
      .limit(50);
    const filtered = (data || []).filter((n: NotifRecord) => !isPaymentNotif(n.title));
    setExistingNotifs(filtered);
    setLoadingNotifs(false);
  };

  useEffect(() => {
    if (manageOpen) fetchNotifs();
  }, [manageOpen]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !user) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tiêu đề và nội dung.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    let imageUrl: string | null = null;

    if (imageFile) {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const path = `notifications/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, imageFile, { contentType: imageFile.type });
      if (!upErr) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
    }

    const { error } = await (supabase as any).from('notifications').insert({
      title: title.trim(),
      content: content.trim(),
      image_url: imageUrl,
      target_role: targetRole,
      created_by: user.id,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể tạo thông báo.', variant: 'destructive' });
    } else {
      toast({ title: 'Thành công!', description: 'Thông báo đã được tạo.' });
      setTitle('');
      setContent('');
      setTargetRole('all');
      setImageFile(null);
      setImagePreview('');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể xóa thông báo.', variant: 'destructive' });
    } else {
      toast({ title: 'Đã xóa thông báo.' });
      setExistingNotifs(prev => prev.filter(n => n.id !== id));
    }
  };

  const handleToggleActive = async (notif: NotifRecord) => {
    setTogglingId(notif.id);
    const newActive = !notif.is_active;
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ is_active: newActive })
      .eq('id', notif.id);
    setTogglingId(null);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật.', variant: 'destructive' });
    } else {
      setExistingNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_active: newActive } : n));
      toast({ title: newActive ? 'Đã bật thông báo' : 'Đã tắt thông báo' });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'all': return <Badge variant="secondary">Tất cả</Badge>;
      case 'tenant': return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Người thuê</Badge>;
      case 'landlord': return <Badge className="bg-green-500/10 text-green-600 border-green-200">Chủ trọ</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <>
      {/* Create notification dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tạo thông báo</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Button to open management fullscreen */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setManageOpen(true)}
            >
              <Settings className="h-4 w-4" />
              Quản lí thông báo
            </Button>

            {/* Create form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tiêu đề thông báo</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tiêu đề..." />
              </div>

              <div className="space-y-2">
                <Label>Nội dung thông báo</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Nhập nội dung..." rows={5} />
              </div>

              <div className="space-y-2">
                <Label>Hình ảnh (không bắt buộc)</Label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(''); }}
                      className="absolute top-2 right-2 h-7 w-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-sm">Chọn hình ảnh</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </div>

              <div className="space-y-2">
                <Label>Vai trò nhận thông báo</Label>
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="tenant">Người thuê trọ</SelectItem>
                    <SelectItem value="landlord">Chủ trọ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo thông báo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen management dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="w-full h-full max-w-full max-h-full sm:rounded-none p-0 gap-0 flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setManageOpen(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">Quản lí thông báo</h2>
              <p className="text-xs text-muted-foreground">Thông báo thanh toán tự động không hiện ở đây</p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loadingNotifs ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : existingNotifs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                Chưa có thông báo nào.
              </div>
            ) : (
              <div className="divide-y">
                {existingNotifs.map((notif) => (
                  <div key={notif.id} className={`px-4 py-4 flex items-start gap-3 ${!notif.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-medium">{notif.title}</p>
                        {getRoleBadge(notif.target_role)}
                        {!notif.is_active && <Badge variant="outline" className="text-xs">Đã tắt</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">{notif.content}</p>
                      {notif.image_url && (
                        <img src={notif.image_url} alt="" className="mt-2 h-20 rounded-lg object-cover" />
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        {new Date(notif.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={notif.is_active}
                        onCheckedChange={() => handleToggleActive(notif)}
                        disabled={togglingId === notif.id}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-9 w-9"
                        onClick={() => handleDelete(notif.id)}
                        disabled={deletingId === notif.id}
                      >
                        {deletingId === notif.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

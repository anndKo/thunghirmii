// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, BookOpen, Trash2, Edit, Video, ArrowLeft, Upload } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Guide {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  target_roles: string[];
  created_at: string;
}

export default function GuideManagement() {
  const { user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [deleteGuide, setDeleteGuide] = useState<Guide | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && role === 'admin') fetchGuides();
  }, [user, role]);

  const fetchGuides = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('guides')
      .select('*')
      .order('created_at', { ascending: false });
    setGuides((data as Guide[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setVideoUrl('');
    setTargetRoles([]);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Allow large videos up to 500MB
    if (file.size > 500 * 1024 * 1024) {
      toast({ title: 'File quá lớn', description: 'Video tối đa 500MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `guide-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('guide-videos')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) {
      toast({ title: 'Lỗi upload', description: error.message, variant: 'destructive' });
    } else {
      const { data: urlData } = supabase.storage.from('guide-videos').getPublicUrl(fileName);
      setVideoUrl(urlData.publicUrl);
      toast({ title: 'Upload thành công!' });
    }
    setUploading(false);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'Thiếu tiêu đề', variant: 'destructive' });
      return;
    }
    if (targetRoles.length === 0) {
      toast({ title: 'Chọn ít nhất 1 vai trò', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    if (editingGuide) {
      const { error } = await supabase
        .from('guides')
        .update({
          title: title.trim(),
          content: content.trim() || null,
          video_url: videoUrl || null,
          target_roles: targetRoles,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingGuide.id);

      if (error) {
        toast({ title: 'Lỗi', description: 'Không thể cập nhật', variant: 'destructive' });
      } else {
        toast({ title: 'Đã cập nhật hướng dẫn!' });
        setCreateOpen(false);
        setEditingGuide(null);
        resetForm();
        fetchGuides();
      }
    } else {
      const { error } = await supabase
        .from('guides')
        .insert({
          title: title.trim(),
          content: content.trim() || null,
          video_url: videoUrl || null,
          target_roles: targetRoles,
          created_by: user!.id,
        });

      if (error) {
        toast({ title: 'Lỗi', description: 'Không thể tạo hướng dẫn', variant: 'destructive' });
      } else {
        toast({ title: 'Đã tạo hướng dẫn!' });
        setCreateOpen(false);
        resetForm();
        fetchGuides();
      }
    }
    setSubmitting(false);
  };

  const handleEdit = (guide: Guide) => {
    setEditingGuide(guide);
    setTitle(guide.title);
    setContent(guide.content || '');
    setVideoUrl(guide.video_url || '');
    setTargetRoles(guide.target_roles);
    setCreateOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteGuide) return;
    const { error } = await supabase.from('guides').delete().eq('id', deleteGuide.id);
    if (error) {
      toast({ title: 'Lỗi xoá', variant: 'destructive' });
    } else {
      toast({ title: 'Đã xoá hướng dẫn' });
      fetchGuides();
    }
    setDeleteGuide(null);
  };

  const toggleRole = (r: string) => {
    setTargetRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const getRoleBadge = (r: string) => {
    if (r === 'tenant') return <Badge key={r} className="bg-secondary text-secondary-foreground">Người thuê</Badge>;
    if (r === 'landlord') return <Badge key={r} className="bg-primary text-primary-foreground">Chủ trọ</Badge>;
    return <Badge key={r} variant="outline">{r}</Badge>;
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Quản lí hướng dẫn
            </h1>
            <p className="text-muted-foreground text-sm">Tạo và quản lý hướng dẫn cho người dùng</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingGuide(null); setCreateOpen(true); }} className="bg-gradient-primary hover:opacity-90 gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Tạo hướng dẫn</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : guides.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">Chưa có hướng dẫn nào</p>
            <p className="text-sm text-muted-foreground">Bấm "Tạo hướng dẫn" để bắt đầu</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <Card key={guide.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-2">{guide.title}</CardTitle>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(guide)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteGuide(guide)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {guide.content && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{guide.content}</p>
                  )}
                  {guide.video_url && (
                    <div className="flex items-center gap-1.5 text-sm text-primary">
                      <Video className="h-4 w-4" />
                      <span>Có video</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {guide.target_roles.map(r => getRoleBadge(r))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(guide.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) { setCreateOpen(false); setEditingGuide(null); resetForm(); } else setCreateOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingGuide ? 'Chỉnh sửa hướng dẫn' : 'Tạo hướng dẫn mới'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 pb-2">
              {/* Target roles */}
              <div className="space-y-2">
                <Label>Vai trò hiển thị *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={targetRoles.includes('tenant')} onCheckedChange={() => toggleRole('tenant')} />
                    <span className="text-sm">Người thuê trọ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={targetRoles.includes('landlord')} onCheckedChange={() => toggleRole('landlord')} />
                    <span className="text-sm">Chủ trọ</span>
                  </label>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Tiêu đề *</Label>
                <Input placeholder="Nhập tiêu đề hướng dẫn" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label>Nội dung</Label>
                <Textarea
                  placeholder="Nhập nội dung hướng dẫn (tuỳ chọn)"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={5}
                />
              </div>

              {/* Video upload */}
              <div className="space-y-2">
                <Label>Video hướng dẫn</Label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                {videoUrl ? (
                  <div className="space-y-2">
                    <video src={videoUrl} controls className="w-full rounded-lg max-h-48" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setVideoUrl('')}>Xoá video</Button>
                      <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()}>Đổi video</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2 h-20 border-dashed"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Đang tải lên...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        Chọn video từ thiết bị
                      </>
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Hỗ trợ video dung lượng lớn (tối đa 500MB)</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditingGuide(null); resetForm(); }}>Huỷ</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-primary hover:opacity-90 gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingGuide ? 'Cập nhật' : 'Tạo hướng dẫn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteGuide} onOpenChange={(v) => { if (!v) setDeleteGuide(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá hướng dẫn</AlertDialogTitle>
            <AlertDialogDescription>Bạn có chắc muốn xoá hướng dẫn "{deleteGuide?.title}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

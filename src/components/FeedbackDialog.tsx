// @ts-nocheck
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ImagePlus, X, Loader2, Send } from 'lucide-react';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ file: File; preview: string }[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickMedia = () => fileInputRef.current?.click();

  const handleMediaSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const accepted = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (media.length + accepted.length > 5) {
      toast({ title: 'Tối đa 5 ảnh/video', variant: 'destructive' });
      return;
    }
    const newMedia = accepted.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setMedia(prev => [...prev, ...newMedia]);
    if (e.target) e.target.value = '';
  };

  const removeMedia = (idx: number) => {
    URL.revokeObjectURL(media[idx].preview);
    setMedia(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    setSending(true);

    try {
      // Upload media
      const mediaUrls: string[] = [];
      for (const m of media) {
        const ext = m.file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('feedback-media').upload(path, m.file);
        if (!uploadErr) {
          const { data } = supabase.storage.from('feedback-media').getPublicUrl(path);
          mediaUrls.push(data.publicUrl);
        }
      }

      const { error } = await (supabase as any).from('feedbacks').insert({
        user_id: user.id,
        content: content.trim(),
        media_urls: mediaUrls,
      });

      if (error) throw error;

      toast({ title: 'Đã gửi phản hồi!', description: 'Cảm ơn bạn đã phản hồi. Admin sẽ xem xét và trả lời.' });
      setContent('');
      media.forEach(m => URL.revokeObjectURL(m.preview));
      setMedia([]);
      onOpenChange(false);
    } catch {
      toast({ title: 'Không thể gửi phản hồi', variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>💬 Gửi phản hồi</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Nhập nội dung phản hồi của bạn..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleMediaSelected}
          />
          {media.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {media.map((m, idx) => (
                <div key={idx} className="relative w-16 h-16">
                  {m.file.type.startsWith('video/') ? (
                    <video src={m.preview} className="w-full h-full object-cover rounded-lg border" />
                  ) : (
                    <img src={m.preview} className="w-full h-full object-cover rounded-lg border" />
                  )}
                  <button
                    onClick={() => removeMedia(idx)}
                    className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handlePickMedia} disabled={media.length >= 5} className="gap-2">
            <ImagePlus className="h-4 w-4" />
            Thêm ảnh/video ({media.length}/5)
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={!content.trim() || sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Gửi phản hồi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Ban, Send, Upload, X, Loader2, Image, Video } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BanInfo {
  reason: string;
}

export function BannedOverlay({ userId }: { userId: string }) {
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkBan();
  }, [userId]);

  const checkBan = async () => {
    const { data } = await (supabase as any)
      .from('banned_users')
      .select('reason')
      .eq('user_id', userId)
      .single();

    if (data) {
      setBanInfo(data);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const total = mediaFiles.length + files.length;
    if (total > 10) {
      toast({ title: 'Tối đa 10 file', variant: 'destructive' });
      return;
    }
    setMediaFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!email.trim() || !phone.trim()) {
      toast({ title: 'Vui lòng nhập email và SĐT', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    try {
      // Upload media files
      const mediaUrls: string[] = [];
      for (const file of mediaFiles) {
        const ext = file.name.split('.').pop();
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('ban-appeals').upload(path, file);
        if (!error) {
          const { data: urlData } = supabase.storage.from('ban-appeals').getPublicUrl(path);
          mediaUrls.push(urlData.publicUrl);
        }
      }

      const { error } = await (supabase as any).from('ban_appeals').insert({
        user_id: userId,
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim() || null,
        media_urls: mediaUrls,
      });

      if (error) throw error;

      setSubmitted(true);
      toast({ title: 'Đã gửi kháng nghị', description: 'Admin sẽ xem xét yêu cầu của bạn' });
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể gửi kháng nghị', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !banInfo) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-destructive/10 p-6 text-center">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-destructive">Tài khoản đã bị cấm</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Bạn không thể sử dụng hệ thống
          </p>
        </div>

        {/* Reason */}
        <div className="p-4 mx-4 mt-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <p className="text-sm font-medium text-destructive mb-1">Lí do:</p>
          <p className="text-sm text-foreground">{banInfo.reason}</p>
        </div>

        {/* Appeal form */}
        {!submitted ? (
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Kháng nghị</p>

            <Input
              placeholder="Email *"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
            />
            <Input
              placeholder="Số điện thoại *"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <Textarea
              placeholder="Nội dung kháng nghị..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
            />

            {/* Media upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaFiles.length >= 10}
                className="gap-1 text-xs"
              >
                <Upload className="h-3 w-3" />
                Tải ảnh/video ({mediaFiles.length}/10)
              </Button>

              {mediaFiles.length > 0 && (
                <ScrollArea className="max-h-[120px] mt-2">
                  <div className="flex flex-wrap gap-2">
                    {mediaFiles.map((file, i) => (
                      <div
                        key={i}
                        className="relative group bg-muted rounded-lg p-2 flex items-center gap-2 text-xs max-w-[200px]"
                      >
                        {file.type.startsWith('image/') ? (
                          <Image className="h-4 w-4 text-primary flex-shrink-0" />
                        ) : (
                          <Video className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                        <span className="truncate">{file.name}</span>
                        <button
                          onClick={() => removeFile(i)}
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !email.trim() || !phone.trim()}
              className="w-full gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi kháng nghị
            </Button>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Kháng nghị đã được gửi. Admin sẽ xem xét và phản hồi qua email hoặc SĐT bạn cung cấp.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

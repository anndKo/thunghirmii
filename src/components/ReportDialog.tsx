import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Flag, Loader2, ImagePlus, X, Play, Upload } from 'lucide-react';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomTitle: string;
  roomCode?: string;
  reporterId?: string;
  reporterName?: string;
  reporterPhone?: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  roomId,
  roomTitle,
  roomCode,
  reporterId,
  reporterName,
  reporterPhone,
}: ReportDialogProps) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{ file: File; preview: string; type: 'image' | 'video' }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickMedia = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 10 - mediaFiles.length;
    const selected = Array.from(files).slice(0, remaining);

    // Clear input AFTER converting to array
    if (fileInputRef.current) fileInputRef.current.value = '';

    const newFiles = selected.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
    }));

    setMediaFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setMediaFiles(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const uploadFileWithProgress = async (file: File, filePath: string): Promise<string> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${supabaseUrl}/storage/v1/object/room-reports/${filePath}`;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const { data } = supabase.storage.from('room-reports').getPublicUrl(filePath);
          resolve(data.publicUrl);
        } else {
          console.error('Upload failed:', xhr.status, xhr.responseText);
          reject(new Error(`Upload thất bại (${xhr.status})`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Lỗi kết nối khi tải file'));
      });

      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.send(file);
    });
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSending(true);
    setUploadProgress(null);

    try {
      const mediaUrls: string[] = [];

      for (let i = 0; i < mediaFiles.length; i++) {
        const media = mediaFiles[i];
        const ext = (media.file.name.split('.').pop() || 'jpg').toLowerCase();
        const filePath = `reports/${roomId}/${crypto.randomUUID()}.${ext}`;

        setUploadingFileName(`${i + 1}/${mediaFiles.length}: ${media.file.name}`);
        setUploadProgress(0);

        try {
          const publicUrl = await uploadFileWithProgress(media.file, filePath);
          mediaUrls.push(publicUrl);
        } catch (uploadErr) {
          console.error('Upload error for file:', media.file.name, uploadErr);
          // Fallback: try with Supabase SDK
          const { error: sdkError } = await supabase.storage
            .from('room-reports')
            .upload(filePath, media.file, { contentType: media.file.type, upsert: false });

          if (sdkError) {
            console.error('SDK upload also failed:', sdkError);
            toast({
              title: 'Lỗi tải file',
              description: `Không thể tải "${media.file.name}": ${sdkError.message}`,
              variant: 'destructive',
            });
            continue; // Skip this file but continue with others
          }

          const { data } = supabase.storage.from('room-reports').getPublicUrl(filePath);
          mediaUrls.push(data.publicUrl);
        }
      }

      setUploadProgress(null);
      setUploadingFileName('');

      // Insert report
      const { error } = await (supabase as any)
        .from('room_reports')
        .insert({
          room_id: roomId,
          reporter_id: reporterId || null,
          reporter_name: reporterName || null,
          reporter_phone: reporterPhone || null,
          content: content.trim(),
          media_urls: mediaUrls,
        });

      if (error) throw error;

      toast({
        title: 'Đã gửi báo cáo',
        description: mediaUrls.length > 0
          ? `Báo cáo đã được gửi kèm ${mediaUrls.length} file.`
          : 'Báo cáo đã được gửi đến Admin.',
      });
      setContent('');
      mediaFiles.forEach(m => URL.revokeObjectURL(m.preview));
      setMediaFiles([]);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Report error', err);
      toast({ title: 'Lỗi', description: err?.message || 'Không thể gửi báo cáo', variant: 'destructive' });
    } finally {
      setSending(false);
      setUploadProgress(null);
      setUploadingFileName('');
    }
  };

  const handleClose = () => {
    if (sending) return;
    setContent('');
    mediaFiles.forEach(m => URL.revokeObjectURL(m.preview));
    setMediaFiles([]);
    onOpenChange(false);
  };

  const totalFileSize = mediaFiles.reduce((sum, m) => sum + m.file.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Báo cáo trọ - {roomTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Nhập nội dung báo cáo của bạn..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="resize-none"
            disabled={sending}
          />

          {/* Media preview */}
          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {mediaFiles.map((media, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                    {media.type === 'image' ? (
                      <img src={media.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black/80">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    )}
                    {!sending && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {mediaFiles.length} file • {formatSize(totalFileSize)}
              </p>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress !== null && (
            <div className="space-y-1.5 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-muted-foreground truncate flex-1">{uploadingFileName}</span>
                <span className="font-semibold text-primary">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Upload button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handlePickMedia}
            disabled={mediaFiles.length >= 10 || sending}
          >
            <ImagePlus className="h-4 w-4" />
            Tải ảnh/video ({mediaFiles.length}/10)
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={sending}>Huỷ</Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            disabled={!content.trim() || sending}
            onClick={handleSubmit}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
            {sending ? 'Đang gửi...' : 'Gửi báo cáo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

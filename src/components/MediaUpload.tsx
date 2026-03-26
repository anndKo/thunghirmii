import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, Image, Video, Play } from 'lucide-react';
import { MediaPreviewDialog } from './MediaPreviewDialog';

interface MediaUploadProps {
  label: string;
  accept: string;
  multiple?: boolean;
  onUploadComplete: (urls: string[]) => void;
  existingUrls?: string[];
  type: 'image' | 'video';
}

// Generate thumbnail from video
function generateVideoThumbnail(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject('Canvas context failed');
        }
      } catch {
        reject('Thumbnail generation failed');
      }
    };

    video.onerror = () => reject('Video load failed');
    video.src = videoUrl;
  });
}

// Upload with XHR for progress tracking
function uploadFileWithProgress(
  file: File,
  filePath: string,
  bucketName: string,
  onProgress: (percent: number) => void
): Promise<{ publicUrl: string }> {
  return new Promise((resolve, reject) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = `${supabaseUrl}/storage/v1/object/${bucketName}/${filePath}`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
    xhr.setRequestHeader('apikey', supabaseKey);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
        resolve({ publicUrl });
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(file);
  });
}

export function MediaUpload({ 
  label, 
  accept, 
  multiple = true, 
  onUploadComplete, 
  existingUrls = [],
  type 
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(existingUrls);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileInfo, setCurrentFileInfo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    const newUrls: string[] = [];
    const totalFiles = files.length;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${type}s/${fileName}`;

        setCurrentFileInfo(`${i + 1}/${totalFiles}: ${file.name}`);

        try {
          const { publicUrl } = await uploadFileWithProgress(
            file,
            filePath,
            'room-media',
            (percent) => {
              // Overall progress = (completed files + current file progress) / total
              const overallPercent = Math.round(((i + percent / 100) / totalFiles) * 100);
              setUploadProgress(overallPercent);
            }
          );

          newUrls.push(publicUrl);

          // Generate thumbnail for video
          if (type === 'video') {
            try {
              const thumb = await generateVideoThumbnail(publicUrl);
              setVideoThumbnails(prev => ({ ...prev, [publicUrl]: thumb }));
            } catch {
              // Silent fail - will show play icon fallback
            }
          }
        } catch (uploadError: any) {
          // Fallback to standard SDK upload
          const { error: sdkError } = await supabase.storage
            .from('room-media')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

          if (sdkError) {
            toast({
              title: 'Lỗi tải lên',
              description: `Không thể tải ${file.name}: ${sdkError.message}`,
              variant: 'destructive',
            });
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('room-media')
            .getPublicUrl(filePath);
          newUrls.push(publicUrl);
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        }
      }

      const allUrls = [...uploadedUrls, ...newUrls];
      setUploadedUrls(allUrls);
      onUploadComplete(allUrls);

      if (newUrls.length > 0) {
        toast({
          title: 'Thành công!',
          description: `Đã tải lên ${newUrls.length} ${type === 'image' ? 'ảnh' : 'video'}`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Lỗi',
        description: 'Có lỗi xảy ra khi tải tệp',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentFileInfo('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUrl = (urlToRemove: string) => {
    const newUrls = uploadedUrls.filter(url => url !== urlToRemove);
    setUploadedUrls(newUrls);
    onUploadComplete(newUrls);
    setVideoThumbnails(prev => {
      const copy = { ...prev };
      delete copy[urlToRemove];
      return copy;
    });
  };

  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Đang tải...' : `Tải ${type === 'image' ? 'ảnh' : 'video'}`}
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[70%]">{currentFileInfo}</span>
            <span className="font-medium text-primary">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {uploadedUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {uploadedUrls.map((url, index) => (
            <div 
              key={index} 
              className="relative group rounded-lg overflow-hidden border bg-muted cursor-pointer"
              onClick={() => openPreview(index)}
            >
              {type === 'image' ? (
                <img 
                  src={url} 
                  alt={`Upload ${index + 1}`}
                  className="w-full h-24 object-cover transition-transform group-hover:scale-105"
                />
              ) : videoThumbnails[url] ? (
                <div className="relative w-full h-24">
                  <img
                    src={videoThumbnails[url]}
                    alt={`Video ${index + 1}`}
                    className="w-full h-24 object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                      <Play className="h-5 w-5 text-white ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-24 flex items-center justify-center bg-muted">
                  <Video className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeUrl(url); }}
                className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {type === 'image' 
          ? 'Hỗ trợ ảnh chất lượng cao: JPG, PNG, WebP, HEIC' 
          : 'Hỗ trợ: MP4, WebM (tối đa 100MB/video)'}
      </p>

      <MediaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        urls={uploadedUrls}
        initialIndex={previewIndex}
        type={type}
      />
    </div>
  );
}

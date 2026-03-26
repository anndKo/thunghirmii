// @ts-nocheck
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, Video, ChevronRight, X, Download, Maximize } from 'lucide-react';

interface Guide {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  target_roles: string[];
}

interface GuideViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuideViewer({ open, onOpenChange }: GuideViewerProps) {
  const { role } = useAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [videoFullscreen, setVideoFullscreen] = useState(false);

  useEffect(() => {
    if (open && role) fetchGuides();
  }, [open, role]);

  const fetchGuides = async () => {
    const { data } = await supabase
      .from('guides')
      .select('id, title, content, video_url, target_roles')
      .order('created_at', { ascending: false });

    if (data) {
      // Filter by role
      const filtered = (data as Guide[]).filter(g => g.target_roles.includes(role || ''));
      setGuides(filtered);
    }
  };

  const handleDownloadVideo = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'huong-dan.mp4';
    a.target = '_blank';
    a.click();
  };

  return (
    <>
      {/* Guide list */}
      <Sheet open={open && !selectedGuide} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 sm:w-96 p-0">
          <SheetHeader className="p-4 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Hướng dẫn sử dụng
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-3 space-y-1">
              {guides.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Chưa có hướng dẫn nào</p>
                </div>
              ) : (
                guides.map((guide) => (
                  <button
                    key={guide.id}
                    onClick={() => setSelectedGuide(guide)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {guide.video_url ? <Video className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{guide.title}</p>
                      {guide.content && (
                        <p className="text-xs text-muted-foreground truncate">{guide.content}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Guide detail dialog */}
      <Dialog open={!!selectedGuide && !videoFullscreen} onOpenChange={(v) => { if (!v) setSelectedGuide(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg pr-6">{selectedGuide?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-4 pb-4">
              {selectedGuide?.content && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedGuide.content}
                </div>
              )}
              {selectedGuide?.video_url && (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      src={selectedGuide.video_url}
                      controls
                      className="w-full max-h-[400px]"
                    />
                    <button
                      onClick={() => setVideoFullscreen(true)}
                      className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Xem toàn màn hình"
                    >
                      <Maximize className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setSelectedGuide(null)}>Đóng</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video fullscreen modal */}
      {videoFullscreen && selectedGuide?.video_url && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => handleDownloadVideo(selectedGuide.video_url!)}
              title="Tải xuống"
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setVideoFullscreen(false)}
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <video
            src={selectedGuide.video_url}
            controls
            autoPlay
            className="max-w-full max-h-full w-full h-full object-contain"
          />
        </div>
      )}
    </>
  );
}

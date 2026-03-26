import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LocateFixed, Monitor, Smartphone } from 'lucide-react';

interface LocationPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

type GuideTab = 'android' | 'ios' | 'desktop';

export function LocationPermissionDialog({ open, onOpenChange, onAccept }: LocationPermissionDialogProps) {
  const [activeGuide, setActiveGuide] = useState<GuideTab>('desktop');

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setActiveGuide('desktop');
    }
    onOpenChange(val);
  };

  const guides: Record<GuideTab, { icon: React.ReactNode; label: string; title: string; steps: string[] }> = {
    desktop: {
      icon: <Monitor className="h-4 w-4" />,
      label: 'Máy tính',
      title: '💻 Trên máy tính (Chrome, Cốc Cốc, Edge)',
      steps: [
        'Nhấn vào biểu tượng ba chấm ⋮ hoặc icon vị trí bên trái thanh địa chỉ website.',
        'Vào Settings → Chọn "Cài đặt trang web" (Site settings).',
        'Tìm mục "Vị trí" (Location).',
        'Chuyển từ "Chặn" (Block) sang "Cho phép" (Allow).',
        'Tải lại trang để hoàn tất.',
      ],
    },
    android: {
      icon: <Smartphone className="h-4 w-4" />,
      label: 'Android',
      title: '🔹 Trình duyệt Chrome (Android)',
      steps: [
        'Nhấn vào biểu tượng ⋮ (3 chấm) góc trên bên phải.',
        'Chọn "Cài đặt" → "Cài đặt trang web".',
        'Chọn "Vị trí".',
        'Tìm tên website (Hoặc phần không được phép) và chuyển sang "Cho phép".',
        'Quay lại và tải lại trang.',
      ],
    },
    ios: {
      icon: <Smartphone className="h-4 w-4" />,
      label: 'iOS',
      title: '🍎 Trên iPhone (Safari)',
      steps: [
        'Vào "Cài đặt" trên điện thoại.',
        'Chọn "Safari" → "Vị trí".',
        'Chọn "Cho phép khi dùng ứng dụng".',
        'Mở lại website và tải lại trang.',
      ],
    },
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col [&_[data-radix-scroll-area-scrollbar]]:w-1.5 [&_[data-radix-scroll-area-thumb]]:bg-foreground/25 [&_[data-radix-scroll-area-thumb]]:rounded-full">
        <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
          <div className="flex flex-col items-center text-center py-3 sm:py-4 space-y-2">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <LocateFixed className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold">Hướng dẫn bật vị trí</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Chọn thiết bị của bạn và làm theo hướng dẫn để bật định vị:
            </p>
          </div>

          {/* Device tabs */}
          <div className="grid grid-cols-3 gap-2 px-1 pb-3">
            {(Object.keys(guides) as GuideTab[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveGuide(key)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  activeGuide === key
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-muted/50 text-foreground border-border hover:bg-muted hover:border-primary/30'
                }`}
              >
                {guides[key].icon}
                {guides[key].label}
              </button>
            ))}
          </div>

          {/* Guide content */}
          <div className="relative">
            <ScrollArea
              className="h-[260px] sm:h-[300px] pr-2
              [&_[data-radix-scroll-area-scrollbar]]:w-[6px]
              [&_[data-radix-scroll-area-scrollbar]]:bg-transparent
              [&_[data-radix-scroll-area-thumb]]:bg-muted-foreground/30
              [&_[data-radix-scroll-area-thumb]]:rounded-full
              hover:[&_[data-radix-scroll-area-thumb]]:bg-muted-foreground/50"
            >
              <div className="rounded-xl border-2 border-border bg-muted/30 p-4 sm:p-5 pr-6 pb-20 space-y-3">
                <p className="text-sm sm:text-base font-bold">
                  {guides[activeGuide].title}
                </p>
          
                <ol className="space-y-2.5 pl-5 list-decimal">
                  {guides[activeGuide].steps.map((step, i) => (
                    <li
                      key={i}
                      className="text-sm sm:text-base text-muted-foreground leading-relaxed"
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </ScrollArea>
          
            {/* fade báo còn nội dung */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-2 h-16 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-zinc-900 dark:via-zinc-900/80" />
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-muted-foreground animate-bounce text-xs">
              ↓
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-2 h-6 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.3)]" />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="outline" onClick={() => handleClose(false)} className="w-full sm:w-auto">
              Đóng
            </Button>
            <Button onClick={handleAccept} className="w-full sm:w-auto bg-gradient-primary hover:opacity-90 gap-2">
              <LocateFixed className="h-4 w-4" />
              Đã bật, tìm trọ ngay
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

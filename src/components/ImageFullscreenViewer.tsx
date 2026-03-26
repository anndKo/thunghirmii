import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface ImageFullscreenViewerProps {
  images: string[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageFullscreenViewer({ images, initialIndex, open, onOpenChange }: ImageFullscreenViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Reset index when opening
  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [open, initialIndex]);

  const handleOpenChange = useCallback((val: boolean) => {
    onOpenChange(val);
  }, [onOpenChange]);

  const goNext = () => setCurrentIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
  const goPrev = () => setCurrentIndex((i) => (i <= 0 ? images.length - 1 : i - 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, images.length]);

  if (!images.length) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 border-none bg-black/95 rounded-xl [&>button]:hidden flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <div className="text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full"
              onClick={async () => {
                try {
                  const res = await fetch(images[currentIndex]);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `image-${currentIndex + 1}.jpg`;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch {
                  window.open(images[currentIndex], '_blank');
                }
              }}
              title="Tải xuống"
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full"
              onClick={() => onOpenChange(false)}
              title="Đóng"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Image area with swipe - takes remaining space */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative px-12"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={images[currentIndex]}
            alt=""
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex-shrink-0 px-4 py-3">
            <div className="flex gap-2 justify-center overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex-shrink-0 h-12 w-12 rounded-md overflow-hidden border-2 transition-all ${
                    idx === currentIndex ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Desktop nav buttons */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 rounded-full h-10 w-10 hidden sm:flex"
              onClick={goPrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 rounded-full h-10 w-10 hidden sm:flex"
              onClick={goNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

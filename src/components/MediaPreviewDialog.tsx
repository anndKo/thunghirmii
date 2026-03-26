import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  urls: string[];
  initialIndex?: number;
  type: 'image' | 'video' | 'mixed';
}

export function MediaPreviewDialog({
  open,
  onOpenChange,
  urls,
  initialIndex = 0,
  type,
}: MediaPreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setLoadedSet(new Set());
      closingRef.current = false;
    }
  }, [open, initialIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); onOpenChange(false); }
    if (e.key === 'ArrowLeft') setCurrentIndex(i => Math.max(0, i - 1));
    if (e.key === 'ArrowRight') setCurrentIndex(i => Math.min(urls.length - 1, i + 1));
  }, [open, urls.length, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown, open]);

  // Preload adjacent images
  useEffect(() => {
    if (!open) return;
    [currentIndex - 1, currentIndex, currentIndex + 1]
      .filter(i => i >= 0 && i < urls.length)
      .forEach(i => {
        const img = new Image();
        img.src = urls[i]; // Use original URL directly
        img.onload = () => setLoadedSet(prev => new Set(prev).add(i));
      });
  }, [open, currentIndex, urls]);

  if (!open || urls.length === 0) return null;

  const currentUrl = urls[currentIndex];
  const isVideo = type === 'video' || (type === 'mixed' && /\.(mp4|webm|mov)/i.test(currentUrl));

  const handleClose = (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!closingRef.current) {
      closingRef.current = true;
      onOpenChange(false);
    }
  };

  // Download original quality as file (no page navigation)
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const originalUrl = currentUrl.split('?')[0];
      const response = await fetch(originalUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const fileName = originalUrl.split('/').pop() || 'image.jpg';
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Click-to-close overlay */}
      <div
        className="absolute inset-0 z-0 cursor-pointer"
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleClose(); }}
      />

      {/* Top bar */}
      <div className="absolute top-4 right-4 z-[10001] flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
        {!isVideo && (
          <button
            type="button"
            disabled={downloading}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleDownload(); }}
            className="p-2 rounded-full bg-black/60 text-white hover:bg-white/30 transition-colors cursor-pointer disabled:opacity-50"
            title="Tải ảnh gốc về máy"
          >
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleClose(); }}
          className="p-2 rounded-full bg-black/60 text-white hover:bg-white/30 transition-colors cursor-pointer"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Counter */}
      {urls.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10001] px-3 py-1 rounded-full bg-black/50 text-white text-sm pointer-events-none">
          {currentIndex + 1} / {urls.length}
        </div>
      )}

      {/* Navigation arrows */}
      {urls.length > 1 && currentIndex > 0 && (
        <button
          type="button"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setCurrentIndex(i => i - 1); }}
          className="absolute left-4 z-[10001] p-2 rounded-full bg-black/60 text-white hover:bg-white/30 transition-colors cursor-pointer"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {urls.length > 1 && currentIndex < urls.length - 1 && (
        <button
          type="button"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setCurrentIndex(i => i + 1); }}
          className="absolute right-4 z-[10001] p-2 rounded-full bg-black/60 text-white hover:bg-white/30 transition-colors cursor-pointer"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Content - render all images hidden, show only current for instant switch */}
      <div
        className="relative z-[10000] max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden flex items-center justify-center"
        style={{ minWidth: 200, minHeight: 200 }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video key={currentUrl} src={currentUrl} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-xl" />
        ) : (
          <>
            {/* Spinner for current if not loaded */}
            {!loadedSet.has(currentIndex) && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="h-10 w-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {/* All images pre-rendered for instant navigation */}
            {urls.map((url, i) => {
              const isVid = (type as string) === 'video' || (type === 'mixed' && /\.(mp4|webm|mov)/i.test(url));
              if (isVid) return null;
              return (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl select-none"
                  draggable={false}
                  loading="eager"
                  decoding="async"
                  onLoad={() => setLoadedSet(prev => new Set(prev).add(i))}
                  style={{
                    display: i === currentIndex ? 'block' : 'none',
                  }}
                />
              );
            })}
          </>
        )}
      </div>
    </div>, document.body
  );
}

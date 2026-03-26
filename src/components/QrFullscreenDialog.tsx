import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

interface QrFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  alt?: string;
}

export function QrFullscreenDialog({ open, onOpenChange, imageUrl, alt = 'Ảnh' }: QrFullscreenDialogProps) {
  const [zoomed, setZoomed] = useState(false);

  const handleDownload = async () => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setZoomed(false); }}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-[90vw] max-h-[95vh] sm:max-h-[90vh] p-0 border-none bg-black/90 backdrop-blur-xl flex items-center justify-center overflow-hidden"
      >
        {/* Top bar */}
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white" onClick={() => setZoomed(!zoomed)} title={zoomed ? 'Thu nhỏ' : 'Phóng to'}>
            {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white" onClick={handleDownload} title="Tải về">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Image */}
        <div className={`w-full h-full flex items-center justify-center p-4 ${zoomed ? 'overflow-auto' : ''}`} onClick={() => !zoomed && onOpenChange(false)}>
          <img
            src={imageUrl}
            alt={alt}
            onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
            className={`rounded-lg shadow-2xl transition-transform duration-300 cursor-zoom-in ${
              zoomed
                ? 'max-w-none w-auto cursor-zoom-out'
                : 'max-w-full max-h-[85vh] object-contain'
            }`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

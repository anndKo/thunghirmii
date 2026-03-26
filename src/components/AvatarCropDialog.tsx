import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (blob: Blob) => void;
}

export function AvatarCropDialog({ open, onOpenChange, imageSrc, onCropComplete }: AvatarCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [fitScale, setFitScale] = useState(1);

  const SIZE = 280;
  const OUT = 512;

  // Load image when dialog opens or src changes
  useEffect(() => {
    if (!open || !imageSrc) return;
    setReady(false);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const fs = SIZE / Math.min(img.width, img.height);
      setFitScale(fs);
      setScale(fs);
      setOffset({ x: 0, y: 0 });
      setReady(true);
    };
    img.onerror = () => {
      console.error('Failed to load image for cropping');
    };
    img.src = imageSrc;
  }, [open, imageSrc]);

  // Draw canvas whenever scale/offset/ready changes
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, SIZE, SIZE);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const x = (SIZE - dw) / 2 + offset.x;
    const y = (SIZE - dh) / 2 + offset.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, dw, dh);
    ctx.restore();

    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [scale, offset, ready]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement('canvas');
    out.width = OUT;
    out.height = OUT;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    const r = OUT / SIZE;
    const dw = img.width * scale * r;
    const dh = img.height * scale * r;
    const x = (OUT - dw) / 2 + offset.x * r;
    const y = (OUT - dh) / 2 + offset.y * r;
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, dw, dh);
    out.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
        onOpenChange(false);
      }
    }, 'image/png', 1.0);
  };

  const img = imgRef.current;
  const minS = img ? SIZE / Math.max(img.width, img.height) * 0.5 : 0.1;
  const maxS = img ? SIZE / Math.min(img.width, img.height) * 3 : 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cắt ảnh đại diện</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab active:cursor-grabbing rounded-full overflow-hidden border-2 border-muted"
            style={{ width: SIZE, height: SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => setDragging(false)}
          >
            <canvas ref={canvasRef} width={SIZE} height={SIZE} className="block" />
          </div>
          <p className="text-xs text-muted-foreground">Kéo để di chuyển, dùng thanh trượt để phóng to/thu nhỏ</p>
          <div className="flex items-center gap-3 w-full max-w-[280px]">
            <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider value={[scale]} min={minS} max={maxS} step={0.01} onValueChange={([v]) => setScale(v)} className="flex-1" />
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Button variant="ghost" size="icon" onClick={() => { setScale(fitScale); setOffset({ x: 0, y: 0 }); }} className="flex-shrink-0 h-8 w-8">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleCrop} disabled={!ready}>Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

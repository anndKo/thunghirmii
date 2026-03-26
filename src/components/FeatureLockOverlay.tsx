// @ts-nocheck
import { useState } from 'react';
import { Lock, Coins, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

interface FeatureLockOverlayProps {
  featureType: string;
  isLocked: boolean;
  cost: number;
  userPoints: number;
  onUnlock: (featureType: string, cost: number) => Promise<boolean>;
  children: React.ReactNode;
  className?: string;
  lockLabel?: string;
}

const LOCK_LABELS: Record<string, string> = {
  view_address: '🔒 Địa chỉ đang bị khóa — Vui lòng mở khóa',
  view_phone: '🔒 Số điện thoại chủ trọ đang bị khóa — Vui lòng mở khóa',
  view_photos: '🔒 Ảnh phòng đang bị khóa — Vui lòng mở khóa',
  view_videos: '🔒 Video phòng đang bị khóa — Vui lòng mở khóa',
  find_nearby: '🔒 Tìm vị trí gần nhất đang bị khóa — Vui lòng mở khóa',
};

export function FeatureLockOverlay({ featureType, isLocked, cost, userPoints, onUnlock, children, className = '', lockLabel }: FeatureLockOverlayProps) {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  if (!isLocked) return <>{children}</>;

  const label = lockLabel || LOCK_LABELS[featureType] || '🔒 Nội dung đang bị khóa — Vui lòng mở khóa';

  const handleUnlockClick = () => {
    if (userPoints < cost) {
      setShowInsufficient(true);
    } else {
      setShowDialog(true);
    }
  };

  const handleConfirm = async () => {
    setUnlocking(true);
    const success = await onUnlock(featureType, cost);
    setUnlocking(false);
    if (success) setShowDialog(false);
  };

  return (
    <>
      <div className={`relative ${className}`}>
        <div className="blur-[6px] pointer-events-none select-none opacity-40">{children}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-muted/30 backdrop-blur-[2px]">
          <p className="text-xs text-muted-foreground mb-2 text-center px-3 font-medium">{label}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnlockClick}
            className="gap-1.5 bg-background/90 backdrop-blur-sm border-primary/30 hover:bg-primary/10 shadow-lg"
          >
            <Lock className="h-3.5 w-3.5" />
            Mở khóa ({cost} điểm)
          </Button>
        </div>
      </div>

      {/* Confirm unlock dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Mở khóa tính năng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-primary" />
                <span>Điểm của bạn</span>
              </div>
              <span className="font-bold text-primary">{userPoints}</span>
            </div>
            <div className="flex items-center justify-center py-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 rounded-2xl px-6 py-3 text-center">
                <Coins className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">-{cost}</p>
                <p className="text-xs text-muted-foreground">điểm cần tiêu thụ</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={handleConfirm} disabled={unlocking} className="w-full bg-gradient-primary hover:opacity-90">
              {unlocking ? 'Đang xử lý...' : 'Xác nhận mở khóa'}
            </Button>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="w-full">Hủy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insufficient points dialog */}
      <Dialog open={showInsufficient} onOpenChange={setShowInsufficient}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">⚠️ Thông báo</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">Số dư điểm không đủ</p>
            <p className="text-sm text-muted-foreground mt-1">Bạn cần <strong className="text-primary">{cost} điểm</strong> nhưng chỉ có <strong>{userPoints} điểm</strong>.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowInsufficient(false); navigate('/wallet'); }} className="w-full bg-gradient-primary hover:opacity-90 gap-2">
              <Wallet className="h-4 w-4" /> Xem ví điểm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// @ts-nocheck
import { Lock, MapPin, Phone, Image, Video, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface LockedFeature {
  type: string;
  label: string;
  icon: React.ReactNode;
  cost: number;
}

interface LockedFeaturesNoticeProps {
  lockedFeatures: LockedFeature[];
  userPoints: number;
  onUnlock: (featureType: string, cost: number) => void;
}

export function LockedFeaturesNotice({ lockedFeatures, userPoints, onUnlock }: LockedFeaturesNoticeProps) {
  if (lockedFeatures.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Một số nội dung đang bị khóa
          </p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Bạn có muốn mở khóa bằng điểm không?</p>
        <div className="space-y-2">
          {lockedFeatures.map((feat) => (
            <div key={feat.type} className="flex items-center justify-between bg-background/80 rounded-lg px-3 py-2 border border-border/50">
              <div className="flex items-center gap-2">
                {feat.icon}
                <span className="text-xs font-medium">{feat.label}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-primary/30 hover:bg-primary/10"
                onClick={() => onUnlock(feat.type, feat.cost)}
              >
                <Coins className="h-3 w-3 text-amber-500" />
                {feat.cost} điểm
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Coins className="h-3 w-3" />
          <span>Điểm hiện có: <strong className="text-primary">{userPoints}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
}

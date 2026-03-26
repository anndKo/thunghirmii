import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Loader2, Check, Navigation } from 'lucide-react';
import { getAccuratePosition } from '@/lib/gps-accuracy';

interface LocationCaptureProps {
  onLocationCaptured: (lat: number, lng: number) => void;
  currentLocation?: { lat: number; lng: number } | null;
  required?: boolean;
}

export function LocationCapture({ 
  onLocationCaptured, 
  currentLocation,
  required = true 
}: LocationCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const { toast } = useToast();

  const captureLocation = async () => {
    setLoading(true);
    setStatusText('Đang xác định vị trí chính xác...');

    try {
      const pos = await getAccuratePosition();
      onLocationCaptured(pos.lat, pos.lng);
      toast({
        title: 'Đã lấy vị trí chính xác!',
        description: `Tọa độ: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`,
      });
    } catch (err: any) {
      toast({
        title: 'Lỗi định vị',
        description: err.message || 'Không thể lấy vị trí',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Vị trí phòng trọ {required && <span className="text-destructive">*</span>}
          </span>
        </div>
        {currentLocation && (
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" />
            Đã có tọa độ
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={currentLocation ? "outline" : "default"}
          onClick={captureLocation}
          disabled={loading}
          className={!currentLocation ? "bg-gradient-primary hover:opacity-90" : ""}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Đang xác định...' : currentLocation ? 'Cập nhật vị trí' : 'Bật định vị'}
        </Button>
      </div>

      {loading && statusText && (
        <p className="text-xs text-primary animate-pulse">{statusText}</p>
      )}

      {currentLocation && !loading && (
        <p className="text-xs text-muted-foreground">
          Tọa độ: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
        </p>
      )}

      {required && !currentLocation && !loading && (
        <p className="text-xs text-destructive">
          Bắt buộc phải bật định vị để lấy tọa độ phòng trọ
        </p>
      )}
    </div>
  );
}

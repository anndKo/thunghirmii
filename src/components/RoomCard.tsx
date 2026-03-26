// @ts-nocheck
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Maximize } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useExchangeConfig } from '@/hooks/useExchangeConfig';

interface Room {
  id: string; title: string; room_number: string; price: number; area: number | null;
  province: string; district: string; ward: string; address_detail: string;
  phone: string; images: string[] | null; is_available: boolean;
}

interface RoomCardProps {
  room: Room;
  showActions?: boolean;
  onSendRequest?: (roomId: string) => void;
}

export function RoomCard({ room, showActions = true, onSendRequest }: RoomCardProps) {
  const { t } = useLanguage();
  const exchangeConfig = useExchangeConfig();

  const isLocked = (feat: string) => exchangeConfig?.enabled && exchangeConfig?.features?.[feat]?.enabled;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(price);
  };

  const defaultImage = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop';

  return (
    <Card className={`card-hover overflow-hidden group h-full flex flex-col ${!room.is_available ? 'border-l-4 border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10' : ''}`}>
      <div className="relative aspect-[4/3] overflow-hidden">
        {!room.is_available && (
          <div className="absolute top-1 left-1 z-10">
            <div className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-white animate-pulse" />
          </div>
        )}
        <img src={room.images?.[0] || defaultImage} alt={room.title} className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${isLocked('view_photos') ? 'blur-md' : ''}`} />
        <Badge className={`absolute top-3 right-3 ${room.is_available ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
          {room.is_available ? t('available') : t('rented')}
        </Badge>
        <div className="absolute bottom-3 left-3">
          <div className="bg-gradient-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm">
            <p className="text-base sm:text-lg font-bold">
              {formatPrice(room.price)}
              <span className="text-sm font-normal opacity-90">{t('perMonth')}</span>
            </p>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold line-clamp-1 mb-2">{room.title}</h3>
        <p className="text-sm text-muted-foreground mb-1">{t('roomNumber')}: {room.room_number}</p>
        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
          <span className={`line-clamp-2 ${isLocked('view_address') ? 'blur-sm select-none' : ''}`}>
            {room.address_detail}, {room.ward}, {room.district}, {room.province}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {room.area && (
            <div className="flex items-center gap-1"><Maximize className="h-4 w-4 text-primary" /><span>{room.area} {t('sqm')}</span></div>
          )}
          <div className="flex items-center gap-1">
            <Phone className="h-4 w-4 text-primary" />
            <span className={isLocked('view_phone') ? 'blur-sm select-none' : ''}>{room.phone}</span>
          </div>
        </div>
      </CardContent>
      
      {showActions && (
        <CardFooter className="p-4 pt-0 flex gap-2">
          <Button
            asChild
            className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white shadow-md rounded-xl"
          >
            <Link to={`/rooms/${room.id}`}>{t('viewRoom')}</Link>
          </Button>
          {onSendRequest && room.is_available && (
            <Button onClick={() => onSendRequest(room.id)} className="flex-1 bg-gradient-primary hover:opacity-90">{t('sendRequest')}</Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

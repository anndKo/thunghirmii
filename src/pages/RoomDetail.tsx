// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ChatPanel } from '@/components/ChatPanel';
import { ImageFullscreenViewer } from '@/components/ImageFullscreenViewer';
import { ReportDialog } from '@/components/ReportDialog';
import { NearbyRoomsSuggestion } from '@/components/NearbyRoomsSuggestion';
import { FeatureLockOverlay } from '@/components/FeatureLockOverlay';
import { LockedFeaturesNotice } from '@/components/LockedFeaturesNotice';
import { useExchangeConfig } from '@/hooks/useExchangeConfig';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  ArrowLeft, MapPin, Phone, Maximize, 
  Loader2, ChevronLeft, ChevronRight, Play, X, MessageCircle,
  Zap, Droplets, Receipt, Navigation, Flag, Check
} from 'lucide-react';

interface CustomService {
  name: string;
  cost: number;
}

interface Room {
  id: string;
  title: string;
  room_number: string;
  room_code: string;
  description: string | null;
  price: number;
  area: number | null;
  province: string;
  district: string;
  ward: string;
  address_detail: string;
  phone: string;
  amenities: string[] | null;
  images: string[] | null;
  videos: string[] | null;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  electricity_cost: number | null;
  water_cost: number | null;
  water_cost_type: string | null;
  custom_services: CustomService[] | null;
  tenant_id: string | null;
  landlord_id: string | null;
  contract_content: string | null;
  deposit_amount: number | null;
}

export default function RoomDetail() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromMyRoom = searchParams.get('from') === 'myroom';
  const fromAdmin = searchParams.get('from') === 'admin';
  const fromRequestId = searchParams.get('requestId') || '';
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [showFullscreenImages, setShowFullscreenImages] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [isCurrentTenant, setIsCurrentTenant] = useState(false);
  const [showNearbySuggestion, setShowNearbySuggestion] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [userUnlocks, setUserUnlocks] = useState<Set<string>>(new Set());
  const exchangeConfig = useExchangeConfig();

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  
  // Chat panel state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAdminId, setChatAdminId] = useState<string | null>(null);
  const [directionsModalOpen, setDirectionsModalOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const { user, role } = useAuth();
  const { toast } = useToast();
  const { sendMessage, findAdminUser } = useMessages();

  useEffect(() => {
    if (id) {
      fetchRoom();
    }
  }, [id]);

  // Check if current user is the tenant of this room
  useEffect(() => {
    if (room && user && room.tenant_id === user.id) {
      setIsCurrentTenant(true);
    } else {
      setIsCurrentTenant(false);
    }
  }, [room, user]);

  // Pre-fill user info
  useEffect(() => {
    if (user && requestDialogOpen) {
      fetchUserProfile();
    }
  }, [user, requestDialogOpen]);

  // Fetch user points and unlocks
  useEffect(() => {
    if (!user || !id) return;
    Promise.all([
      supabase.from('user_points').select('total_points').eq('user_id', user.id).single(),
      supabase.from('user_unlocks').select('feature_type').eq('user_id', user.id).eq('room_id', id),
    ]).then(([ptsRes, unlocksRes]) => {
      setUserPoints(ptsRes.data?.total_points || 0);
      const set = new Set<string>();
      (unlocksRes.data || []).forEach((u: any) => set.add(u.feature_type));
      setUserUnlocks(set);
    });
  }, [user, id]);

  const isFeatureLocked = (featureType: string) => {
    if (!exchangeConfig?.enabled) return false;
    const feat = exchangeConfig.features?.[featureType];
    if (!feat?.enabled) return false;
    return !userUnlocks.has(featureType);
  };

  const getFeatureCost = (featureType: string) => {
    return exchangeConfig?.features?.[featureType]?.points || 0;
  };

  const handleUnlock = async (featureType: string, cost: number): Promise<boolean> => {
    if (!user || !id) return false;
    // Deduct points
    const newPoints = userPoints - cost;
    const { error: ptsErr } = await supabase.from('user_points').update({ total_points: newPoints, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (ptsErr) return false;
    // Record unlock
    const { error: unlockErr } = await supabase.from('user_unlocks').insert({ user_id: user.id, room_id: id, feature_type: featureType, points_spent: cost });
    if (unlockErr) { 
      // Revert points
      await supabase.from('user_points').update({ total_points: userPoints }).eq('user_id', user.id);
      return false; 
    }
    setUserPoints(newPoints);
    setUserUnlocks(prev => new Set(prev).add(featureType));
    return true;
  };

  const fetchRoom = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setRoom(data as unknown as Room);
      // Dispatch reward event for view_room
      window.dispatchEvent(new CustomEvent('reward-action', { detail: { actionType: 'view_room' } }));
    }
    setLoading(false);
  };

  const fetchUserProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setRequestName(profile.full_name || '');
      setRequestPhone(profile.phone || '');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const allImages = room?.images || [];
  const allVideos = room?.videos || [];

  const handlePrevImage = () => {
    setCurrentMediaIndex((prev) => 
      prev === 0 ? allImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentMediaIndex((prev) => 
      prev === allImages.length - 1 ? 0 : prev + 1
    );
  };

  const handleSendRequest = () => {
    if (!user) {
      toast({ title: t('pleaseLogin'), description: t('loginToSendRequest'), variant: 'destructive' });
      return;
    }
    if (role !== 'tenant') {
      toast({ title: t('noPermission'), description: t('onlyTenantCanRequest'), variant: 'destructive' });
      return;
    }

    setRequestDialogOpen(true);
  };

  const submitRequest = async () => {
    if (!room || !user) return;

    if (!requestName.trim() || !requestPhone.trim()) {
      toast({ title: t('error'), description: t('fillAllFields'), variant: 'destructive' });
      return;
    }

    setSendingRequest(true);

    // Update profile with provided info
    await supabase
      .from('profiles')
      .update({
        full_name: requestName,
        phone: requestPhone,
      })
      .eq('user_id', user.id);

    // Create room request
    const { error } = await supabase.from('room_requests').insert({
      room_id: room.id,
      tenant_id: user.id,
      message: requestMessage,
    });

    if (error) {
      toast({ title: t('error'), description: t('cannotSendRequest'), variant: 'destructive' });
      setSendingRequest(false);
      return;
    }

    // Dispatch reward event for send_request
    window.dispatchEvent(new CustomEvent('reward-action', { detail: { actionType: 'send_request' } }));

    // Find admin and send auto-message
    const adminId = await findAdminUser();
    
    if (adminId) {
      const fullAddress = [room.address_detail, room.ward, room.district, room.province]
        .filter(Boolean)
        .join(', ');

      const autoMessage = `🏠 YÊU CẦU THUÊ PHÒNG

📋 Thông tin phòng:
- Tiêu đề: ${room.title}
- Số phòng: ${room.room_number}
- Mã phòng: ${room.room_code}
- Giá: ${formatPrice(room.price)}/tháng
${room.area ? `- Diện tích: ${room.area} m²` : ''}
- Địa chỉ: ${fullAddress}

👤 Thông tin người thuê:
- Họ tên: ${requestName}
- SĐT: ${requestPhone}
${requestMessage ? `\n💬 Lời nhắn: ${requestMessage}` : ''}

Tôi muốn thuê phòng này, xin Admin xem xét và liên hệ lại với tôi.`;

      // Send message first
      await sendMessage(adminId, autoMessage, room.id);
      
      // Close dialog and show toast
      setSendingRequest(false);
      setRequestDialogOpen(false);
      setRequestMessage('');
      
      toast({ title: t('success'), description: t('requestSent') });
      
      // Set admin ID and open chat panel immediately
      setChatAdminId(adminId);
      setChatOpen(true);
      setShowNearbySuggestion(true);
    } else {
      setSendingRequest(false);
      setRequestDialogOpen(false);
      setRequestMessage('');
      
      toast({ title: t('success'), description: t('requestSent') });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !room) {
    return <Navigate to="/rooms" replace />;
  }

  const fullAddress = [room.address_detail, room.ward, room.district, room.province]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-8">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => {
            if (fromAdmin) {
              navigate(`/admin?tab=requests&highlight=${fromRequestId}`);
            } else if (fromMyRoom) {
              navigate('/tenant?tab=myroom');
            } else {
              navigate('/rooms');
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {fromAdmin ? t('backToRequests') : fromMyRoom ? t('backToMyRoom') : t('backToList')}
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="space-y-4">
            {allImages.length > 0 ? (
              <FeatureLockOverlay featureType="view_photos" isLocked={isFeatureLocked('view_photos')} cost={getFeatureCost('view_photos')} userPoints={userPoints} onUnlock={handleUnlock}>
                <div>
                <div 
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted cursor-pointer"
                  onClick={() => setShowFullscreenImages(true)}
                >
                  <img
                    src={allImages[currentMediaIndex]}
                    alt={room.title}
                    className="h-full w-full object-cover"
                  />
                  {allImages.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2"
                        onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-1 rounded text-sm">
                        {currentMediaIndex + 1} / {allImages.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnails */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 mt-4">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentMediaIndex(idx)}
                        className={`flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                          idx === currentMediaIndex ? 'border-primary' : 'border-transparent'
                        }`}
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </FeatureLockOverlay>
            ) : (
              <div className="aspect-[4/3] rounded-xl bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">{t('na')}</p>
              </div>
            )}

            {/* Videos */}
            {allVideos.length > 0 && (
              <FeatureLockOverlay featureType="view_videos" isLocked={isFeatureLocked('view_videos')} cost={getFeatureCost('view_videos')} userPoints={userPoints} onUnlock={handleUnlock}>
              <div className="space-y-2">
                <h3 className="font-medium">Video ({allVideos.length})</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {allVideos.map((video, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedVideoIndex(idx);
                        setShowVideoModal(true);
                      }}
                      className="flex-shrink-0 h-20 w-32 rounded-lg overflow-hidden bg-muted relative hover:opacity-80 transition-opacity"
                    >
                      <video
                        src={video}
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover"
                        onLoadedData={(e) => {
                          const v = e.currentTarget;
                          v.currentTime = 1;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              </FeatureLockOverlay>
            )}
          </div>

          {/* Room Info */}
          <div className="space-y-6">
            {/* Locked features notice */}
            {(() => {
              const locked = [];
              if (isFeatureLocked('view_address')) locked.push({ type: 'view_address', label: 'Xem địa chỉ', icon: <MapPin className="h-4 w-4 text-primary" />, cost: getFeatureCost('view_address') });
              if (isFeatureLocked('view_phone')) locked.push({ type: 'view_phone', label: 'Xem số điện thoại chủ trọ', icon: <Phone className="h-4 w-4 text-primary" />, cost: getFeatureCost('view_phone') });
              if (isFeatureLocked('view_photos')) locked.push({ type: 'view_photos', label: 'Xem ảnh phòng', icon: <Maximize className="h-4 w-4 text-primary" />, cost: getFeatureCost('view_photos') });
              if (isFeatureLocked('view_videos')) locked.push({ type: 'view_videos', label: 'Xem video phòng', icon: <Play className="h-4 w-4 text-primary" />, cost: getFeatureCost('view_videos') });
              return locked.length > 0 ? (
                <LockedFeaturesNotice
                  lockedFeatures={locked}
                  userPoints={userPoints}
                  onUnlock={(type, cost) => {
                    if (userPoints < cost) {
                      toast({ title: '⚠️ Không đủ điểm', description: `Bạn cần ${cost} điểm nhưng chỉ có ${userPoints} điểm`, variant: 'destructive' });
                    } else {
                      handleUnlock(type, cost);
                    }
                  }}
                />
              ) : null;
            })()}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-2xl font-bold">{room.title}</h1>
                <div className="flex items-center gap-2">
                  {!isCurrentTenant && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => setReportOpen(true)}
                    >
                      <Flag className="h-4 w-4" />
                      {t('reportRoom')}
                    </Button>
                  )}
                  <Badge variant={room.is_available ? "default" : "secondary"}>
                    {room.is_available ? t('available') : t('rented')}
                  </Badge>
                </div>
              </div>
              <p className="text-muted-foreground">{t('roomNumber')}: {room.room_number} | {t('roomCode')}: <span className="font-mono font-semibold">{room.room_code}</span></p>
            </div>

            {/* Price with nice background */}
            <div className="inline-block">
              <div className="bg-gradient-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg">
                <span className="text-3xl font-bold">{formatPrice(room.price)}</span>
                <span className="text-lg opacity-90">{t('perMonth')}</span>
              </div>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                {room.area && (
                  <div className="flex items-center gap-3">
                    <Maximize className="h-5 w-5 text-primary" />
                    <span>{t('area')}: {room.area} {t('sqm')}</span>
                  </div>
                )}
                <FeatureLockOverlay featureType="view_address" isLocked={isFeatureLocked('view_address')} cost={getFeatureCost('view_address')} userPoints={userPoints} onUnlock={handleUnlock}>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{fullAddress || t('na')}</span>
                  </div>
                </FeatureLockOverlay>
                <FeatureLockOverlay featureType="view_phone" isLocked={isFeatureLocked('view_phone')} cost={getFeatureCost('view_phone')} userPoints={userPoints} onUnlock={handleUnlock}>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <span>{room.phone}</span>
                  </div>
                </FeatureLockOverlay>
              </CardContent>
            </Card>

            {room.description && (
              <div>
                <h3 className="font-semibold mb-2">{t('description')}</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{room.description}</p>
              </div>
            )}

            {room.amenities && room.amenities.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">{t('amenities')}</h3>
                <div className="flex flex-wrap gap-2">
                  {room.amenities.map((amenity, idx) => (
                    <Badge key={idx} variant="outline">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Chi phí dịch vụ */}
            {(room.electricity_cost || room.water_cost || (room.custom_services && (room.custom_services as CustomService[]).length > 0)) && (
              <div className="space-y-3">
                <h3 className="font-semibold">{t('electricityCost')}/{t('waterCost')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {room.electricity_cost && (
                    <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
                      <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('electricityCost')}</p>
                        <p className="font-semibold text-sm">{new Intl.NumberFormat('vi-VN').format(room.electricity_cost)}đ/kWh</p>
                      </div>
                    </div>
                  )}
                  {room.water_cost && (
                    <div className="flex items-center gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5">
                      <Droplets className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('waterCost')}</p>
                        <p className="font-semibold text-sm">{new Intl.NumberFormat('vi-VN').format(room.water_cost)}đ/{room.water_cost_type === 'per_month' ? 'tháng' : 'm³'}</p>
                      </div>
                    </div>
                  )}
                  {room.custom_services && (room.custom_services as CustomService[]).map((service, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 bg-muted/50 border rounded-lg px-3 py-2.5">
                      <Receipt className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{service.name}</p>
                        <p className="font-semibold text-sm">{new Intl.NumberFormat('vi-VN').format(service.cost)}đ</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hợp đồng trọ */}
            {((room as any).contract_content || (room as any).deposit_amount) && (
              <div className="space-y-0">
                <div className="relative border-2 border-primary/20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/5">
                  {/* Header */}
                  <div className="bg-primary/10 border-b border-primary/20 px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-2xl">📋</span>
                      <h3 className="text-lg font-bold text-primary tracking-wide uppercase">Hợp đồng thuê trọ</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">Thông tin cam kết giữa chủ trọ và người thuê</p>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    {/* Tiền cọc */}
                    {(room as any).deposit_amount && (
                      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💰</span>
                          <span className="font-medium text-sm">Tiền đặt cọc</span>
                        </div>
                        <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
                          {new Intl.NumberFormat('vi-VN').format((room as any).deposit_amount)}đ
                        </span>
                      </div>
                    )}

                    {/* Nội dung hợp đồng */}
                    {(room as any).contract_content && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span>📝</span>
                          <span>Nội dung & Điều khoản</span>
                        </div>
                        <div className="bg-muted/40 rounded-xl p-4 border border-border/50">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {(room as any).contract_content}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-primary/10 px-5 py-3 bg-muted/30 text-center">
                    <p className="text-[11px] text-muted-foreground italic">
                      ⚠️ Lưu ý: Vui lòng đọc kỹ trước khi thuê. Liên hệ chủ trọ để xác nhận chi tiết.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {room.is_available && (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setAddressCopied(false);
                    setDirectionsModalOpen(true);
                  }}
                >
                  <Navigation className="h-5 w-5 mr-2" />
                  {t('getDirections')}
                </Button>
                <Button 
                  onClick={handleSendRequest}
                  className="w-full bg-gradient-primary hover:opacity-90"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  {t('sendRentalRequest')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl p-0 max-h-[90vh] overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 bg-background/80 hover:bg-background"
            onClick={() => setShowVideoModal(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          {allVideos[selectedVideoIndex] && (
            <video
              src={allVideos[selectedVideoIndex]}
              controls
              autoPlay
              className="w-full max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Request Dialog - With Personal Info */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sendRentalRequest')}</DialogTitle>
            <DialogDescription>{t('requestDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('fullName')} *</Label>
              <Input
                id="name"
                placeholder="Nguyễn Văn A"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phoneNumber')} *</Label>
              <Input
                id="phone"
                placeholder="0901234567"
                value={requestPhone}
                onChange={(e) => setRequestPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">{t('messageOptional')}</Label>
              <Textarea
                id="message"
                placeholder={t('messagePlaceholder')}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button 
              onClick={submitRequest} 
              disabled={sendingRequest}
              className="bg-gradient-primary hover:opacity-90"
            >
              {sendingRequest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('sendRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Directions Modal */}
      <Dialog open={directionsModalOpen} onOpenChange={setDirectionsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              📍 Tìm đường đến trọ
            </DialogTitle>
            <DialogDescription>
              Vui lòng sao chép địa chỉ trước khi mở bản đồ để đảm bảo bạn có thể dán địa chỉ nếu cần.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-xl p-4 border border-border">
              <p className="text-sm font-medium text-foreground break-words">{fullAddress}</p>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(fullAddress).then(() => {
                  setAddressCopied(true);
                  toast({ title: '✅ Đã sao chép địa chỉ' });
                }).catch(() => {
                  toast({ title: 'Không thể sao chép', variant: 'destructive' });
                });
              }}
            >
              {addressCopied ? <Check className="h-4 w-4 text-green-500" /> : null}
              {addressCopied ? 'Đã sao chép' : 'Sao chép địa chỉ'}
            </Button>
            <Button
              className="w-full bg-gradient-primary hover:opacity-90 gap-2"
              disabled={!addressCopied}
              onClick={() => {
                const dest = room.latitude && room.longitude
                  ? `${room.latitude},${room.longitude}`
                  : encodeURIComponent(fullAddress);
                window.open('https://www.google.com/maps/dir/?api=1', '_blank');
              }}
            >
              <Navigation className="h-4 w-4" />
              Tìm đường
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Viewer */}
      <ImageFullscreenViewer
        images={allImages}
        initialIndex={currentMediaIndex}
        open={showFullscreenImages}
        onOpenChange={setShowFullscreenImages}
      />

      {/* Nearby rooms suggestion after sending request */}
      {showNearbySuggestion && room && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[92%] max-w-md">
            <NearbyRoomsSuggestion roomId={room.id} roomLat={room.latitude} roomLng={room.longitude} onClose={() => setShowNearbySuggestion(false)} />
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <ChatPanel 
        open={chatOpen} 
        onOpenChange={(v) => { setChatOpen(v); if (!v) setShowNearbySuggestion(false); }}
        initialUserId={chatAdminId || undefined}
      />

      {/* Report Dialog */}
      {room && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          roomId={room.id}
          roomTitle={room.title}
          roomCode={room.room_code}
          reporterId={user?.id}
        />
      )}
    </div>
  );
}

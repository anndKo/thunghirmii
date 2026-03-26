// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { RoomCard } from '@/components/RoomCard';
import { PriceInput } from '@/components/PriceInput';
import { NearbyMap } from '@/components/NearbyMap';
import { FeatureLockOverlay } from '@/components/FeatureLockOverlay';
import { useExchangeConfig } from '@/hooks/useExchangeConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from
'@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Filter, X, Loader2, Search, MapPin, Navigation, Lock, Coins, Wallet } from 'lucide-react';
import { LocationPermissionDialog } from '@/components/LocationPermissionDialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface Room {
  id: string;title: string;room_number: string;price: number;area: number | null;
  province: string;district: string;ward: string;address_detail: string;
  description: string | null;phone: string;images: string[] | null;is_available: boolean;
}

export default function Rooms() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [addressSearch, setAddressSearch] = useState('');
  const [showNearbyMap, setShowNearbyMap] = useState(false);
  const [showLocationPermission, setShowLocationPermission] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [showNearbyLock, setShowNearbyLock] = useState(false);
  const [nearbyLockCost, setNearbyLockCost] = useState(0);
  const [userPoints, setUserPoints] = useState(0);
  const { user, role } = useAuth();
  const { toast } = useToast();
  const exchangeConfig = useExchangeConfig();

  // Fetch user points for nearby lock
  useEffect(() => {
    if (!user) return;
    supabase.from('user_points').select('total_points').eq('user_id', user.id).single()
      .then(({ data }) => setUserPoints(data?.total_points || 0));
  }, [user]);

  const isNearbyLocked = () => {
    if (!exchangeConfig?.enabled) return false;
    const feat = exchangeConfig.features?.find_nearby;
    return feat?.enabled || false;
  };

  const handleNearbyClick = async () => {
    if (isNearbyLocked()) {
      const cost = exchangeConfig.features?.find_nearby?.points || 0;
      // Check if already unlocked today
      if (user) {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase.from('user_unlocks')
          .select('id').eq('user_id', user.id).eq('feature_type', 'find_nearby')
          .gte('created_at', today + 'T00:00:00').maybeSingle();
        if (existing) {
          // Already unlocked today, proceed
          proceedWithNearby();
          return;
        }
      }
      setNearbyLockCost(cost);
      setShowNearbyLock(true);
      return;
    }
    proceedWithNearby();
  };

  const handleNearbyUnlock = async () => {
    if (!user) return;
    const cost = nearbyLockCost;
    if (userPoints < cost) {
      toast({ title: '⚠️ Không đủ điểm', description: `Bạn cần ${cost} điểm`, variant: 'destructive' });
      return;
    }
    const newPts = userPoints - cost;
    await supabase.from('user_points').update({ total_points: newPts }).eq('user_id', user.id);
    await supabase.from('user_unlocks').insert({ user_id: user.id, feature_type: 'find_nearby', points_spent: cost });
    setUserPoints(newPts);
    setShowNearbyLock(false);
    proceedWithNearby();
  };

  const proceedWithNearby = () => {
    navigator.geolocation.getCurrentPosition(
      () => {
        window.dispatchEvent(new CustomEvent('reward-action', { detail: { actionType: 'find_nearby' } }));
        setShowNearbyMap(true);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setShowLocationPermission(true);
        } else {
          setShowNearbyMap(true);
        }
      }
    );
  };

  const calculateSimilarity = (room: Room, searchTerm: string): number => {
    if (!searchTerm) return 0;
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    if (searchWords.length === 0) return 0;
    const fields = [
    { text: `${room.address_detail} ${room.ward} ${room.district} ${room.province}`.toLowerCase(), weight: 10 },
    { text: room.title.toLowerCase(), weight: 8 },
    { text: room.description?.toLowerCase() || '', weight: 5 }];

    let score = 0;
    const fullSearch = searchTerm.toLowerCase();
    fields.forEach((f) => {if (f.text.includes(fullSearch)) score += f.weight * 10;});
    searchWords.forEach((word) => {fields.forEach((f) => {if (f.text.includes(word)) score += f.weight;});});
    return score;
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('rooms').select('*').eq('is_available', true).eq('approval_status', 'approved');
    const minPriceNum = parseInt(minPrice);
    const maxPriceNum = parseInt(maxPrice);
    if (!isNaN(minPriceNum) && minPriceNum > 0) query = query.gte('price', minPriceNum);
    if (!isNaN(maxPriceNum) && maxPriceNum > 0) query = query.lte('price', maxPriceNum);
    const { data, error } = await query;
    if (error) {
      toast({ title: t('error'), description: t('cannotLoadRooms'), variant: 'destructive' });
      setRooms([]);
    } else {
      // Shuffle rooms randomly on each load
      const shuffled = [...(data as Room[])].sort(() => Math.random() - 0.5);
      setRooms(shuffled);
    }
    setLoading(false);
  }, [minPrice, maxPrice, toast, t]);

  useEffect(() => {fetchRooms();}, [fetchRooms]);

  const urlSearchQuery = searchParams.get('search') || '';
  useEffect(() => {if (urlSearchQuery && !addressSearch) setAddressSearch(urlSearchQuery);}, [urlSearchQuery]);
  const activeSearch = addressSearch || urlSearchQuery;

  const filteredRooms = useMemo(() => {
    if (!activeSearch) return rooms;
    return rooms.map((room) => ({ room, score: calculateSimilarity(room, activeSearch) })).
    filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.room);
  }, [rooms, activeSearch]);

  const topSuggestedRooms = useMemo(() => {
    return rooms.filter((r) => (r as any).priority > 0).sort((a, b) => ((b as any).priority || 0) - ((a as any).priority || 0)).slice(0, 6);
  }, [rooms]);

  const handleSendRequest = (roomId: string) => {
    if (!user) {toast({ title: t('pleaseLogin'), description: t('loginToSendRequest'), variant: 'destructive' });return;}
    if (role !== 'tenant') {toast({ title: t('noPermission'), description: t('onlyTenantCanRequest'), variant: 'destructive' });return;}
    setSelectedRoomId(roomId);
    setRequestDialogOpen(true);
  };

  const submitRequest = async () => {
    if (!selectedRoomId || !user) return;
    setSendingRequest(true);
    const { error } = await supabase.from('room_requests').insert({ room_id: selectedRoomId, tenant_id: user.id, message: requestMessage });
    setSendingRequest(false);
    if (error) {
      toast({ title: t('error'), description: t('cannotSendRequest'), variant: 'destructive' });
    } else {
      toast({ title: t('success'), description: t('requestSent') });
      window.dispatchEvent(new CustomEvent('reward-action', { detail: { actionType: 'send_request' } }));
      setRequestDialogOpen(false);setRequestMessage('');setSelectedRoomId(null);
    }
  };

  const clearFilters = () => {setAddressSearch('');setMinPrice('');setMaxPrice('');};

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <div className="container px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">{t('findRoomTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('roomsFound', { count: filteredRooms.length })}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleNearbyClick} className="gap-1.5 text-xs sm:text-sm">
              <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{t('nearestSearch')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden text-xs sm:text-sm">
              {showFilters ? <X className="h-3.5 w-3.5 mr-1" /> : <Filter className="h-3.5 w-3.5 mr-1" />}{t('filters')}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className={`${showFilters ? 'block' : 'hidden'} md:block lg:col-span-1`}>
            <Card className="sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5" />{t('searchFilters')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2"><MapPin className="h-4 w-4" />{t('address')}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t('addressSearchPlaceholder')} value={addressSearch} onChange={(e) => setAddressSearch(e.target.value)} className="pl-10" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('nearestFirst')}</p>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">{t('priceRange')}</Label>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-0 items-start">
                    <PriceInput value={minPrice} onChange={setMinPrice} label="" placeholder={t('from')} suggestions={[1000000, 2000000, 3000000, 4000000, 5000000, 6000000]} />
                    <div className="flex items-stretch justify-center px-1.5 pt-1"><div className="w-px bg-border/60 min-h-[120px]" /></div>
                    <PriceInput value={maxPrice} onChange={setMaxPrice} label="" placeholder={t('to')} suggestions={[1000000, 2000000, 3000000, 4000000, 5000000, 6000000]} />
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={() => {fetchRooms();setShowFilters(false);}} className="w-full bg-gradient-primary hover:opacity-90">{t('applyFilters')}</Button>
                  <Button variant="outline" onClick={clearFilters} className="w-full">{t('clearFilters')}</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {loading ?
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
            filteredRooms.length > 0 ?
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredRooms.map((room) => <RoomCard key={room.id} room={room} showActions={true} onSendRequest={handleSendRequest} />)}
              </div> :

            <div>
                <div className="text-center py-12">
                  <p className="text-muted-foreground">{t('noRoomsFound')}</p>
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>{t('clearFilters')}</Button>
                </div>
                {topSuggestedRooms.length > 0 &&
              <div className="mt-8 border-t pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      
                      <h3 className="text-lg font-semibold">{t('suggestedTopRooms')}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{t('suggestedTopRoomsDesc')}</p>
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {topSuggestedRooms.map((room) => <RoomCard key={room.id} room={room} showActions={true} onSendRequest={handleSendRequest} />)}
                    </div>
                  </div>
              }
              </div>
            }
          </div>
        </div>
      </div>

      <LocationPermissionDialog open={showLocationPermission} onOpenChange={setShowLocationPermission} onAccept={() => setShowNearbyMap(true)} />
      <NearbyMap open={showNearbyMap} onOpenChange={setShowNearbyMap} />

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sendRentalRequest')}</DialogTitle>
            <DialogDescription>{t('requestDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">{t('messageOptional')}</Label>
              <Textarea id="message" placeholder={t('messagePlaceholder')} value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={submitRequest} disabled={sendingRequest} className="bg-gradient-primary hover:opacity-90">
              {sendingRequest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('sendRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nearby Lock Dialog */}
      <Dialog open={showNearbyLock} onOpenChange={setShowNearbyLock}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" /> Mở khóa tìm gần đây
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span>Điểm của bạn</span>
              </div>
              <span className="font-bold text-primary">{userPoints}</span>
            </div>
            <div className="flex items-center justify-center py-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 rounded-2xl px-6 py-3 text-center">
                <Coins className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">-{nearbyLockCost}</p>
                <p className="text-xs text-muted-foreground">điểm cần tiêu thụ</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            {userPoints >= nearbyLockCost ? (
              <Button onClick={handleNearbyUnlock} className="w-full bg-gradient-primary hover:opacity-90">
                Xác nhận mở khóa
              </Button>
            ) : (
              <Button onClick={() => { setShowNearbyLock(false); window.location.href = '/wallet'; }} className="w-full bg-gradient-primary hover:opacity-90 gap-2">
                <Wallet className="h-4 w-4" /> Xem ví điểm
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowNearbyLock(false)} className="w-full">Hủy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}
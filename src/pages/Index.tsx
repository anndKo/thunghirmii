// @ts-nocheck
import { useState, useEffect, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RoomCard } from '@/components/RoomCard';
import HomepageBottomSections from '@/components/HomepageBottomSections';
import { useExchangeConfig } from '@/hooks/useExchangeConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
'@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Search, MapPin, Building2, Users, Shield, ArrowRight, Sparkles, Navigation, LocateFixed, User, Lock, Coins, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { NearbyMap } from '@/components/NearbyMap';
import { LocationPermissionDialog } from '@/components/LocationPermissionDialog';

interface Room {
  id: string;
  title: string;
  room_number: string;
  price: number;
  area: number | null;
  province: string;
  district: string;
  ward: string;
  address_detail: string;
  phone: string;
  images: string[] | null;
  is_available: boolean;
}

export default function Index() {
  const [featuredRooms, setFeaturedRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showNearbyMap, setShowNearbyMap] = useState(false);
  const [showLocationPermission, setShowLocationPermission] = useState(false);
  const [showNearbyLock, setShowNearbyLock] = useState(false);
  const [nearbyLockCost, setNearbyLockCost] = useState(0);
  const [userPoints, setUserPoints] = useState(0);
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const exchangeConfig = useExchangeConfig();

  useEffect(() => {
    if (!user) return;
    supabase.from('user_points').select('total_points').eq('user_id', user.id).single()
      .then(({ data }) => setUserPoints(data?.total_points || 0));
  }, [user]);

  const handleNearbyClick = async () => {
    const isLocked = exchangeConfig?.enabled && exchangeConfig.features?.find_nearby?.enabled;
    if (isLocked) {
      const cost = exchangeConfig.features.find_nearby.points || 0;
      if (user) {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase.from('user_unlocks')
          .select('id').eq('user_id', user.id).eq('feature_type', 'find_nearby')
          .gte('created_at', today + 'T00:00:00').maybeSingle();
        if (existing) { proceedWithNearby(); return; }
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
    if (userPoints < cost) return;
    const newPts = userPoints - cost;
    await supabase.from('user_points').update({ total_points: newPts }).eq('user_id', user.id);
    await supabase.from('user_unlocks').insert({ user_id: user.id, feature_type: 'find_nearby', points_spent: cost });
    setUserPoints(newPts);
    setShowNearbyLock(false);
    proceedWithNearby();
  };

  const proceedWithNearby = () => {
    setShowNearbyMap(true);
  };

  useEffect(() => {
    fetchFeaturedRooms();
  }, []);

  const fetchFeaturedRooms = useCallback(async () => {
    const { data } = await supabase.
    from('rooms').
    select('id,title,room_number,price,area,province,district,ward,address_detail,phone,images,is_available').
    eq('is_available', true).
    eq('approval_status', 'approved');

    if (data) {
      // Shuffle rooms randomly on each load
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setFeaturedRooms(shuffled.slice(0, 12) as Room[]);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/rooms?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleRoomClick = (roomId: string) => {
    if (authLoading) return;
    navigate(`/rooms/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      
      {/* Hero Section - Mobile optimized */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2309b5d4%22%20fill-opacity%3D%220.04%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
        
        <div className="container relative px-5 py-12 sm:py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs sm:text-sm text-primary font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('heroBadge')}</span>
            </div>
            
            <h1 className="mb-4 text-[1.75rem] leading-[1.2] font-extrabold tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
              {t('heroTitle1')} <span className="text-gradient">{t('heroTitle2')}</span> {t('heroTitle3')}
              <br className="hidden xs:block" />
              <span className="sm:inline"> {t('heroTitle4')}</span>
            </h1>
            
            <p className="mb-7 text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg max-w-xl mx-auto">
              {t('heroDesc')}
              <span className="hidden sm:inline"> {t('heroDescExtra')}</span>
            </p>

            {/* Nearby search button */}
            <div className="mx-auto max-w-xl mb-3">
              <button
                onClick={handleNearbyClick}
                className="group w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300">
                
                <div className="h-9 w-9 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                  <LocateFixed className="h-5 w-5 text-primary group-hover:animate-pulse" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-foreground block leading-tight">{t('nearbySearch')}</span>
                  <span className="text-xs text-muted-foreground">{t('nearbySearchDesc')}</span>
                </div>
                <Navigation className="h-4 w-4 text-primary/60 group-hover:text-primary ml-auto transition-colors" />
              </button>
            </div>

            {/* Search card */}
            <form onSubmit={handleSearch} className="mx-auto max-w-xl">
              <div className="rounded-2xl bg-card p-2 sm:p-2.5 flex gap-2 items-center" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    className="h-11 sm:h-12 pl-9 pr-3 border-0 bg-muted/50 focus-visible:ring-1 rounded-xl text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} />
                  
                </div>
                <Button type="submit" size="lg" className="bg-gradient-primary hover:opacity-90 h-11 sm:h-12 px-5 sm:px-7 rounded-xl font-semibold text-sm shrink-0">
                  {t('search')}
                </Button>
              </div>
            </form>

            <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>{t('stat63Provinces')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-secondary" />
                <span>{t('stat1000Rooms')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-accent" />
                <span>{t('stat5000Users')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      {featuredRooms.length > 0 &&
      <section className="py-8 sm:py-10 bg-muted/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-0.5">{t('featuredRooms')}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('featuredRoomsDesc')}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="hidden sm:flex">
                <Link to="/rooms">
                  {t('viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <ScrollArea className="h-[calc(4*220px+3*24px)] pr-1 max-w-[94%] sm:max-w-none [&_[data-radix-scroll-area-scrollbar]]:w-1.5 [&_[data-radix-scroll-area-scrollbar]]:bg-muted/60 [&_[data-radix-scroll-area-thumb]]:bg-foreground/50 [&_[data-radix-scroll-area-thumb]]:rounded-full">
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-1">
                {featuredRooms.map((room) =>
              <div key={room.id} onClick={() => handleRoomClick(room.id)} className="cursor-pointer h-full">
                    <RoomCard room={room} showActions={false} />
                  </div>
              )}
              </div>
            </ScrollArea>

            <div className="mt-5 text-center sm:hidden">
              <Button asChild size="sm" className="bg-gradient-primary hover:opacity-90">
                <Link to="/rooms">
                  {t('viewAllRooms')} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      }

      {/* Features Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container px-5">
          <div className="mx-auto max-w-2xl text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-4">{t('whyChoose')}</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('whyChooseDesc')}
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-3">
            <div className="group rounded-2xl bg-card p-6 sm:p-8 card-hover">
              <div className="mb-3 sm:mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Search className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h3 className="mb-1.5 text-lg sm:text-xl font-semibold">{t('smartSearch')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('smartSearchDesc')}
              </p>
            </div>

            <div className="group rounded-2xl bg-card p-6 sm:p-8 card-hover">
              <div className="mb-3 sm:mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-secondary/20 text-secondary transition-colors group-hover:bg-secondary group-hover:text-secondary-foreground">
                <Shield className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h3 className="mb-1.5 text-lg sm:text-xl font-semibold">{t('safeTrusted')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('safeTrustedDesc')}
              </p>
            </div>

            <div className="group rounded-2xl bg-card p-6 sm:p-8 card-hover">
              <div className="mb-3 sm:mb-4 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-accent/20 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h3 className="mb-1.5 text-lg sm:text-xl font-semibold">{t('diverseChoices')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('diverseChoicesDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 sm:py-16 lg:py-20">
        <div className="container px-5">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-primary p-6 sm:p-8 lg:p-16">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M11%2018c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207zm48%2025c3.866%200%207-3.134%207-7s-3.134-7-7-7-7%203.134-7%207%203.134%207%207%207zm-43-7c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zm63%2031c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zM34%2090c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zm56-76c1.657%200%203-1.343%203-3s-1.343-3-3-3-3%201.343-3%203%201.343%203%203%203zM12%2086c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm28-65c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm23-11c2.76%200%205-2.24%205-5s-2.24-5-5-5-5%202.24-5%205%202.24%205%205%205zm-6%2060c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm29%2022c2.76%200%205-2.24%205-5s-2.24-5-5-5-5%202.24-5%205%202.24%205%205%205zM32%2063c2.76%200%205-2.24%205-5s-2.24-5-5-5-5%202.24-5%205%202.24%205%205%205zm57-13c2.76%200%205-2.24%205-5s-2.24-5-5-5-5%202.24-5%205%202.24%205%205%205zm-9-21c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zM60%2091c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zM35%2041c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202zM12%2060c1.105%200%202-.895%202-2s-.895-2-2-2-2%20.895-2%202%20.895%202%202%202z%22%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] opacity-30"></div>
            
            <div className="relative mx-auto max-w-2xl text-center text-primary-foreground">
              <h2 className="mb-3 text-2xl sm:text-3xl font-bold lg:text-4xl">
                {t('ctaTitle')}
              </h2>
              <p className="mb-6 sm:mb-8 text-sm sm:text-lg opacity-90">
                {t('ctaDesc')}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
                <Link
                  to="/auth?mode=signup"
                  className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-2xl bg-secondary text-secondary-foreground px-8 py-3.5 font-semibold text-base shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.97] hover:scale-[1.03]">
                  
                  <User className="h-4 w-4" />
                  {t('signupFree')}
                </Link>
                <Link
                  to="/rooms"
                  className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-2xl bg-transparent border-2 border-primary-foreground text-primary-foreground px-8 py-3.5 font-semibold text-base shadow-md transition-all duration-200 hover:bg-primary-foreground/15 hover:shadow-lg active:scale-[0.97] hover:scale-[1.03]">
                  
                  <Search className="h-4 w-4" />
                  {t('exploreNow')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Homepage Bottom Sections */}
      <HomepageBottomSections />

      {/* Footer */}
      













      

      {/* Login Dialog */}
      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('loginToViewTitle')}</DialogTitle>
            <DialogDescription>
              {t('loginToViewDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setLoginDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/auth?mode=signup')}>
              
              {t('signupNow')}
            </Button>
            <Button
              onClick={() => navigate('/auth')}
              className="bg-gradient-primary hover:opacity-90">
              
              {t('login')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nearby Map Dialog */}
      <NearbyMap open={showNearbyMap} onOpenChange={setShowNearbyMap} />

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
              <Button onClick={() => { setShowNearbyLock(false); navigate('/wallet'); }} className="w-full bg-gradient-primary hover:opacity-90 gap-2">
                <Wallet className="h-4 w-4" /> Xem ví điểm
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowNearbyLock(false)} className="w-full">Hủy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <Footer />
    
    </div>);

}

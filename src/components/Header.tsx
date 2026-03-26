// @ts-nocheck
import { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Home, User, LogOut, Shield, Building2, Search, Settings, MessageCircle, Menu, CreditCard, BookOpen, MessageSquare, Gift } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

// Preload ChatPanel & UserSettingsDialog eagerly for instant open
const chatPanelImport = import('@/components/ChatPanel');
const ChatPanel = lazy(() => chatPanelImport.then(m => ({ default: m.ChatPanel })));
const settingsImport = import('@/components/UserSettingsDialog');
const UserSettingsDialog = lazy(() => settingsImport.then(m => ({ default: m.UserSettingsDialog })));
const LandlordPaymentInfoDialog = lazy(() => import('@/components/LandlordPaymentInfoDialog').then(m => ({ default: m.LandlordPaymentInfoDialog })));
const GuideViewer = lazy(() => import('@/components/GuideViewer').then(m => ({ default: m.GuideViewer })));
const FeedbackDialog = lazy(() => import('@/components/FeedbackDialog').then(m => ({ default: m.FeedbackDialog })));
import { ProtectionPasswordSetup } from '@/components/ProtectionPasswordSetup';
import { PasswordChangeForm } from '@/components/PasswordChangeForm';
const NotificationBell = lazy(() => import('@/components/NotificationBell').then(m => ({ default: m.NotificationBell })));

const AvatarIcon = memo(function AvatarIcon({ userId }: { userId?: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    
    supabase.from('profiles').select('avatar_url').eq('user_id', userId).single()
      .then(({ data }) => { if (!cancelled) setAvatarUrl(data?.avatar_url || null); });

    const channel = supabase
      .channel('avatar-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` }, (payload) => {
        setAvatarUrl((payload.new as any)?.avatar_url || null);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <Avatar className="h-8 w-8">
      {avatarUrl && <AvatarImage src={avatarUrl} />}
      <AvatarFallback className="bg-primary/10"><User className="h-4 w-4 text-primary" /></AvatarFallback>
    </Avatar>
  );
});

export function Header() {
  const { user, role, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialUserId, setChatInitialUserId] = useState<string | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [protectionSetupOpen, setProtectionSetupOpen] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{ full_name: string; display_id: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen for open-chat events from NotificationBell
  useEffect(() => {
    const handler = (e: CustomEvent<{ userId: string }>) => {
      setChatInitialUserId(e.detail.userId);
      setChatOpen(true);
    };
    window.addEventListener('open-chat', handler as EventListener);
    return () => window.removeEventListener('open-chat', handler as EventListener);
  }, []);

  const fetchUserInfo = useCallback(async () => {
    if (!user) return;

    const [profileRes, settingsRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('user_id', user.id).single(),
      supabase.from('user_settings').select('display_id').eq('user_id', user.id).single(),
    ]);

    let displayId = 'N/A';
    if (settingsRes.data) {
      displayId = settingsRes.data.display_id;
    } else {
      const { data: newId } = await supabase.rpc('generate_display_id');
      const newDisplayId = newId || `TT${Date.now().toString().slice(-6)}`;
      await supabase.from('user_settings').insert({ user_id: user.id, display_id: newDisplayId });
      displayId = newDisplayId;
    }

    setUserInfo({
      full_name: profileRes.data?.full_name || 'Người dùng',
      display_id: displayId,
    });
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserInfo();
      fetchUnreadCount();
    } else {
      setUserInfo(null);
      setUnreadCount(0);
    }
  }, [user, fetchUserInfo, fetchUnreadCount]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('header-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => fetchUnreadCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUnreadCount]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/');
  }, [signOut, navigate]);

  const getDashboardLink = useCallback(() => {
    switch (role) {
      case 'admin': return '/admin';
      case 'landlord': return '/landlord';
      case 'tenant': return '/tenant';
      default: return '/';
    }
  }, [role]);

  const getRoleLabel = useCallback(() => {
    switch (role) {
      case 'admin': return t('roleAdmin');
      case 'landlord': return t('roleLandlord');
      case 'tenant': return t('roleTenant');
      default: return '';
    }
  }, [role, t]);

  const NavLinks = useCallback(({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) => (
    <>
      <Link 
        to="/" 
        className={`${mobile ? 'flex items-center gap-3 p-3 rounded-lg hover:bg-muted' : 'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'}`}
        onClick={onNavigate}
      >
        {mobile && <Home className="h-5 w-5 text-primary" />}
        {t('home')}
      </Link>
      <Link 
        to="/rooms" 
        className={`${mobile ? 'flex items-center gap-3 p-3 rounded-lg hover:bg-muted' : 'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'}`}
        onClick={onNavigate}
      >
        {mobile && <Search className="h-5 w-5 text-primary" />}
        {t('findRoom')}
      </Link>
    </>
  ), [t]);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80 transition-all duration-300 ${scrolled ? 'shadow-md' : ''}`}>
        <div className={`container flex items-center justify-between px-3 sm:px-4 transition-all duration-300 ${scrolled ? 'h-12' : 'h-16'}`}>
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="AnndHub Logo" className={`rounded-lg object-cover transition-all duration-300 ${scrolled ? 'h-8 w-8' : 'h-10 w-10'}`} loading="eager" width="40" height="40" />
              <span className={`font-bold text-gradient transition-all duration-300 ${scrolled ? 'text-lg' : 'text-xl'}`}>AnndHub</span>
            </Link>
            {user && userInfo && (
              <div className="hidden sm:flex flex-col text-sm border-l pl-4 ml-2">
                <span className="font-medium truncate max-w-[120px]">{userInfo.full_name}</span>
                <span className="text-xs text-muted-foreground font-mono">{userInfo.display_id}</span>
              </div>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <NavLinks />
          </nav>

          <div className="flex items-center gap-1">
            {user ? (
              <>
                {(role === 'landlord' || role === 'tenant') && (
                  <Button variant="ghost" size="icon" onClick={() => setGuideOpen(true)} title={t('userGuide')} className="hidden sm:inline-flex">
                    <BookOpen className="h-5 w-5" />
                  </Button>
                )}

                <Suspense fallback={null}>
                  <NotificationBell />
                </Suspense>

                <Button variant="ghost" size="icon" className="relative" onClick={() => setChatOpen(!chatOpen)}>
                  <MessageCircle className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-accent text-accent-foreground text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>

                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} >
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-1.5 px-2 h-8">
                      <AvatarIcon userId={user?.id} />
                      <span className="hidden sm:inline text-sm">{getRoleLabel()}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover">
                    {userInfo && (
                      <div className="px-2 py-2 sm:hidden">
                        <p className="font-medium">{userInfo.full_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{userInfo.display_id}</p>
                      </div>
                    )}
                    <DropdownMenuSeparator className="sm:hidden" />
                    <DropdownMenuItem asChild>
                      <Link to={getDashboardLink()} className="flex items-center gap-2 cursor-pointer">
                        {role === 'admin' && <Shield className="h-4 w-4" />}
                        {role === 'landlord' && <Building2 className="h-4 w-4" />}
                        {role === 'tenant' && <Search className="h-4 w-4" />}
                        {t('dashboard')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {role === 'landlord' && (
                      <DropdownMenuItem onClick={() => setPaymentInfoOpen(true)} className="cursor-pointer">
                        <CreditCard className="h-4 w-4 mr-2" />
                        {t('paymentInfo')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      {t('settings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/wallet')} className="cursor-pointer">
                      <Gift className="h-4 w-4 mr-2" />
                      Ví điểm
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFeedbackOpen(true)} className="cursor-pointer">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Phản hồi
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2" />
                      {t('logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72">
                    <SheetHeader>
                      <SheetTitle className="text-left">{t('menu')}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-2">
                      <NavLinks mobile onNavigate={() => setMobileMenuOpen(false)} />
                      <Link to={getDashboardLink()} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>
                        {role === 'admin' && <Shield className="h-5 w-5 text-primary" />}
                        {role === 'landlord' && <Building2 className="h-5 w-5 text-primary" />}
                        {role === 'tenant' && <Search className="h-5 w-5 text-primary" />}
                        {t('dashboard')}
                      </Link>
                      {(role === 'landlord' || role === 'tenant') && (
                        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left" onClick={() => { setMobileMenuOpen(false); setGuideOpen(true); }}>
                          <BookOpen className="h-5 w-5 text-primary" />
                          {t('userGuide')}
                        </button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" asChild className="text-xs h-8 px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                  <Link to="/auth">{t('login')}</Link>
                </Button>
                <Button size="sm" asChild className="bg-gradient-primary hover:opacity-90 text-xs h-8 px-3">
                  <Link to="/auth?mode=signup">{t('signup')}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className={`transition-all duration-300 ${scrolled ? 'h-12' : 'h-16'}`} />

      {/* Lazy loaded dialogs - only render when opened */}
      <Suspense fallback={null}>
        {chatOpen && <ChatPanel open={chatOpen} onOpenChange={(v) => { setChatOpen(v); if (!v) setChatInitialUserId(undefined); }} initialUserId={chatInitialUserId} />}
        {settingsOpen && <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onOpenProtection={() => { setSettingsOpen(false); setTimeout(() => setProtectionSetupOpen(true), 200); }} onOpenPasswordChange={() => { setSettingsOpen(false); setTimeout(() => setPasswordFormOpen(true), 200); }} />}
        {paymentInfoOpen && <LandlordPaymentInfoDialog open={paymentInfoOpen} onOpenChange={setPaymentInfoOpen} />}
        {guideOpen && <GuideViewer open={guideOpen} onOpenChange={setGuideOpen} />}
        {feedbackOpen && <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />}
      </Suspense>
      <ProtectionPasswordSetup open={protectionSetupOpen} onClose={() => setProtectionSetupOpen(false)} />
      <PasswordChangeForm open={passwordFormOpen} onClose={() => setPasswordFormOpen(false)} />
    </>
  );
}

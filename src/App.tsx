// @ts-nocheck
import { lazy, Suspense, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectionPinDialog } from "@/components/ProtectionPinDialog";
import { MiniGamePopup } from "@/components/MiniGamePopup";
import { RewardCoinToast } from "@/components/RewardCoinToast";

// Lazy load non-critical components
const LanguagePickerModal = lazy(() => import("@/components/LanguagePickerModal").then(m => ({ default: m.LanguagePickerModal })));
const BannedOverlay = lazy(() => import("@/components/BannedOverlay").then(m => ({ default: m.BannedOverlay })));
const NotificationPopup = lazy(() => import("@/components/NotificationPopup").then(m => ({ default: m.NotificationPopup })));
const TermsOfServiceDialog = lazy(() => import("@/components/TermsOfServiceDialog").then(m => ({ default: m.TermsOfServiceDialog })));

// Lazy load all pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Rooms = lazy(() => import("./pages/Rooms"));
const RoomDetail = lazy(() => import("./pages/RoomDetail"));
const TenantDashboard = lazy(() => import("./pages/TenantDashboard"));
const LandlordDashboard = lazy(() => import("./pages/LandlordDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const GuideManagement = lazy(() => import("./pages/GuideManagement"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminMiniGames = lazy(() => import("./pages/AdminMiniGames"));
const AdminRanking = lazy(() => import("./pages/Adminranking"));
const PointsWallet = lazy(() => import("./pages/PointsWallet"));
const AdminRewardExchange = lazy(() => import("./pages/admin/AdminRewardExchange"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Ranking = lazy(() => import("./pages/Ranking"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Helper to check session storage for verified users
const VERIFIED_KEY = 'protection_verified_user';

function getVerifiedUser(): string | null {
  try { return sessionStorage.getItem(VERIFIED_KEY); } catch { return null; }
}
function setVerifiedUser(userId: string) {
  try { sessionStorage.setItem(VERIFIED_KEY, userId); } catch {}
}
function clearVerifiedUser() {
  try { sessionStorage.removeItem(VERIFIED_KEY); } catch {}
}

function ProtectionGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);

  useEffect(() => {
    if (!user) {
      clearVerifiedUser();
      setNeedsPin(false);
      setChecking(false);
      return;
    }

    // Already verified for this user in this browser session
    if (getVerifiedUser() === user.id) {
      setNeedsPin(false);
      setChecking(false);
      return;
    }

    let cancelled = false;
    const checkProtection = async () => {
      setChecking(true);
      try {
        const { data } = await supabase
          .from('protection_passwords')
          .select('is_enabled')
          .eq('user_id', user.id)
          .eq('is_enabled', true)
          .maybeSingle();

        if (!cancelled) {
          if (data) {
            setNeedsPin(true);
          } else {
            setVerifiedUser(user.id);
            setNeedsPin(false);
          }
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setVerifiedUser(user.id);
          setNeedsPin(false);
          setChecking(false);
        }
      }
    };

    checkProtection();
    return () => { cancelled = true; };
  }, [user?.id]);

  // No user or already verified
  if (!user || getVerifiedUser() === user.id) {
    return <>{children}</>;
  }

  if (checking) {
    return <PageLoader />;
  }

  if (needsPin) {
    return (
      <ProtectionPinDialog
        userId={user.id}
        onSuccess={() => {
          setVerifiedUser(user.id);
          setNeedsPin(false);
        }}
        onCancel={async () => {
          clearVerifiedUser();
          await supabase.auth.signOut();
        }}
      />
    );
  }

  return <>{children}</>;
}

function BanCheck({ children }: { children: React.ReactNode }) {
  const { user, isBanned } = useAuth();
  return (
    <>
      {children}
      <MiniGamePopup />
      <RewardCoinToast />
      <Suspense fallback={null}>
        {user && isBanned && <BannedOverlay userId={user.id} />}
        {user && !isBanned && <NotificationPopup />}
        {user && !isBanned && <TermsOfServiceDialog userId={user.id} />}
      </Suspense>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ProtectionGate>
              <BanCheck>
                <Suspense fallback={null}><LanguagePickerModal /></Suspense>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/rooms" element={<Rooms />} />
                    <Route path="/rooms/:id" element={<RoomDetail />} />
                    <Route path="/tenant" element={<TenantDashboard />} />
                    <Route path="/landlord" element={<LandlordDashboard />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/guides" element={<GuideManagement />} />
                    <Route path="/admin/reports" element={<AdminReports />} />
                    <Route path="/admin/minigames" element={<AdminMiniGames />} />
                    <Route path="/admin/ranking" element={<AdminRanking />} />
                    <Route path="/admin/reward-exchange" element={<AdminRewardExchange />} />
                    <Route path="/wallet" element={<PointsWallet />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                    <Route path="/ranking" element={<Ranking />} />
                  </Routes>
                </Suspense>
              </BanCheck>
            </ProtectionGate>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

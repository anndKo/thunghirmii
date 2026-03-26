// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Home, Building2, Search, Loader2, ShieldAlert, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { ProtectionPinDialog } from '@/components/ProtectionPinDialog';
import { securityCheck, BehaviorTracker, generateFingerprint } from '@/lib/security';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const { t } = useLanguage();

  const signUpSchema = z.object({
    email: z.string().email(t('emailInvalid')),
    password: z.string().min(6, t('passwordMinLength')),
    fullName: z.string().min(2, t('nameMinLength')),
  });

  const signInSchema = z.object({
    email: z.string().email(t('emailInvalid')),
    password: z.string().min(1, t('passwordRequired')),
  });

  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'signin';
  const [activeTab, setActiveTab] = useState(mode === 'signup' ? 'signup' : 'signin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<'landlord' | 'tenant'>('tenant');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [forgotOpen, setForgotOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  
  // Protection password state
  const [showProtectionPin, setShowProtectionPin] = useState(false);
  const [protectionUserId, setProtectionUserId] = useState<string | null>(null);
  
  const behaviorTracker = useRef(new BehaviorTracker());
  
  const { signIn, signUp, user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check device status on mount
  useEffect(() => {
    const checkDevice = async () => {
      try {
        const result = await securityCheck('check_status');
        if (!result.ok) {
          if (result.error === 'device_blocked') {
            setDeviceBlocked(true);
            setBlockReason(result.data?.reason || null);
            setLockoutUntil(result.data?.blocked_until || null);
          }
        } else if (result.data?.locked) {
          setLockoutUntil(result.data.lockout_until);
        }
        if (result.data?.remaining_attempts !== undefined) {
          setRemainingAttempts(result.data.remaining_attempts);
        }
      } catch (e) {
        console.warn('Device check skipped:', e);
      }
    };
    checkDevice();
  }, []);

  useEffect(() => {
    if (user && role) {
      switch (role) {
        case 'admin': navigate('/admin'); break;
        case 'landlord': navigate('/landlord'); break;
        case 'tenant': navigate('/tenant'); break;
      }
    }
  }, [user, role, navigate]);

  const handleKeyDown = () => {
    behaviorTracker.current.recordKeystroke();
  };

  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!lockoutUntil || lockoutUntil === 'permanent') return;
    const interval = setInterval(() => {
      const remaining = new Date(lockoutUntil).getTime() - Date.now();
      if (remaining <= 0) {
        setLockoutUntil(null);
        setCountdown('');
        setRemainingAttempts(5);
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLocked = deviceBlocked || (lockoutUntil && (lockoutUntil === 'permanent' || new Date(lockoutUntil).getTime() > Date.now()));

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setErrors({});
    
    const isSuspicious = behaviorTracker.current.recordSubmit();
    if (isSuspicious) {
      toast({ title: t('pleaseTryAgain'), description: t('suspiciousActivity'), variant: 'destructive' });
      return;
    }

    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);

    // Get user_id on success for device tracking
    let loginUserId: string | undefined;
    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      loginUserId = userData.user?.id;
    }

    const secResult = await securityCheck('login_attempt', {
      email,
      success: !error,
      user_id: loginUserId,
    });

    if (!secResult.ok) {
      // Sign out if login succeeded but device/user is blocked
      if (!error) await supabase.auth.signOut();
      
      if (secResult.error === 'device_blocked') {
        setDeviceBlocked(true);
        setBlockReason(secResult.data?.reason || null);
        setLockoutUntil(secResult.data?.blocked_until || 'permanent');
        setIsLoading(false);
        return;
      } else if (secResult.error === 'account_locked') {
        const lockUntil = secResult.data?.lockout_until || 'permanent';
        setLockoutUntil(lockUntil);
        if (lockUntil === 'permanent') {
          setDeviceBlocked(true);
        }
      }
    } else if (secResult.data?.remaining_attempts !== undefined) {
      setRemainingAttempts(secResult.data.remaining_attempts);
    }

    setIsLoading(false);

    if (error) {
      const remaining = secResult.data?.remaining_attempts ?? remainingAttempts;
      if (remaining !== null && remaining !== undefined) {
        setRemainingAttempts(remaining);
      }
      toast({
        title: t('invalidCredentials'),
        description: remaining !== null && remaining !== undefined && remaining <= 3
          ? t('attemptsLeft', { count: remaining })
          : t('checkEmailPassword'),
        variant: 'destructive',
      });
    } else {
      // Login succeeded - protection PIN check is handled by ProtectionGate in App.tsx
      // Redirect is handled by the useEffect above when user & role are set
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setErrors({});
    
    const isSuspicious = behaviorTracker.current.recordSubmit();
    if (isSuspicious) {
      toast({ title: t('pleaseTryAgain'), description: t('suspiciousActivity'), variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Mật khẩu nhập lại không khớp' });
      return;
    }

    const result = signUpSchema.safeParse({ email, password, fullName });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const regCheck = await securityCheck('check_register', { email });
      if (!regCheck.ok && regCheck.error === 'device_blocked') {
        setIsLoading(false);
        setDeviceBlocked(true);
        setBlockReason(regCheck.data?.reason || null);
        toast({
          title: t('cannotRegister'),
          description: regCheck.message || t('deviceRegistrationLimit'),
          variant: 'destructive',
        });
        return;
      }
    } catch (e) {
      console.warn('Security check skipped:', e);
    }

    const { error, userId } = await signUp(email, password, fullName, selectedRole, phone);

    if (!error && userId) {
      try {
        securityCheck('record_register', { user_id: userId, email }).catch(() => {});
      } catch (e) {
        console.warn('Record register skipped:', e);
      }
    }
    
    setIsLoading(false);

    if (error) {
      let message = t('genericError');
      if (error.message.includes('already registered')) {
        message = t('invalidRegistration');
      } else if (error.message.includes('security purposes') || error.message.includes('40 seconds') || error.message.includes('rate limit')) {
        message = t('tooManyRequests');
      }
      toast({ title: t('signupFailed'), description: message, variant: 'destructive' });
    } else {
      toast({
        title: t('signupSuccess'),
        description: 'Tai khoan da duoc tao. Neu he thong yeu cau, hay kiem tra email de xac nhan.',
      });
    }
  };

  // Support request form state
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportSent, setSupportSent] = useState(false);

  const handleSendSupport = async () => {
    if (!supportEmail.trim() || !supportPhone.trim()) {
      toast({ title: 'Vui lòng điền đầy đủ email và số điện thoại', variant: 'destructive' });
      return;
    }
    setSupportSending(true);
    try {
      const fp = await generateFingerprint();
      const { error } = await supabase.from('device_support_requests').insert({
        email: supportEmail.trim(),
        phone: supportPhone.trim(),
        message: supportMessage.trim() || null,
        fingerprint_hash: fp,
      });
      if (error) throw error;
      setSupportSent(true);
      toast({ title: 'Đã gửi yêu cầu hỗ trợ', description: 'Quản trị viên sẽ xem xét và phản hồi sớm nhất.' });
    } catch {
      toast({ title: 'Lỗi gửi yêu cầu', variant: 'destructive' });
    }
    setSupportSending(false);
  };

  if (deviceBlocked || (lockoutUntil === 'permanent')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-8 text-center space-y-4">
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto animate-pulse" />
            <h2 className="text-xl font-bold text-destructive">{t('deviceLocked')}</h2>
            <p className="text-muted-foreground">{t('deviceLockedDesc')}</p>
            {blockReason && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm font-medium text-destructive">Lý do: {blockReason}</p>
              </div>
            )}

            {supportSent ? (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 space-y-2">
                <ShieldCheck className="h-8 w-8 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Yêu cầu đã được gửi!</p>
                <p className="text-xs text-muted-foreground">Quản trị viên sẽ xem xét và liên hệ lại với bạn.</p>
              </div>
            ) : showSupportForm ? (
              <div className="text-left space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="support-email" className="text-sm">Email liên hệ <span className="text-destructive">*</span></Label>
                  <Input id="support-email" type="email" placeholder="email@example.com" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-phone" className="text-sm">Số điện thoại <span className="text-destructive">*</span></Label>
                  <Input id="support-phone" type="tel" placeholder="0912345678" value={supportPhone} onChange={e => setSupportPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-msg" className="text-sm">Lời nhắn (tùy chọn)</Label>
                  <textarea
                    id="support-msg"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[70px] resize-none"
                    placeholder="Mô tả vấn đề của bạn..."
                    value={supportMessage}
                    onChange={e => setSupportMessage(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowSupportForm(false)}>Huỷ</Button>
                  <Button className="flex-1" onClick={handleSendSupport} disabled={supportSending}>
                    {supportSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Gửi yêu cầu
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <Button variant="outline" onClick={() => setShowSupportForm(true)} className="gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Liên hệ hỗ trợ
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4 relative" onKeyDown={handleKeyDown}>
      <div className="absolute top-4 left-4 z-10">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link to="/">
            <Home className="h-4 w-4" />
            {t('home')}
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AnndHub Logo" className="h-12 w-12 rounded-xl shadow-lg object-cover" loading="eager" decoding="async" fetchPriority="high" />
            <span className="text-2xl font-bold text-gradient">AnndHub</span>
          </div>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('welcome')}</CardTitle>
            <CardDescription>{t('loginOrSignup')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLocked && countdown && (
              <div className="mb-4 p-4 rounded-xl bg-destructive/10 border-2 border-destructive/30 text-center space-y-2 shadow-sm">
                <ShieldAlert className="h-8 w-8 text-destructive mx-auto animate-pulse" />
                <p className="text-sm font-semibold text-destructive">{t('lockedMessage')}</p>
                <p className="text-xs text-muted-foreground">{t('tryAgainAfter')}</p>
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive/15 border border-destructive/25">
                  <span className="text-2xl font-mono font-bold text-destructive tracking-wider">{countdown}</span>
                </div>
                <p className="text-xs text-muted-foreground/60">{t('lockedBrowserNote')}</p>
              </div>
            )}

            {!isLocked && remainingAttempts !== null && remainingAttempts <= 3 && remainingAttempts > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-center space-y-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  ⚠️ Thiết bị còn {remainingAttempts} lượt đăng nhập
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Vui lòng kiểm tra email và mật khẩu chính xác. Sai quá 5 lần sẽ bị khóa thiết bị.
                </p>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">{t('login')}</TabsTrigger>
                <TabsTrigger value="signup">{t('signup')}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t('email')}</Label>
                    <Input id="signin-email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!isLocked} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">{t('password')}</Label>
                    <div className="relative">
                      <Input id="signin-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!!isLocked} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                   <Button type="submit" className={`w-full bg-gradient-primary hover:opacity-90 transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}`} disabled={isLoading || !!isLocked}>
                     {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     {t('login')}
                   </Button>
                  <div className="text-center">
                    <button type="button" onClick={() => setForgotOpen(true)} className="text-sm text-primary hover:underline">
                      {t('forgotPassword')}
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t('fullName')}</Label>
                    <Input id="signup-name" type="text" placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!!isLocked} />
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('email')}</Label>
                    <Input id="signup-email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!isLocked} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('password')}</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!!isLocked} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Số điện thoại</Label>
                    <Input id="signup-phone" type="tel" placeholder="0912345678" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!!isLocked} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Nhập lại mật khẩu</Label>
                    <div className="relative">
                      <Input id="signup-confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={!!isLocked} className="pr-10" />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>
                  
                  <div className="space-y-3">
                    <Label>{t('youAre')}</Label>
                    <RadioGroup value={selectedRole} onValueChange={(value) => setSelectedRole(value as 'landlord' | 'tenant')} className="grid grid-cols-2 gap-4">
                      <div>
                        <RadioGroupItem value="tenant" id="tenant" className="peer sr-only" />
                        <Label htmlFor="tenant" className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                          <Search className="mb-2 h-6 w-6 text-primary" />
                          <span className="text-sm font-medium">{t('tenant')}</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="landlord" id="landlord" className="peer sr-only" />
                        <Label htmlFor="landlord" className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all">
                          <Building2 className="mb-2 h-6 w-6 text-primary" />
                          <span className="text-sm font-medium">{t('landlord')}</span>
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground text-center">{t('firstUserAdmin')}</p>
                  </div>

                  <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={isLoading || !!isLocked}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('signup')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
      {showProtectionPin && protectionUserId && (
        <ProtectionPinDialog
          userId={protectionUserId}
          onSuccess={async () => {
            // Re-sign in after successful protection PIN
            setShowProtectionPin(false);
            setIsLoading(true);
            await signIn(email, password);
            setIsLoading(false);
          }}
          onCancel={() => {
            setShowProtectionPin(false);
            setProtectionUserId(null);
          }}
        />
      )}
    </div>
  );
}

// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { X, Bell, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Notification {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  target_role: string;
  created_at: string;
}

interface PaymentDeadlineInfo {
  deadline_day: number;
  paid_month: string | null;
  status: 'waiting' | 'none';
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function NotificationPopup() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hideChecked, setHideChecked] = useState(false);
  const [open, setOpen] = useState(false);

  // Payment deadline popup
  const [paymentDeadline, setPaymentDeadline] = useState<PaymentDeadlineInfo | null>(null);
  const [paymentPopupOpen, setPaymentPopupOpen] = useState(false);
  const [paymentPopupDismissed, setPaymentPopupDismissed] = useState(false);

  useEffect(() => {
    if (user && role) {
      fetchNotifications();
      checkPaymentDeadline();
    }
  }, [user, role]);

  const fetchNotifications = async () => {
    if (!user || !role) return;

    // Fetch active notifications for this role (exclude payment auto-notifications)
    const { data: allNotifs } = await (supabase as any)
      .from('notifications')
      .select('*')
      .eq('is_active', true)
      .or(`target_role.eq.all,target_role.eq.${role}`)
      .order('created_at', { ascending: false });

    if (!allNotifs || allNotifs.length === 0) return;

    // Filter out payment deadline auto-notifications
    const PAYMENT_KEYWORDS = ['Hạn thanh toán', 'Xác nhận thanh toán', 'Chậm hạn thanh toán', 'Cập nhật thanh toán'];
    const filtered = allNotifs.filter((n: any) => !PAYMENT_KEYWORDS.some(k => n.title.startsWith(k)));

    if (filtered.length === 0) return;

    // Fetch dismissed ones
    const { data: dismissed } = await supabase
      .from('notification_dismissals')
      .select('notification_id')
      .eq('user_id', user.id);

    const dismissedIds = new Set((dismissed || []).map(d => d.notification_id));
    const active = filtered.filter(n => !dismissedIds.has(n.id));

    if (active.length > 0) {
      setNotifications(active);
      setCurrentIndex(0);
      setOpen(true);
    }
  };

  const checkPaymentDeadline = async () => {
    if (!user || !role || role === 'admin') return;

    const currentMonth = getCurrentMonth();
    const today = new Date().getDate();
    const dismissKey = `payment_deadline_dismissed_${user.id}_${currentMonth}`;

    // Check if already dismissed this month
    if (localStorage.getItem(dismissKey)) return;

    let deadlineDay: number | null = null;
    let paidMonth: string | null = null;

    if (role === 'tenant') {
      const { data } = await (supabase as any)
        .from('payment_deadlines')
        .select('deadline_day, paid_month')
        .eq('user_id', user.id)
        .eq('role', 'tenant')
        .maybeSingle();
      if (data) {
        deadlineDay = data.deadline_day;
        paidMonth = data.paid_month;
      }
    } else if (role === 'landlord') {
      // Get shared landlord deadline
      const { data: shared } = await (supabase as any)
        .from('payment_deadlines')
        .select('deadline_day')
        .is('user_id', null)
        .eq('role', 'landlord')
        .maybeSingle();

      if (shared) {
        deadlineDay = shared.deadline_day;
      }

      // Get individual paid status
      const { data: individual } = await (supabase as any)
        .from('payment_deadlines')
        .select('paid_month')
        .eq('user_id', user.id)
        .eq('role', 'landlord')
        .maybeSingle();

      paidMonth = individual?.paid_month || null;
    }

    if (!deadlineDay) return;

    // Check if already paid this month
    if (paidMonth === currentMonth) return;

    // Check if today is at or past the deadline day
    if (today >= deadlineDay) {
      setPaymentDeadline({ deadline_day: deadlineDay, paid_month: paidMonth, status: 'waiting' });
      setPaymentPopupOpen(true);
    }
  };

  const handleClose = async () => {
    if (hideChecked && notifications[currentIndex]) {
      await supabase.from('notification_dismissals').insert({
        notification_id: notifications[currentIndex].id,
        user_id: user!.id,
      });
    }

    if (currentIndex < notifications.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setHideChecked(false);
    } else {
      setOpen(false);
    }
  };

  const handleDismissPaymentPopup = () => {
    const currentMonth = getCurrentMonth();
    const dismissKey = `payment_deadline_dismissed_${user?.id}_${currentMonth}`;
    localStorage.setItem(dismissKey, 'true');
    setPaymentPopupOpen(false);
    setPaymentPopupDismissed(true);
  };

  return (
    <>
      {/* Regular notification popup */}
      {open && notifications.length > 0 && (() => {
        const notif = notifications[currentIndex];
        return (
          <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
              {/* Modern gradient header */}
              <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shadow-sm">
                      <Bell className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-xl font-bold truncate">{notif.title}</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(notif.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {notifications.length > 1 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {currentIndex + 1}/{notifications.length}
                      </Badge>
                    )}
                  </div>
                </DialogHeader>
              </div>

              <ScrollArea className="flex-1 px-6 py-5">
                {notif.image_url && (
                  <img src={notif.image_url} alt="Notification" className="w-full rounded-2xl mb-5 max-h-60 object-cover shadow-md" />
                )}
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-xl p-4 border border-border/50">
                  {notif.content}
                </div>
              </ScrollArea>

              <div className="px-6 py-4 border-t bg-muted/20 shrink-0 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none hover:text-foreground transition-colors">
                  <Checkbox checked={hideChecked} onCheckedChange={(c) => setHideChecked(!!c)} />
                  {t('notifPopupHide')}
                </label>
                <Button onClick={handleClose} size="sm" className="rounded-xl px-6 shadow-sm">
                  {currentIndex < notifications.length - 1 ? t('notifPopupNext') : t('notifPopupClose')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Payment deadline auto popup */}
      {paymentPopupOpen && paymentDeadline && !paymentPopupDismissed && (
        <Dialog open={paymentPopupOpen} onOpenChange={(v) => { if (!v) handleDismissPaymentPopup(); }}>
          <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
            {/* Red gradient header */}
            <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent">
              <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <DialogHeader className="relative z-10">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-destructive/15 flex items-center justify-center shadow-sm">
                    <AlertTriangle className="h-7 w-7 text-destructive" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">{t('notifPopupPaymentReminder')}</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('notifPopupAutoNotif')}</p>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 space-y-2">
                <p className="text-sm font-semibold text-destructive">
                  {new Date().getDate() > paymentDeadline.deadline_day
                    ? t('notifPopupOverdue')
                    : t('notifPopupToday')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('notifPopupDeadlineLabel')}: <strong className="text-foreground">{t('notifPopupDeadlineDay', { day: paymentDeadline.deadline_day })}</strong> {t('notifPopupMonthly')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('notifPopupMonth', { month: new Date().getMonth() + 1, year: new Date().getFullYear() })}: <strong className="text-destructive">{t('notifPopupNotPaid')}</strong>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('notifPopupContactAdmin')}
              </p>
            </div>

            <div className="px-6 pb-5 flex justify-end">
              <Button onClick={handleDismissPaymentPopup} size="sm" className="rounded-xl px-6 shadow-sm">
                {t('notifPopupUnderstood')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

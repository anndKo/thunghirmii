// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Send } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  link?: string;
  action?: 'open_chat_admin' | 'landlord_feedback';
}

const STORAGE_KEY = 'notifications_read';

function getReadIds(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTing = (delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.3);
    };
    playTing(0);
    playTing(0.15);
  } catch (e) {}
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function NotificationBell() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const prevCountRef = useRef(-1);

  // Landlord feedback dialog
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  useEffect(() => {
    if (prevCountRef.current >= 0 && unreadCount > prevCountRef.current) {
      playNotificationSound();
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  const buildNotifications = useCallback(async () => {
    if (!user || !role) return;

    const items: NotificationItem[] = [];

    // ===== TENANT notifications =====
    if (role === 'tenant') {
      const { data: requests } = await supabase
        .from('room_requests')
        .select('id, status, admin_note, created_at, room_id, tenant_id, rooms(title, room_number)')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (requests) {
        requests.forEach((req: any) => {
          const roomTitle = req.rooms?.title || t('notifRoom');
          const roomNumber = req.rooms?.room_number || '';
          const roomLink = `/rooms/${req.room_id}`;
          if (req.status === 'approved') {
            items.push({ id: `req-approved-${req.id}`, title: '✅ Yêu cầu được duyệt!', message: `Yêu cầu thuê phòng ${roomNumber} - ${roomTitle} của bạn đã được duyệt.` + (req.admin_note ? ` Ghi chú: ${req.admin_note}` : ''), type: 'room_approved', is_read: false, created_at: req.created_at, link: roomLink });
          } else if (req.status === 'rejected') {
            items.push({ id: `req-rejected-${req.id}`, title: t('notifReqRejected'), message: t('notifReqRejectedMsg', { room: roomNumber, title: roomTitle }) + (req.admin_note ? t('notifReqRejectedReason', { reason: req.admin_note }) : ''), type: 'room_rejected', is_read: false, created_at: req.created_at, link: '/my-requests' });
          } else if (req.status === 'forwarded') {
            items.push({ id: `req-forwarded-${req.id}`, title: t('notifReqForwarded'), message: t('notifReqForwardedMsg', { room: roomNumber, title: roomTitle }), type: 'room_forwarded', is_read: false, created_at: req.created_at, link: '/my-requests' });
          }
        });
      }

      // Tenant payment box notifications - when admin sends payment requests
      const { data: tenantPayments } = await supabase
        .from('payment_requests')
        .select('id, created_at, amount, status')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tenantPayments) {
        tenantPayments.forEach((p: any) => {
          const amountStr = p.amount ? new Intl.NumberFormat('vi-VN').format(p.amount) + 'đ' : '';
          items.push({
            id: `tenant-payment-${p.id}`,
            title: '💳 Hộp thanh toán mới',
            message: `Bạn vừa nhận được hộp thanh toán mới từ Admin.${amountStr ? ` Số tiền: ${amountStr}` : ''}`,
            type: 'tenant_payment',
            is_read: false,
            created_at: p.created_at,
            action: 'open_chat_admin',
          });
        });
      }

      // Tenant payment deadline reminders (3, 2, 1 days before)
      const { data: tenantDeadline } = await (supabase as any)
        .from('payment_deadlines')
        .select('deadline_day, paid_month')
        .eq('user_id', user.id)
        .eq('role', 'tenant')
        .maybeSingle();

      if (tenantDeadline?.deadline_day) {
        const currentMonth = getCurrentMonth();
        if (tenantDeadline.paid_month !== currentMonth) {
          const today = new Date();
          const deadlineDay = tenantDeadline.deadline_day;
          const deadlineDate = new Date(today.getFullYear(), today.getMonth(), deadlineDay);
          const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays >= 0 && diffDays <= 3) {
            const msg = diffDays === 0
              ? t('notifTenantDeadlineToday')
              : t('notifTenantDeadlineDays', { days: diffDays, day: deadlineDay });
            items.push({
              id: `tenant-deadline-${currentMonth}`,
              title: t('notifTenantDeadlineTitle'),
              message: msg,
              type: 'payment_deadline',
              is_read: false,
              created_at: new Date().toISOString(),
              action: 'open_chat_admin',
            });
          }
        }
      }
    }

    // ===== ADMIN notifications =====
    if (role === 'admin') {
      const { data: pendingRequests } = await supabase
        .from('room_requests')
        .select('id, status, created_at, tenant_id, rooms(title, room_number)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(30);

      if (pendingRequests) {
        const tenantIds = [...new Set(pendingRequests.map((r: any) => r.tenant_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', tenantIds.length > 0 ? tenantIds : ['none']);
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

        pendingRequests.forEach((req: any) => {
          const roomTitle = req.rooms?.title || t('notifRoom');
          const roomNumber = req.rooms?.room_number || '';
          const tenantName = nameMap.get(req.tenant_id) || t('notifUser');
          items.push({ id: `admin-req-${req.id}`, title: t('notifAdminNewReq'), message: t('notifAdminNewReqMsg', { tenant: tenantName, room: roomNumber, title: roomTitle }), type: 'admin_request', is_read: false, created_at: req.created_at, link: `/admin?tab=requests&highlight=${req.id}` });
        });
      }

      const { data: pendingReports } = await (supabase as any)
        .from('room_reports')
        .select('id, content, created_at, reporter_name')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (pendingReports) {
        pendingReports.forEach((report: any) => {
          items.push({ id: `report-${report.id}`, title: t('notifNewReport'), message: report.content?.slice(0, 80) || t('notifNewReportDefault'), type: 'report', is_read: false, created_at: report.created_at, link: '/admin/reports' });
        });
      }

      const { data: resetRequests } = await supabase
        .from('password_reset_requests')
        .select('id, email, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (resetRequests) {
        resetRequests.forEach((req: any) => {
          items.push({ id: `reset-${req.id}`, title: t('notifPwReset'), message: t('notifPwResetMsg', { email: req.email }), type: 'password_reset', is_read: false, created_at: req.created_at, link: '/admin?tab=password-reset' });
        });
      }
    }

    // ===== LANDLORD notifications =====
    if (role === 'landlord') {
      const { data: myRooms } = await supabase
        .from('rooms')
        .select('id')
        .eq('landlord_id', user.id);

      if (myRooms && myRooms.length > 0) {
        const roomIds = myRooms.map((r: any) => r.id);
        const { data: forwardedReqs } = await supabase
          .from('room_requests')
          .select('id, status, created_at, tenant_id, landlord_viewed, rooms(title, room_number)')
          .eq('status', 'forwarded')
          .in('room_id', roomIds)
          .order('created_at', { ascending: false })
          .limit(30);

        if (forwardedReqs) {
          const tenantIds = [...new Set(forwardedReqs.map((r: any) => r.tenant_id))];
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', tenantIds.length > 0 ? tenantIds : ['none']);
          const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

          forwardedReqs.forEach((req: any) => {
            const roomTitle = req.rooms?.title || t('notifRoom');
            const roomNumber = req.rooms?.room_number || '';
            const tenantName = nameMap.get(req.tenant_id) || t('notifUser');
            items.push({ id: `landlord-req-${req.id}`, title: t('notifLandlordReq'), message: t('notifLandlordReqMsg', { tenant: tenantName, room: roomNumber, title: roomTitle }), type: 'landlord_request', is_read: false, created_at: req.created_at, link: '/landlord' });
          });
        }
      }

      const { data: payments } = await supabase
        .from('payment_requests')
        .select('id, status, created_at, amount')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (payments) {
        payments.forEach((p: any) => {
          const msg = p.amount
            ? t('notifPaymentAmount', { amount: new Intl.NumberFormat('vi-VN').format(p.amount) })
            : t('notifPaymentMsg');
          items.push({ id: `payment-${p.id}`, title: t('notifPayment'), message: msg, type: 'payment', is_read: false, created_at: p.created_at, link: '/landlord' });
        });
      }

      // Landlord payment deadline notification (on/after deadline day)
      const { data: sharedDeadline } = await (supabase as any)
        .from('payment_deadlines')
        .select('deadline_day')
        .is('user_id', null)
        .eq('role', 'landlord')
        .maybeSingle();

      if (sharedDeadline?.deadline_day) {
        const currentMonth = getCurrentMonth();
        const { data: individual } = await (supabase as any)
          .from('payment_deadlines')
          .select('paid_month')
          .eq('user_id', user.id)
          .eq('role', 'landlord')
          .maybeSingle();

        const paidMonth = individual?.paid_month || null;
        if (paidMonth !== currentMonth) {
          const today = new Date().getDate();
          if (today >= sharedDeadline.deadline_day) {
            items.push({
              id: `landlord-deadline-${currentMonth}`,
              title: t('notifLandlordDeadlineTitle'),
              message: t('notifLandlordDeadlineMsg'),
              type: 'landlord_payment_deadline',
              is_read: false,
              created_at: new Date().toISOString(),
              action: 'landlord_feedback',
            });
          }
        }
      }
    }

    // ===== ALL ROLES: unread messages =====
    const { data: unreadMessages } = await supabase
      .from('messages')
      .select('id, content, sender_id, created_at')
      .eq('receiver_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (unreadMessages) {
      const senderIds = [...new Set(unreadMessages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds.length > 0 ? senderIds : ['none']);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      unreadMessages.forEach(msg => {
        const senderName = nameMap.get(msg.sender_id) || t('notifUser');
        items.push({ id: `msg-${msg.id}`, title: t('notifMessage', { sender: senderName }), message: msg.content.length > 80 ? msg.content.slice(0, 80) + '...' : msg.content, type: 'message', is_read: false, created_at: msg.created_at, link: `?chat=${msg.sender_id}` });
      });
    }

    // ===== ALL ROLES: feedback replies =====
    const { data: feedbackReplies } = await (supabase as any)
      .from('feedbacks')
      .select('id, content, admin_reply, replied_at, status')
      .eq('user_id', user.id)
      .eq('status', 'replied')
      .order('replied_at', { ascending: false })
      .limit(10);

    if (feedbackReplies) {
      feedbackReplies.forEach((fb: any) => {
        items.push({
          id: `feedback-reply-${fb.id}`,
          title: '💬 Admin đã trả lời phản hồi',
          message: fb.admin_reply?.slice(0, 100) || 'Phản hồi của bạn đã được trả lời.',
          type: 'feedback_reply',
          is_read: false,
          created_at: fb.replied_at || fb.created_at,
        });
      });
    }

    // ===== ALL ROLES: system notifications =====
    const { data: sysNotifs } = await supabase
      .from('notifications')
      .select('id, title, content, target_role, created_at')
      .or(`target_role.eq.all,target_role.eq.${role}`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (sysNotifs) {
      sysNotifs.forEach((n: any) => {
        // Translate payment-related system notifications
        let translatedTitle = n.title;
        let translatedContent = n.content;
        let action: 'open_chat_admin' | 'landlord_feedback' | undefined = undefined;

        // Detect payment deadline notifications by pattern
        const deadlineLandlordMatch = n.content?.match(/Admin đã đặt hạn thanh toán chung cho tất cả chủ trọ: ngày (\d+)/);
        const deadlineTenantMatch = n.content?.match(/Admin đã đặt hạn thanh toán cho (.+): ngày (\d+)/);
        const confirmTenantMatch = n.content?.match(/Thanh toán tháng (\d+) của (.+) đã được xác nhận/);
        const confirmLandlordMatch = n.content?.match(/Thanh toán tháng (\d+) của chủ trọ (.+) đã được xác nhận/);

        if (deadlineLandlordMatch) {
          translatedTitle = t('notifSysDeadlineLandlordTitle');
          translatedContent = t('notifSysDeadlineLandlordMsg', { day: deadlineLandlordMatch[1] });
        } else if (deadlineTenantMatch) {
          translatedTitle = t('notifSysDeadlineTenantTitle');
          translatedContent = t('notifSysDeadlineTenantMsg', { name: deadlineTenantMatch[1], day: deadlineTenantMatch[2] });
          action = 'open_chat_admin';
        } else if (confirmLandlordMatch) {
          translatedTitle = t('notifSysConfirmTenantTitle');
          translatedContent = t('notifSysConfirmLandlordMsg', { month: confirmLandlordMatch[1], name: confirmLandlordMatch[2] });
        } else if (confirmTenantMatch) {
          translatedTitle = t('notifSysConfirmTenantTitle');
          translatedContent = t('notifSysConfirmTenantMsg', { month: confirmTenantMatch[1], name: confirmTenantMatch[2] });
        }

        items.push({
          id: `sys-${n.id}`,
          title: t('notifSystem', { title: translatedTitle }),
          message: translatedContent?.slice(0, 120) || '',
          type: 'system',
          is_read: false,
          created_at: n.created_at,
          action,
        });
      });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setNotifications(items);
  }, [user, role, t]);

  const markAsRead = (id: string) => {
    const newReadIds = new Set(readIds);
    newReadIds.add(id);
    setReadIds(newReadIds);
    saveReadIds(newReadIds);
  };

  const markAllAsRead = () => {
    const newReadIds = new Set(readIds);
    notifications.forEach(n => newReadIds.add(n.id));
    setReadIds(newReadIds);
    saveReadIds(newReadIds);
  };

  const handleNotifClick = async (notif: NotificationItem) => {
    markAsRead(notif.id);
    setOpen(false);

    if (notif.action === 'open_chat_admin') {
      // Dispatch custom event to open chat with admin
      const { data: adminId } = await supabase.rpc('get_admin_user_id');
      if (adminId) {
        window.dispatchEvent(new CustomEvent('open-chat', { detail: { userId: adminId } }));
      }
      return;
    }

    if (notif.action === 'landlord_feedback') {
      setFeedbackContent('');
      setFeedbackOpen(true);
      return;
    }

    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleSendFeedback = async () => {
    if (!user) return;
    setFeedbackSending(true);

    const { data: adminId } = await supabase.rpc('get_admin_user_id');
    if (!adminId) {
      toast({ title: t('error'), description: t('notifFeedbackAdminNotFound'), variant: 'destructive' });
      setFeedbackSending(false);
      return;
    }

    const messageContent = feedbackContent.trim()
      ? `${t('notifFeedbackDefaultMsg')}\n${feedbackContent.trim()}`
      : t('notifFeedbackDefaultMsg');

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: adminId,
      content: messageContent,
    });

    setFeedbackSending(false);
    setFeedbackOpen(false);

    if (error) {
      toast({ title: t('error'), description: t('notifFeedbackError'), variant: 'destructive' });
    } else {
      toast({ title: t('notifFeedbackSent') });
    }
  };

  useEffect(() => {
    if (!user || !role) return;

    buildNotifications();

    const channels: any[] = [];

    channels.push(
      supabase.channel('notif-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => buildNotifications())
        .subscribe()
    );

    channels.push(
      supabase.channel('notif-room-requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_requests' }, () => buildNotifications())
        .subscribe()
    );

    if (role === 'landlord' || role === 'admin' || role === 'tenant') {
      channels.push(
        supabase.channel('notif-payments')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => buildNotifications())
          .subscribe()
      );
    }

    if (role === 'admin') {
      channels.push(
        supabase.channel('notif-reports')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'room_reports' }, () => buildNotifications())
          .subscribe()
      );

      channels.push(
        supabase.channel('notif-pw-resets')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, () => buildNotifications())
          .subscribe()
      );
    }

    channels.push(
      supabase.channel('notif-system')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => buildNotifications())
        .subscribe()
    );

    const pollTimer = setInterval(buildNotifications, 30000);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollTimer);
    };
  }, [user, role, buildNotifications]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('notifJustNow');
    if (diffMin < 60) return t('notifMinAgo', { min: diffMin });
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return t('notifHourAgo', { hour: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('notifDayAgo', { day: diffDays });
  };

  if (!user) return null;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="font-semibold text-sm">{t('notifications')}</h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
                <CheckCheck className="h-3 w-3 mr-1" />
                {t('markAllRead')}
              </Button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                {t('noNotifications')}
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notif) => {
                  const isRead = readIds.has(notif.id);
                  return (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${!isRead ? 'bg-primary/5' : ''}`}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${!isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {notif.title}
                            </p>
                            {!isRead && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">{formatTime(notif.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Landlord feedback dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('notifFeedbackTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('notifFeedbackDesc')}
            </p>
            <Textarea
              value={feedbackContent}
              onChange={e => setFeedbackContent(e.target.value)}
              placeholder={t('notifFeedbackPlaceholder')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>{t('notifFeedbackCancel')}</Button>
            <Button onClick={handleSendFeedback} disabled={feedbackSending}>
              {feedbackSending ? t('notifFeedbackSending') : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  {t('notifFeedbackConfirm')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

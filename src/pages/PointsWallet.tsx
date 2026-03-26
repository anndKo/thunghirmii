// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { generateFingerprint } from '@/lib/security';
import { Loader2, Star, Gift, Gamepad2, CalendarCheck, Trophy, Sparkles, ExternalLink, Award, Target, ChevronRight, Coins, HeartHandshake, Clock, History } from 'lucide-react';
import { MilestoneCelebration } from '@/components/MilestoneCelebration';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const ACTION_LABELS = {
  find_nearby: { label: 'Tìm vị trí gần nhất', desc: 'Sử dụng tính năng tìm phòng gần bạn', icon: '📍', route: '/rooms?nearby=1' },
  view_room: { label: 'Xem chi tiết phòng', desc: 'Xem chi tiết một phòng bất kì', icon: '🏠', route: '/rooms' },
  send_request: { label: 'Gửi yêu cầu thuê phòng', desc: 'Gửi yêu cầu thuê tới chủ phòng', icon: '📨', route: '/rooms' },
};

const STREAK_LEVELS = [
  { days: 3, icon: '🔥', label: '3 ngày', color: 'bg-green-100 text-green-600' },
  { days: 7, icon: '⚡', label: '7 ngày', color: 'bg-blue-100 text-blue-600' },
  { days: 30, icon: '🌟', label: '30 ngày', color: 'bg-purple-100 text-purple-600' },
  { days: 60, icon: '💎', label: '60 ngày', color: 'bg-pink-100 text-pink-600' },
  { days: 90, icon: '👑', label: '90 ngày', color: 'bg-yellow-100 text-yellow-600' },
  { days: 180, icon: '🚀', label: '180 ngày', color: 'bg-indigo-100 text-indigo-600' },
  { days: 365, icon: '🏆', label: '1 năm', color: 'bg-orange-100 text-orange-600' },
  { days: 730, icon: '🌈', label: '2 năm', color: 'bg-rose-100 text-rose-600' },
];

const getCurrentStreakLevel = (streak) => {
  if (streak === 0) return null;
  return [...STREAK_LEVELS].reverse().find(l => streak >= l.days) || null;
};

const getNextStreakLevel = (streak) => {
  return STREAK_LEVELS.find(l => l.days > streak) || null;
};

export default function PointsWallet() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [points, setPoints] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [activeGames, setActiveGames] = useState([]);
  const [rewardActions, setRewardActions] = useState([]);
  const [todayProgress, setTodayProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [streak, setStreak] = useState(0);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [friendHelpConfig, setFriendHelpConfig] = useState(null);
  const [helpFriendId, setHelpFriendId] = useState('');
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpHistory, setHelpHistory] = useState([]);
  const [showHelpHistory, setShowHelpHistory] = useState(false);
  const [helpedToday, setHelpedToday] = useState(false);
  const currentStreakLevel = getCurrentStreakLevel(streak);
  const nextStreakLevel = getNextStreakLevel(streak);

  const calculateStreak = (dates) => {
    if (!dates || dates.length === 0) return 0;
    let s = 0;
    let current = new Date();
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i].checkin_date);
      const diff = Math.round(
        (new Date(current).setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)
      );
      if (diff === 0 || diff === 1) {
        s++;
        current = d;
      } else {
        break;
      }
    }
    return s;
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const todayStart = new Date(today).toISOString();
    const todayEnd = new Date(today + 'T23:59:59.999Z').toISOString();

    const [pointsRes, checkinRes, gamesRes, actionsRes, historyRes, checkinHistoryRes, friendHelpRes, helpedTodayRes] = await Promise.all([
      supabase.from('user_points').select('total_points').eq('user_id', user.id).single(),
      supabase.from('daily_checkins').select('id').eq('user_id', user.id).eq('checkin_date', today).maybeSingle(),
      supabase.from('mini_games').select('*').lte('start_time', now).gte('end_time', now).order('created_at', { ascending: false }),
      supabase.from('reward_actions').select('*').eq('is_active', true),
      supabase.from('reward_history').select('action_type, points').eq('user_id', user.id).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('daily_checkins').select('checkin_date').eq('user_id', user.id).order('checkin_date', { ascending: false }),
      supabase.from('settings').select('value').eq('key', 'friend_help_config').maybeSingle(),
      supabase.from('friend_helps').select('id').eq('helper_id', user.id).gte('created_at', todayStart).lte('created_at', todayEnd).maybeSingle(),
    ]);

    setPoints(pointsRes.data?.total_points || 0);
    setCheckedInToday(!!checkinRes.data);
    setActiveGames(gamesRes.data || []);
    setRewardActions(actionsRes.data || []);
    const progress = {};
    (historyRes.data || []).forEach(h => {
      progress[h.action_type] = (progress[h.action_type] || 0) + 1;
    });
    setTodayProgress(progress);
    setStreak(calculateStreak(checkinHistoryRes.data));
    setHelpedToday(!!helpedTodayRes.data);
    
    if (friendHelpRes.data?.value) {
      const cfg = friendHelpRes.data.value;
      const now2 = new Date();
      const start = cfg.start_date ? new Date(cfg.start_date) : null;
      const end = cfg.end_date ? new Date(cfg.end_date + 'T23:59:59') : null;
      if (cfg.enabled && (!start || now2 >= start) && (!end || now2 <= end)) {
        setFriendHelpConfig(cfg);
      } else {
        setFriendHelpConfig(null);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCheckin = async () => {
    if (!user || checkedInToday) return;
    setCheckingIn(true);

    // Device fingerprint anti-cheat
    try {
      const fp = await generateFingerprint();
      const { data: deviceUsed } = await supabase.rpc('check_device_reward_today', { _fingerprint: fp });
      if (deviceUsed) {
        setDeviceBlocked(true);
        setCheckingIn(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase.from('daily_checkins').select('id').eq('user_id', user.id).eq('checkin_date', today).maybeSingle();
      if (existing) { setCheckedInToday(true); setCheckingIn(false); return; }

      const { error } = await supabase.from('daily_checkins').insert({ user_id: user.id, checkin_date: today, device_fingerprint: fp });
      if (error) { toast({ title: 'Lỗi', description: 'Điểm danh thất bại', variant: 'destructive' }); setCheckingIn(false); return; }

      const { data: existingPts } = await supabase.from('user_points').select('total_points').eq('user_id', user.id).single();
      if (existingPts) {
        await supabase.from('user_points').update({ total_points: existingPts.total_points + 1, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      } else {
        await supabase.from('user_points').insert({ user_id: user.id, total_points: 1 });
      }

      setPoints(p => p + 1);
      setCheckedInToday(true);
      setCheckingIn(false);
      setStreak(s => s + 1);
      toast({ title: '🎉 Điểm danh thành công!', description: '+1 điểm thưởng' });
    } catch {
      // Fallback without fingerprint
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('daily_checkins').insert({ user_id: user.id, checkin_date: today });
      if (!error) {
        const { data: existingPts } = await supabase.from('user_points').select('total_points').eq('user_id', user.id).single();
        if (existingPts) {
          await supabase.from('user_points').update({ total_points: existingPts.total_points + 1 }).eq('user_id', user.id);
        } else {
          await supabase.from('user_points').insert({ user_id: user.id, total_points: 1 });
        }
        setPoints(p => p + 1);
        setCheckedInToday(true);
        setStreak(s => s + 1);
        toast({ title: '🎉 Điểm danh thành công!', description: '+1 điểm thưởng' });
      }
      setCheckingIn(false);
    }
  };

  const handleHelpFriend = async () => {
    if (!user || !helpFriendId.trim()) return;
    setHelpSubmitting(true);

    // Find user by display_id
    const { data: targetSettings } = await supabase.from('user_settings')
      .select('user_id').eq('display_id', helpFriendId.trim()).maybeSingle();
    
    if (!targetSettings) {
      toast({ title: 'Lỗi', description: 'Không tìm thấy ID người dùng', variant: 'destructive' });
      setHelpSubmitting(false);
      return;
    }

    if (targetSettings.user_id === user.id) {
      toast({ title: 'Lỗi', description: 'Không thể tự trợ giúp chính mình', variant: 'destructive' });
      setHelpSubmitting(false);
      return;
    }

    // Check if already helped today
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today).toISOString();
    const todayEnd = new Date(today + 'T23:59:59.999Z').toISOString();
    const { data: alreadyHelped } = await supabase.from('friend_helps')
      .select('id').eq('helper_id', user.id).gte('created_at', todayStart).lte('created_at', todayEnd).maybeSingle();
    
    if (alreadyHelped) {
      toast({ title: '⚠️ Đã trợ giúp hôm nay', description: 'Mỗi ngày chỉ được trợ giúp 1 lần', variant: 'destructive' });
      setHelpSubmitting(false);
      return;
    }

    // Record friend help
    const { error } = await supabase.from('friend_helps').insert({
      helper_id: user.id,
      helped_user_id: targetSettings.user_id,
    });

    if (error) {
      toast({ title: 'Lỗi', description: 'Trợ giúp thất bại', variant: 'destructive' });
      setHelpSubmitting(false);
      return;
    }

    // Give 1 point to the helped user
    const { data: helpedPts } = await supabase.from('user_points')
      .select('total_points').eq('user_id', targetSettings.user_id).single();
    if (helpedPts) {
      await supabase.from('user_points').update({ total_points: helpedPts.total_points + 1 }).eq('user_id', targetSettings.user_id);
    } else {
      await supabase.from('user_points').insert({ user_id: targetSettings.user_id, total_points: 1 });
    }

    setHelpedToday(true);
    setHelpFriendId('');
    setHelpSubmitting(false);
    toast({ title: '💖 Trợ giúp thành công!', description: 'Bạn bè đã nhận được 1 điểm' });
  };

  const fetchHelpHistory = async () => {
    const { data } = await supabase.from('friend_helps')
      .select('*').eq('helper_id', user.id).order('created_at', { ascending: false }).limit(20);
    setHelpHistory(data || []);
    setShowHelpHistory(true);
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const prevMilestone = currentStreakLevel ? currentStreakLevel.days : 0;
  const nextMilestone = nextStreakLevel ? nextStreakLevel.days : (currentStreakLevel ? currentStreakLevel.days : 3);
  const progressPct = nextStreakLevel
    ? Math.min(100, Math.round(((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
    : 100;

  return (
    <div className="min-h-screen bg-background relative">
      <Header />
      <MilestoneCelebration streak={streak} userId={user.id} />

      <div className="container py-6 max-w-2xl px-4">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Gift className="h-7 w-7 text-primary" /> Ví Điểm
        </h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            {/* Points Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-secondary p-5 text-primary-foreground">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Tổng điểm thưởng</p>
                    <p className="text-3xl font-bold">{points} <span className="text-base font-normal">điểm</span></p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Daily Checkin */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <CalendarCheck className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">Điểm danh hằng ngày</h3>
                    <p className="text-xs text-muted-foreground">Mỗi ngày +1 điểm</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${currentStreakLevel?.color || 'bg-muted text-muted-foreground'} transition-all duration-300 shadow-sm`}>
                    {currentStreakLevel?.icon || '🔥'}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-orange-500">🔥 {streak} ngày liên tiếp</span>
                    {nextStreakLevel && (
                      <p className="text-xs text-muted-foreground">Mốc tiếp: {nextStreakLevel.icon} {nextStreakLevel.label}</p>
                    )}
                    {!nextStreakLevel && streak > 0 && (
                      <p className="text-xs text-muted-foreground">🎉 Đã đạt mốc cao nhất!</p>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{currentStreakLevel ? `${currentStreakLevel.icon} ${currentStreakLevel.label}` : '0 ngày'}</span>
                    <span>{nextStreakLevel ? `${nextStreakLevel.icon} ${nextStreakLevel.label}` : '🏆 Max'}</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    {streak}/{nextStreakLevel ? nextStreakLevel.days : streak} ngày
                  </p>
                </div>

                {checkedInToday ? (
                  <div className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                    <Sparkles className="h-3 w-3" />
                    <span className="text-xs font-medium">Đã điểm danh ✓</span>
                  </div>
                ) : (
                  <Button onClick={handleCheckin} disabled={checkingIn} size="sm" className="bg-gradient-primary hover:opacity-90 gap-1 rounded-full px-4">
                    {checkingIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                    Điểm danh
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Friend Help */}
            {friendHelpConfig && (
              <Card className="hover:shadow-lg transition-shadow border-pink-200 dark:border-pink-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                      <HeartHandshake className="h-5 w-5 text-pink-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">Trợ giúp bạn bè</h3>
                      <p className="text-xs text-muted-foreground">Mỗi ngày giúp 1 người bạn nhận 1 điểm</p>
                    </div>
                  </div>

                  {friendHelpConfig.end_date && (() => {
                    const end = new Date(friendHelpConfig.end_date + 'T23:59:59');
                    const now2 = new Date();
                    const remaining = end.getTime() - now2.getTime();
                    if (remaining > 0 && remaining < 86400000) {
                      const h = Math.floor(remaining / 3600000);
                      const m = Math.floor((remaining % 3600000) / 60000);
                      return (
                        <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full w-fit">
                          <Clock className="h-3 w-3" />
                          <span>Kết thúc trong {h}h {m}m</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {helpedToday ? (
                    <div className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                      <Sparkles className="h-3 w-3" />
                      <span className="text-xs font-medium">Đã trợ giúp hôm nay ✓</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nhập ID bạn bè (VD: TT123456)"
                        value={helpFriendId}
                        onChange={(e) => setHelpFriendId(e.target.value)}
                        className="text-sm"
                      />
                      <Button onClick={handleHelpFriend} disabled={helpSubmitting || !helpFriendId.trim()} size="sm" className="bg-gradient-primary hover:opacity-90 gap-1 shrink-0">
                        {helpSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <HeartHandshake className="h-3 w-3" />}
                        Giúp
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="mt-2 text-xs gap-1 text-muted-foreground" onClick={fetchHelpHistory}>
                    <History className="h-3 w-3" /> Xem lịch sử giúp đỡ
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Reward Actions */}
            {rewardActions.length > 0 && (
              <div>
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" /> Nhiệm vụ điểm thưởng
                </h2>
                <div className="space-y-2">
                  {rewardActions.map((action) => {
                    const meta = ACTION_LABELS[action.action_type] || { label: action.action_type, desc: '', icon: '⭐' };
                    const done = todayProgress[action.action_type] || 0;
                    const maxed = done >= action.max_per_day;
                    return (
                      <Card key={action.id} className="hover:shadow transition-shadow cursor-pointer" onClick={() => setSelectedAction(action)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <span className="text-2xl flex-shrink-0">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{meta.label}</p>
                            <p className="text-xs text-muted-foreground">+{action.points} điểm · {done}/{action.max_per_day} hôm nay</p>
                          </div>
                          {maxed ? (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex-shrink-0">Hoàn thành ✓</span>
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mini Games */}
            <div>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" /> Mini Game đang diễn ra
              </h2>
              {activeGames.length === 0 ? (
                <Card className="text-center py-8">
                  <CardContent>
                    <Gamepad2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium text-sm">Hiện tại chưa có mini game nào.</p>
                    <p className="text-xs text-muted-foreground mt-1">Hãy quay lại sau nhé! 🎮</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {activeGames.map((game) => (
                    <Card key={game.id} className="hover:shadow-lg transition-all hover:scale-[1.01]">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3 mb-2">
                          <img src={game.logo_url} alt={game.title} className="w-11 h-11 rounded-xl object-cover shadow-md flex-shrink-0" />
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1 min-w-0">{game.title || 'Mini Game'}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">⏰ Đến {new Date(game.end_time).toLocaleDateString('vi-VN')}</p>
                        <a href={game.link} target="_blank" rel="noopener noreferrer" className="block">
                          <Button size="sm" className="w-full gap-1 rounded-full bg-gradient-primary hover:opacity-90">
                            <ExternalLink className="h-3 w-3" /> Tham gia
                          </Button>
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={(v) => { if (!v) setSelectedAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Chi tiết nhiệm vụ
            </DialogTitle>
          </DialogHeader>
          {selectedAction && (() => {
            const meta = ACTION_LABELS[selectedAction.action_type] || { label: selectedAction.action_type, desc: '', icon: '⭐' };
            const done = todayProgress[selectedAction.action_type] || 0;
            return (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <span className="text-5xl">{meta.icon}</span>
                  <h3 className="text-lg font-bold mt-3">{meta.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
                </div>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Điểm thưởng:</span>
                      <span className="font-bold text-primary">+{selectedAction.points} điểm/lần</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tối đa/ngày:</span>
                      <span className="font-medium">{selectedAction.max_per_day} lần</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Đã hoàn thành hôm nay:</span>
                      <span className={`font-medium ${done >= selectedAction.max_per_day ? 'text-green-600' : 'text-amber-600'}`}>
                        {done}/{selectedAction.max_per_day}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                {done >= selectedAction.max_per_day ? (
                  <p className="text-center text-green-600 font-medium text-sm">🎉 Bạn đã hoàn thành nhiệm vụ hôm nay!</p>
                ) : (
                  <Button
                    className="w-full bg-gradient-primary hover:opacity-90 gap-2"
                    onClick={() => { setSelectedAction(null); navigate(meta.route || '/rooms'); }}
                  >
                    🚀 Thực hiện ngay
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Device blocked dialog */}
      <Dialog open={deviceBlocked} onOpenChange={setDeviceBlocked}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">⚠️ Thông báo</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="font-medium">Bạn đã nhận điểm thưởng hôm nay rồi.</p>
            <p className="text-sm text-muted-foreground mt-2">Vui lòng dùng tài khoản chính.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help History Dialog */}
      <Dialog open={showHelpHistory} onOpenChange={setShowHelpHistory}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Lịch sử trợ giúp
            </DialogTitle>
          </DialogHeader>
          {helpHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa có lịch sử trợ giúp</p>
          ) : (
            <div className="space-y-2">
              {helpHistory.map(h => (
                <Card key={h.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                    <span className="text-xs font-medium text-pink-600">💖 +1 điểm</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

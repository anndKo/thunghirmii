// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateFingerprint } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';

export function RewardCoinToast() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [pts, setPts] = useState(0);
  const [rewardActions, setRewardActions] = useState([]);
  const [todayProgress, setTodayProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const fetchActions = async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today).toISOString();
      const todayEnd = new Date(today + 'T23:59:59.999Z').toISOString();
      const [actionsRes, historyRes] = await Promise.all([
        supabase.from('reward_actions').select('*').eq('is_active', true),
        supabase.from('reward_history').select('action_type, points').eq('user_id', user.id).gte('created_at', todayStart).lte('created_at', todayEnd),
      ]);
      setRewardActions(actionsRes.data || []);
      const progress: Record<string, number> = {};
      (historyRes.data || []).forEach((h: any) => {
        progress[h.action_type] = (progress[h.action_type] || 0) + 1;
      });
      setTodayProgress(progress);
    };
    fetchActions();
  }, [user]);

  const handleReward = useCallback(async (e: any) => {
    if (!user) return;
    const { actionType } = e.detail;
    const action = rewardActions.find((a: any) => a.action_type === actionType);
    if (!action) return;

    const todayCount = todayProgress[actionType] || 0;
    if (todayCount >= action.max_per_day) return;

    // Device fingerprint anti-cheat check
    try {
      const fp = await generateFingerprint();
      const { data: deviceUsed } = await supabase.rpc('check_device_reward_today', {
        _fingerprint: fp,
        _action_type: actionType,
      });
      if (deviceUsed) {
        toast({
          title: '⚠️ Thông báo',
          description: 'Bạn đã nhận điểm thưởng hôm nay rồi. Vui lòng dùng tài khoản chính.',
          variant: 'destructive',
        });
        return;
      }

      // Record history with fingerprint
      const { error } = await supabase.from('reward_history').insert({
        user_id: user.id,
        action_type: actionType,
        points: action.points,
        device_fingerprint: fp,
      });
      if (error) return;
    } catch {
      // If fingerprint fails, still try without it
      const { error } = await supabase.from('reward_history').insert({
        user_id: user.id,
        action_type: actionType,
        points: action.points,
      });
      if (error) return;
    }

    // Update points
    const { data: existingPts } = await supabase.from('user_points').select('total_points').eq('user_id', user.id).single();
    if (existingPts) {
      await supabase.from('user_points').update({ total_points: existingPts.total_points + action.points, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    } else {
      await supabase.from('user_points').insert({ user_id: user.id, total_points: action.points });
    }

    setTodayProgress(p => ({ ...p, [actionType]: (p[actionType] || 0) + 1 }));

    // Show coin animation
    setPts(action.points);
    setShow(true);
    setTimeout(() => setShow(false), 2200);
  }, [user, rewardActions, todayProgress, toast]);

  useEffect(() => {
    window.addEventListener('reward-action', handleReward);
    return () => window.removeEventListener('reward-action', handleReward);
  }, [handleReward]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      <div className="animate-coin-float flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-center text-2xl border-4 border-amber-300">
          <Coins className="h-8 w-8 text-amber-800" />
        </div>
        <span className="text-xl font-bold text-amber-500 mt-2 drop-shadow-lg">+{pts} điểm</span>
      </div>
    </div>
  );
}

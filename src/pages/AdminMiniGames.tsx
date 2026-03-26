// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Gamepad2, ArrowLeft, ExternalLink, Upload, X, Award, Users, Search, History, ChevronLeft, HeartHandshake } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const ACTION_LABELS = {
  find_nearby: 'Tìm vị trí gần nhất',
  view_room: 'Xem chi tiết phòng',
  send_request: 'Gửi yêu cầu thuê phòng',
};

export default function AdminMiniGames() {
  const { user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [deleteGame, setDeleteGame] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [visibility, setVisibility] = useState('all');

  // Reward actions
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardActions, setRewardActions] = useState([]);
  const [rewardForm, setRewardForm] = useState({ find_nearby: false, view_room: false, send_request: false });
  const [rewardPoints, setRewardPoints] = useState({ find_nearby: 1, view_room: 1, send_request: 1 });
  const [rewardMaxPerDay, setRewardMaxPerDay] = useState({ find_nearby: 1, view_room: 1, send_request: 1 });
  const [rewardSubmitting, setRewardSubmitting] = useState(false);

  // Points management
  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsUsers, setPointsUsers] = useState([]);
  const [pointsSearch, setPointsSearch] = useState('');
  const [pointsLoading, setPointsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteReward, setDeleteReward] = useState(null);

  // Friend help config
  const [friendHelpEnabled, setFriendHelpEnabled] = useState(false);
  const [friendHelpStart, setFriendHelpStart] = useState('');
  const [friendHelpEnd, setFriendHelpEnd] = useState('');
  const [savingFriendHelp, setSavingFriendHelp] = useState(false);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('mini_games').select('*').order('created_at', { ascending: false });
    setGames(data || []);
    setLoading(false);
  }, []);

  const fetchRewardActions = useCallback(async () => {
    const { data } = await supabase.from('reward_actions').select('*');
    setRewardActions(data || []);
  }, []);

  useEffect(() => { fetchGames(); fetchRewardActions(); fetchFriendHelpConfig(); }, [fetchGames, fetchRewardActions]);

  const fetchFriendHelpConfig = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'friend_help_config').maybeSingle();
    if (data?.value) {
      const cfg = data.value as any;
      setFriendHelpEnabled(cfg.enabled || false);
      setFriendHelpStart(cfg.start_date || '');
      setFriendHelpEnd(cfg.end_date || '');
    }
  };

  const saveFriendHelpConfig = async () => {
    setSavingFriendHelp(true);
    const config = { enabled: friendHelpEnabled, start_date: friendHelpStart, end_date: friendHelpEnd };
    const { data: existing } = await supabase.from('settings').select('id').eq('key', 'friend_help_config').maybeSingle();
    if (existing) {
      await supabase.from('settings').update({ value: config as any, updated_at: new Date().toISOString() }).eq('key', 'friend_help_config');
    } else {
      await supabase.from('settings').insert({ key: 'friend_help_config', value: config as any });
    }
    setSavingFriendHelp(false);
    toast({ title: '✅ Đã lưu', description: 'Cấu hình trợ giúp bạn bè đã được cập nhật' });
  };

  const resetForm = () => {
    setTitle(''); setLink(''); setStartTime(''); setEndTime('');
    setLogoFile(null); setLogoPreview(''); setEditingGame(null); setVisibility('all');
  };

  const openCreate = () => { resetForm(); setFormOpen(true); };

  const openEdit = (game) => {
    setEditingGame(game);
    setTitle(game.title);
    setLink(game.link);
    setStartTime(game.start_time.slice(0, 16));
    setEndTime(game.end_time.slice(0, 16));
    setLogoPreview(game.logo_url);
    setLogoFile(null);
    setVisibility(game.visibility || 'all');
    setFormOpen(true);
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !link.trim() || !startTime || !endTime) {
      toast({ title: 'Lỗi', description: 'Vui lòng điền đầy đủ thông tin', variant: 'destructive' });
      return;
    }
    if (!editingGame && !logoFile) {
      toast({ title: 'Lỗi', description: 'Vui lòng upload logo', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    let logoUrl = editingGame?.logo_url || '';

    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `minigame-logos/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('room-media').upload(path, logoFile);
      if (uploadError) {
        toast({ title: 'Lỗi', description: 'Upload logo thất bại', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('room-media').getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    const payload = {
      title, link, logo_url: logoUrl, visibility,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
    };

    if (editingGame) {
      const { error } = await supabase.from('mini_games').update(payload).eq('id', editingGame.id);
      if (error) toast({ title: 'Lỗi', description: 'Cập nhật thất bại', variant: 'destructive' });
      else toast({ title: 'Thành công', description: 'Đã cập nhật mini game' });
    } else {
      const { error } = await supabase.from('mini_games').insert({ ...payload, created_by: user.id });
      if (error) toast({ title: 'Lỗi', description: 'Tạo thất bại', variant: 'destructive' });
      else toast({ title: 'Thành công', description: 'Đã tạo mini game mới' });
    }

    setSubmitting(false);
    setFormOpen(false);
    resetForm();
    fetchGames();
  };

  const handleDelete = async () => {
    if (!deleteGame) return;
    setSubmitting(true);
    const { error } = await supabase.from('mini_games').delete().eq('id', deleteGame.id);
    setSubmitting(false);
    if (error) toast({ title: 'Lỗi', description: 'Xóa thất bại', variant: 'destructive' });
    else { toast({ title: 'Thành công', description: 'Đã xóa mini game' }); setDeleteGame(null); fetchGames(); }
  };

  // Delete reward action
  const handleDeleteReward = async () => {
    if (!deleteReward) return;
    setSubmitting(true);
    const { error } = await supabase.from('reward_actions').delete().eq('id', deleteReward.id);
    setSubmitting(false);
    if (error) toast({ title: 'Lỗi', description: 'Xóa nhiệm vụ thất bại', variant: 'destructive' });
    else { toast({ title: 'Thành công', description: 'Đã xóa nhiệm vụ điểm thưởng' }); setDeleteReward(null); fetchRewardActions(); }
  };

  const handleRewardSubmit = async () => {
    const selected = Object.entries(rewardForm).filter(([, v]) => v);
    if (selected.length === 0) {
      toast({ title: 'Lỗi', description: 'Chọn ít nhất 1 hành động', variant: 'destructive' });
      return;
    }
    setRewardSubmitting(true);

    for (const [actionType] of selected) {
      const existing = rewardActions.find(a => a.action_type === actionType);
      if (existing) {
        await supabase.from('reward_actions').update({
          points: rewardPoints[actionType],
          max_per_day: rewardMaxPerDay[actionType],
          is_active: true,
        }).eq('id', existing.id);
      } else {
        await supabase.from('reward_actions').insert({
          action_type: actionType,
          points: rewardPoints[actionType],
          max_per_day: rewardMaxPerDay[actionType],
          created_by: user.id,
        });
      }
    }

    setRewardSubmitting(false);
    setRewardOpen(false);
    toast({ title: 'Thành công', description: 'Đã tạo/cập nhật điểm thưởng' });
    fetchRewardActions();
  };

  // Points management - show ALL users including 0 points
  const fetchPointsUsers = async () => {
    setPointsLoading(true);
    // Fetch all profiles (all users)
    const { data: allProfiles } = await supabase.from('profiles').select('user_id, full_name');
    if (!allProfiles || allProfiles.length === 0) { setPointsUsers([]); setPointsLoading(false); return; }

    const allUserIds = allProfiles.map(p => p.user_id);
    const [ptsRes, settingsRes] = await Promise.all([
      supabase.from('user_points').select('user_id, total_points').in('user_id', allUserIds),
      supabase.from('user_settings').select('user_id, display_id').in('user_id', allUserIds),
    ]);

    const pointsMap = Object.fromEntries((ptsRes.data || []).map(p => [p.user_id, p.total_points]));
    const settingsMap = Object.fromEntries((settingsRes.data || []).map(s => [s.user_id, s.display_id]));

    const merged = allProfiles.map(p => ({
      user_id: p.user_id,
      full_name: p.full_name || '—',
      display_id: settingsMap[p.user_id] || '—',
      total_points: pointsMap[p.user_id] ?? 0,
    }));
    // Sort by points descending
    merged.sort((a, b) => b.total_points - a.total_points);
    setPointsUsers(merged);
    setPointsLoading(false);
  };

  const fetchUserHistory = async (userId) => {
    setHistoryLoading(true);
    setSelectedUser(userId);
    const { data } = await supabase.from('reward_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setUserHistory(data || []);
    setHistoryLoading(false);
  };

  const filteredUsers = pointsUsers.filter(u =>
    !pointsSearch.trim() || u.display_id.toLowerCase().includes(pointsSearch.toLowerCase())
  );

  const getStatus = (game) => {
    const now = new Date();
    const start = new Date(game.start_time);
    const end = new Date(game.end_time);
    if (now < start) return { label: 'Sắp diễn ra', color: 'bg-amber-100 text-amber-800' };
    if (now > end) return { label: 'Đã kết thúc', color: 'bg-muted text-muted-foreground' };
    return { label: 'Đang diễn ra', color: 'bg-green-100 text-green-800' };
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gamepad2 className="h-7 w-7 text-primary" /> Quản lý Mini Game
            </h1>
            <p className="text-muted-foreground text-sm">Tạo và quản lý các mini game cho người dùng</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button onClick={openCreate} className="gap-2 bg-gradient-primary hover:opacity-90">
            <Plus className="h-4 w-4" /> Tạo Mini Game
          </Button>
          <Button onClick={() => setRewardOpen(true)} variant="outline" className="gap-2">
            <Award className="h-4 w-4" /> Tạo điểm thưởng
          </Button>
          <Button onClick={() => { setPointsOpen(true); fetchPointsUsers(); }} variant="outline" className="gap-2">
            <Users className="h-4 w-4" /> Quản lí điểm
          </Button>
        </div>

        {/* Existing reward actions display */}
        {rewardActions.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Nhiệm vụ điểm thưởng đang hoạt động:</h3>
            <div className="flex flex-wrap gap-2">
              {rewardActions.filter(a => a.is_active).map(a => (
                <span key={a.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Award className="h-3 w-3" />
                  {ACTION_LABELS[a.action_type] || a.action_type} (+{a.points} điểm, tối đa {a.max_per_day}/ngày)
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteReward(a); }}
                    className="ml-1 hover:text-destructive transition-colors"
                    title="Xóa nhiệm vụ"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Friend Help Config */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                  <HeartHandshake className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Trợ giúp bạn bè</p>
                  <p className="text-xs text-muted-foreground">Người dùng giúp bạn bè nhận 1 điểm/ngày</p>
                </div>
              </div>
              <Switch checked={friendHelpEnabled} onCheckedChange={setFriendHelpEnabled} />
            </div>
            {friendHelpEnabled && (
              <div className="space-y-3 pl-13">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Ngày bắt đầu</Label>
                    <Input type="date" value={friendHelpStart} onChange={(e) => setFriendHelpStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ngày kết thúc</Label>
                    <Input type="date" value={friendHelpEnd} onChange={(e) => setFriendHelpEnd(e.target.value)} />
                  </div>
                </div>
                <Button onClick={saveFriendHelpConfig} disabled={savingFriendHelp} size="sm" className="bg-gradient-primary hover:opacity-90 gap-1">
                  {savingFriendHelp ? <Loader2 className="h-3 w-3 animate-spin" /> : <HeartHandshake className="h-3 w-3" />}
                  Lưu cấu hình
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : games.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Gamepad2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">Chưa có mini game nào</p>
              <p className="text-muted-foreground text-sm mb-4">Bấm "Tạo Mini Game" để bắt đầu</p>
              <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Tạo ngay</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => {
              const status = getStatus(game);
              return (
                <Card key={game.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square relative bg-muted">
                    <img src={game.logo_url} alt={game.title} className="w-full h-full object-cover" />
                    <span className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium bg-background/80 text-foreground">
                      {game.visibility === 'authenticated' ? '🔒 Có tài khoản' : '🌐 Tất cả'}
                    </span>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-lg truncate">{game.title || 'Mini Game'}</h3>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Bắt đầu: {new Date(game.start_time).toLocaleString('vi-VN')}</p>
                      <p>Kết thúc: {new Date(game.end_time).toLocaleString('vi-VN')}</p>
                    </div>
                    <a href={game.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Mở link
                    </a>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(game)} className="flex-1 gap-1">
                        <Pencil className="h-3 w-3" /> Sửa
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteGame(game)} className="flex-1 gap-1">
                        <Trash2 className="h-3 w-3" /> Xóa
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGame ? 'Chỉnh sửa Mini Game' : 'Tạo Mini Game mới'}</DialogTitle>
            <DialogDescription>Điền thông tin để {editingGame ? 'cập nhật' : 'tạo'} mini game</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên Mini Game</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tên mini game" />
            </div>
            <div className="space-y-2">
              <Label>Logo Mini Game (1:1)</Label>
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(''); }} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  </label>
                )}
                {!logoPreview && <span className="text-sm text-muted-foreground">Chọn ảnh tỷ lệ 1:1</span>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link Mini Game</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <div className="space-y-2">
              <Label>Vai trò hiển thị</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={visibility === 'all' ? 'default' : 'outline'} onClick={() => setVisibility('all')} className="flex-1">
                  🌐 Tất cả
                </Button>
                <Button type="button" size="sm" variant={visibility === 'authenticated' ? 'default' : 'outline'} onClick={() => setVisibility('authenticated')} className="flex-1">
                  🔒 Có tài khoản
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Thời gian bắt đầu</Label>
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Thời gian kết thúc</Label>
                <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>Hủy</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGame ? 'Cập nhật' : 'Tạo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteGame} onOpenChange={(v) => { if (!v) setDeleteGame(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>Bạn có chắc chắn muốn xóa mini game "{deleteGame?.title}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGame(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reward Actions Dialog */}
      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Tạo điểm thưởng tương tác</DialogTitle>
            <DialogDescription>Chọn hành động và cấu hình điểm thưởng</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(ACTION_LABELS).map(([key, label]) => {
              const existing = rewardActions.find(a => a.action_type === key);
              return (
                <Card key={key} className={`transition-all ${rewardForm[key] ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rewardForm[key]}
                        onChange={(e) => setRewardForm(p => ({ ...p, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-input accent-primary"
                      />
                      <span className="font-medium text-sm">{label}</span>
                      {existing?.is_active && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Đang hoạt động</span>}
                    </label>
                    {rewardForm[key] && (
                      <div className="grid grid-cols-2 gap-3 pl-7">
                        <div className="space-y-1">
                          <Label className="text-xs">Số điểm</Label>
                          <Input
                            type="number" min={1}
                            value={rewardPoints[key]}
                            onChange={(e) => setRewardPoints(p => ({ ...p, [key]: parseInt(e.target.value) || 1 }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tối đa/ngày</Label>
                          <Input
                            type="number" min={1}
                            value={rewardMaxPerDay[key]}
                            onChange={(e) => setRewardMaxPerDay(p => ({ ...p, [key]: parseInt(e.target.value) || 1 }))}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRewardOpen(false)}>Hủy</Button>
            <Button onClick={handleRewardSubmit} disabled={rewardSubmitting} className="bg-gradient-primary hover:opacity-90">
              {rewardSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points Management Dialog */}
      <Dialog open={pointsOpen} onOpenChange={(v) => { if (!v) { setPointsOpen(false); setSelectedUser(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Quản lí điểm thưởng</DialogTitle>
          </DialogHeader>

          {selectedUser ? (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Quay lại
              </Button>
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Lịch sử nhận thưởng
              </h3>
              {historyLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : userHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa có lịch sử nhận thưởng</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {userHistory.map(h => (
                    <Card key={h.id} className="hover:shadow transition-shadow">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{ACTION_LABELS[h.action_type] || h.action_type}</p>
                          <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString('vi-VN')}</p>
                        </div>
                        <span className="text-sm font-bold text-primary">+{h.points} điểm</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo ID tài khoản..."
                  value={pointsSearch}
                  onChange={(e) => setPointsSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {pointsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Không tìm thấy tài khoản nào</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {filteredUsers.map(u => (
                    <Card key={u.id} className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.01]" onClick={() => fetchUserHistory(u.user_id)}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">ID: {u.display_id}</p>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold text-sm flex-shrink-0">
                          <Award className="h-4 w-4" /> {u.total_points} điểm
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Reward Confirmation */}
      <Dialog open={!!deleteReward} onOpenChange={(v) => { if (!v) setDeleteReward(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa nhiệm vụ</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa nhiệm vụ "{ACTION_LABELS[deleteReward?.action_type] || deleteReward?.action_type}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReward(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteReward} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

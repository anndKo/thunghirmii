// @ts-nocheck
import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { invalidateExchangeCache } from '@/hooks/useExchangeConfig';
import { ArrowLeft, Loader2, Coins, MapPin, Eye, Phone, Image, Video, Save } from 'lucide-react';

const FEATURES = [
  { key: 'find_nearby', label: 'Tìm vị trí gần nhất', desc: 'Áp dụng trang chủ & tìm kiếm phòng', icon: MapPin },
  { key: 'view_address', label: 'Xem địa chỉ', desc: 'Xem địa chỉ chi tiết phòng trọ', icon: Eye },
  { key: 'view_phone', label: 'Xem số điện thoại chủ trọ', desc: 'Xem SĐT liên hệ', icon: Phone },
  { key: 'view_photos', label: 'Xem ảnh phòng', desc: 'Xem gallery ảnh phòng', icon: Image },
  { key: 'view_videos', label: 'Xem video phòng', desc: 'Xem video phòng trọ', icon: Video },
];

const DEFAULT_CONFIG = {
  enabled: false,
  features: Object.fromEntries(FEATURES.map(f => [f.key, { enabled: false, points: 1 }])),
};

export default function AdminRewardExchange() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    if (!user || role !== 'admin') return;
    supabase.from('settings').select('value').eq('key', 'points_exchange_config').maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          setConfig({ ...DEFAULT_CONFIG, ...data.value, features: { ...DEFAULT_CONFIG.features, ...(data.value as any).features } });
        }
        setLoading(false);
      });
  }, [user, role]);

  const handleSave = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from('settings').select('id').eq('key', 'points_exchange_config').maybeSingle();
    let error;
    if (existing) {
      ({ error } = await supabase.from('settings').update({ value: config as any, updated_at: new Date().toISOString() }).eq('key', 'points_exchange_config'));
    } else {
      ({ error } = await supabase.from('settings').insert({ key: 'points_exchange_config', value: config as any }));
    }
    setSaving(false);
    invalidateExchangeCache();
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể lưu cấu hình', variant: 'destructive' });
    } else {
      toast({ title: '✅ Đã lưu', description: 'Cấu hình đổi điểm đã được cập nhật' });
    }
  };

  const updateFeature = (key: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      features: { ...prev.features, [key]: { ...prev.features[key], [field]: value } }
    }));
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 max-w-2xl px-4">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại Admin
        </Button>

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Coins className="h-7 w-7 text-amber-500" /> Quản lí điểm thưởng
        </h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            {/* Master toggle */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">Bật chức năng đổi điểm</p>
                  <p className="text-sm text-muted-foreground">Người dùng phải đổi điểm để mở khóa nội dung</p>
                </div>
                <Switch checked={config.enabled} onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))} />
              </CardContent>
            </Card>

            {/* Feature list */}
            {config.enabled && (
              <div className="space-y-3">
                <h2 className="text-base font-semibold">Danh sách chức năng</h2>
                {FEATURES.map(({ key, label, desc, icon: Icon }) => {
                  const feat = config.features[key] || { enabled: false, points: 1 };
                  return (
                    <Card key={key} className={`transition-opacity ${feat.enabled ? '' : 'opacity-60'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{label}</p>
                              <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                          </div>
                          <Switch checked={feat.enabled} onCheckedChange={(v) => updateFeature(key, 'enabled', v)} />
                        </div>
                        {feat.enabled && (
                          <div className="flex items-center gap-3 pl-12">
                            <Label className="text-sm whitespace-nowrap">Số điểm đổi:</Label>
                            <Input
                              type="number"
                              min={1}
                              value={feat.points}
                              onChange={(e) => updateFeature(key, 'points', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">điểm</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Save button */}
            <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-primary hover:opacity-90 gap-2" size="lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu cấu hình
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

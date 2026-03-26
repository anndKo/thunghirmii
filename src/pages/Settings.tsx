// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Camera, Save, Loader2, User, Lock, UserCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

type Tab = "profile" | "password";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url" as any)
        .eq("user_id", user.id)
        .single();
      if (data) {
        const d = data as any;
        setFullName(d.full_name || "");
        setPhone(d.phone || "");
        setAvatarUrl(d.avatar_url);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Ảnh quá lớn", description: "Tối đa 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const size = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d")!;
      const sx = (bitmap.width - size) / 2;
      const sy = (bitmap.height - size) / 2;
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 400, 400);

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
      );

      const filePath = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase
        .from("profiles")
        .update({ avatar_url: newUrl } as any)
        .eq("user_id", user.id);

      setAvatarUrl(newUrl);
      toast({ title: "Đã cập nhật ảnh đại diện" });
    } catch (err) {
      console.error(err);
      toast({ title: "Lỗi tải ảnh", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Lỗi", description: "Không thể lưu", variant: "destructive" });
    } else {
      toast({ title: "Đã lưu thông tin" });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Mật khẩu mới phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã đổi mật khẩu thành công" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "profile", label: "Thông tin cá nhân", icon: <UserCircle size={18} /> },
    { key: "password", label: "Đổi mật khẩu", icon: <Lock size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-semibold text-lg text-foreground">Cài đặt tài khoản</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Tab buttons */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content with scroll */}
        <ScrollArea className="h-[calc(100vh-200px)]">
          {activeTab === "profile" && (
            <div className="space-y-6 pr-2">
              {/* Avatar */}
              <div className="bg-card rounded-xl border p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">ẢNH ĐẠI DIỆN</h3>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                      ) : null}
                      <AvatarFallback className="text-2xl bg-muted">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
                    >
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Chọn ảnh từ thiết bị</p>
                    <p className="text-xs">Tối đa 5MB · Tự động cắt 1:1</p>
                  </div>
                </div>
              </div>

              {/* Profile info */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">THÔNG TIN CÁ NHÂN</h3>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Email</label>
                  <Input value={user?.email || ""} disabled className="bg-muted" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Họ và tên</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nhập họ và tên" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Số điện thoại</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nhập số điện thoại" />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          )}

          {activeTab === "password" && (
            <div className="space-y-6 pr-2">
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">ĐỔI MẬT KHẨU</h3>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Mật khẩu mới</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Xác nhận mật khẩu mới</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
                <Button onClick={handleChangePassword} disabled={changingPassword} className="w-full gap-2">
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Đổi mật khẩu
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </main>
    </div>
  );
};

export default Settings;

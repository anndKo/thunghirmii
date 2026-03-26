// @ts-nocheck
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, X, FileVideo, Camera, UserCircle } from "lucide-react";

interface JoinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId?: string;
}

interface FileWithPreview {
  file: File;
  preview: string;
  progress: number;
  uploaded: boolean;
  url?: string;
}

const JoinModal = ({ open, onOpenChange, onSuccess, userId }: JoinModalProps) => {
  const [fullName, setFullName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [phone, setPhone] = useState("");
  const [score, setScore] = useState("");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill account ID from user's display_id
  useEffect(() => {
    if (!userId || !open) return;
    const fetchDisplayId = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("display_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.display_id) {
        setAccountId(data.display_id);
      } else {
        setAccountId(userId.slice(0, 12));
      }
    };
    fetchDisplayId();
  }, [userId, open]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Lỗi", description: "Vui lòng chọn file ảnh", variant: "destructive" });
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.min(img.width, img.height);
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d")!;
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], file.name, { type: "image/jpeg" });
          setAvatar(croppedFile);
          setAvatarPreview(URL.createObjectURL(blob));
        }
      }, "image/jpeg", 0.9);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const remaining = 5 - files.length;
      const toAdd = fileArray.slice(0, remaining);
      const mapped = toAdd.map((file) => ({
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
        progress: 0,
        uploaded: false,
      }));
      setFiles((prev) => [...prev, ...mapped]);
    },
    [files.length]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim() || !score.trim() || !accountId.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin", variant: "destructive" });
      return;
    }
    if (!avatar) {
      toast({ title: "Lỗi", description: "Vui lòng tải lên ảnh đại diện", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = crypto.randomUUID();
      const avatarPath = `avatars/${submissionId}.jpg`;
      const { error: avatarError } = await supabase.storage.from("uploads").upload(avatarPath, avatar);
      if (avatarError) throw avatarError;
      const { data: { publicUrl: avatarUrl } } = supabase.storage.from("uploads").getPublicUrl(avatarPath);

      const { error: subError } = await supabase.from("submissions").insert({
        id: submissionId,
        full_name: fullName.trim(),
        account_id: accountId.trim(),
        phone: phone.trim(),
        score: parseInt(score),
        status: "pending",
        avatar_url: avatarUrl,
      });
      if (subError) throw subError;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.file.name.split(".").pop();
        const path = `${submissionId}/${Date.now()}_${i}.${ext}`;
        setFiles((prev) => { const u = [...prev]; u[i] = { ...u[i], progress: 30 }; return u; });
        const { error: uploadError } = await supabase.storage.from("uploads").upload(path, f.file);
        if (uploadError) throw uploadError;
        setFiles((prev) => { const u = [...prev]; u[i] = { ...u[i], progress: 70 }; return u; });
        const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
        await supabase.from("submission_files").insert({ submission_id: submissionId, file_name: f.file.name, file_url: publicUrl, file_type: f.file.type });
        setFiles((prev) => { const u = [...prev]; u[i] = { ...u[i], progress: 100, uploaded: true, url: publicUrl }; return u; });
      }

      localStorage.setItem("my_submission", JSON.stringify({ id: submissionId, full_name: fullName.trim(), status: "pending" }));
      setFullName(""); setAccountId(""); setPhone(""); setScore(""); setFiles([]); setAvatar(null); setAvatarPreview(null);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Có lỗi xảy ra", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gradient">Tham Gia Bảng Xếp Hạng</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-2">
            <Label className="text-sm">Ảnh đại diện <span className="text-destructive">*</span></Label>
            <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-primary/50 transition-colors overflow-hidden group">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground group-hover:text-primary transition-colors">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Chọn ảnh</span>
                </div>
              )}
              {avatarPreview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>

          <div className="space-y-2">
            <Label>Họ và tên</Label>
            <Input placeholder="Nhập họ và tên..." value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-muted/50 border-border" />
          </div>

          <div className="space-y-2">
            <Label>ID tài khoản <span className="text-destructive">*</span></Label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ID tài khoản..."
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="bg-muted/50 border-border pl-9"
                readOnly={!!userId}
              />
            </div>
            {userId && <p className="text-xs text-muted-foreground">ID tự động lấy từ tài khoản của bạn</p>}
          </div>

          <div className="space-y-2">
            <Label>Số điện thoại liên hệ</Label>
            <Input placeholder="Nhập số điện thoại..." value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-muted/50 border-border" />
          </div>

          <div className="space-y-2">
            <Label>Số điểm</Label>
            <Input type="number" placeholder="Nhập số điểm..." value={score} onChange={(e) => setScore(e.target.value)} className="bg-muted/50 border-border" />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload ảnh / video (tối đa 5 file)</Label>
            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${dragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/30"} ${files.length >= 5 ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Kéo thả file vào đây hoặc <span className="text-primary font-medium">chọn file</span></p>
              <p className="text-xs text-muted-foreground mt-1">Hỗ trợ ảnh và video</p>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" />
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {files.map((f, i) => (
                  <div key={i} className="relative glass rounded-lg p-2 group">
                    <button onClick={() => removeFile(i)} className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </button>
                    {f.file.type.startsWith("image/") ? (
                      <img src={f.preview} alt={f.file.name} className="w-full h-20 object-cover rounded-md" />
                    ) : (
                      <div className="w-full h-20 flex items-center justify-center bg-muted rounded-md">
                        <FileVideo className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 truncate">{f.file.name}</p>
                    {f.progress > 0 && !f.uploaded && <Progress value={f.progress} className="h-1 mt-1" />}
                    {f.uploaded && <p className="text-xs text-green-400 mt-1">✓ Đã tải</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gradient-primary text-primary-foreground font-semibold h-12 text-base glow-primary hover:opacity-90 transition-opacity">
            {submitting ? "Đang gửi..." : "GỬI YÊU CẦU"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JoinModal;

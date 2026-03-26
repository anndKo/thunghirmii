// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  LogOut, Trash2, CheckCircle, Clock, Eye, Shield, Copy, Check, ArrowLeft, Users, BarChart3, FileCheck,
} from "lucide-react";
import TimeWindowSetting from "@/components/TimeWindowSetting";

interface Submission {
  id: string;
  full_name: string;
  phone: string;
  score: number;
  status: string;
  created_at: string;
  account_id?: string;
}

interface SubmissionFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
}

const CopyableId = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors group" title={id}>
      <span className="text-xs font-mono text-indigo-400 font-semibold">{id.slice(0, 8)}...</span>
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-indigo-400/60 group-hover:text-indigo-400 transition-colors" />}
    </button>
  );
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fileMap, setFileMap] = useState<Record<string, SubmissionFile[]>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Check admin role
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/"); return; }
    const checkRole = async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (data?.role !== "admin") {
        navigate("/");
        return;
      }
      setIsAdmin(true);
      setCheckingRole(false);
    };
    checkRole();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) fetchSubmissions();
  }, [isAdmin]);

  const fetchSubmissions = async () => {
    setLoading(true);
    const { data } = await supabase.from("submissions").select("*").order("created_at", { ascending: false });
    setSubmissions((data as Submission[]) || []);
    if (data && data.length > 0) {
      const { data: files } = await supabase.from("submission_files").select("*").in("submission_id", data.map((s: any) => s.id));
      const map: Record<string, SubmissionFile[]> = {};
      (files || []).forEach((f: any) => {
        if (!map[f.submission_id]) map[f.submission_id] = [];
        map[f.submission_id].push(f);
      });
      setFileMap(map);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    navigate("/admin");
  };

  const handleApprove = async (id: string) => {
    await supabase.from("submissions").update({ status: "approved" }).eq("id", id);
    toast({ title: "Đã duyệt yêu cầu ✓" });
    fetchSubmissions();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("submissions").delete().eq("id", deleteId);
    toast({ title: "Đã xoá yêu cầu" });
    setDeleteId(null);
    fetchSubmissions();
  };

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Truy cập bị từ chối</h1>
          <p className="text-gray-400">Bạn không có quyền truy cập trang này</p>
          <Button onClick={() => navigate("/")} variant="outline" className="border-white/20 text-gray-300 hover:bg-white/10">
            Về trang chủ
          </Button>
        </div>
      </div>
    );
  }

  const totalCount = submissions.length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="bg-[#161822] border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin")} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
            <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Quản lý Ranking
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-white/10">
            <LogOut className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Quay lại</span>
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-[#1a1d2e] border border-white/10 rounded-xl p-4 md:p-5 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xs md:text-sm text-gray-400">Tổng yêu cầu</p>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">{totalCount}</p>
          </div>
          <div className="bg-[#161822] border border-white/10 rounded-xl p-4 md:p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <FileCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs md:text-sm text-gray-400">Đã duyệt</p>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400">{approvedCount}</p>
          </div>
          <div className="bg-[#161822] border border-white/10 rounded-xl p-4 md:p-5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xs md:text-sm text-gray-400">Chờ duyệt</p>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-amber-400">{pendingCount}</p>
          </div>
        </div>

        {/* Time Window Setting */}
        <div className="bg-[#161822] border border-white/10 rounded-xl p-4 md:p-5">
          <h2 className="text-sm font-bold text-gray-100 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Cài đặt thời gian
          </h2>
          <TimeWindowSetting />
        </div>

        {/* Submissions List */}
        <div className="bg-[#161822] border border-white/10 rounded-xl p-4 md:p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Danh sách yêu cầu ({totalCount})
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl bg-white/5" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">Chưa có yêu cầu nào</div>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div key={sub.id} className="bg-[#1a1d2e] border border-white/5 rounded-xl p-4 md:p-5 transition-all duration-300 hover:border-indigo-500/30">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white">{sub.full_name}</h3>
                          {sub.status === "approved" ? (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Đã duyệt</span>
                          ) : (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Chờ duyệt</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500">ID:</span>
                          <CopyableId id={sub.id} />
                          {sub.account_id && (
                            <>
                              <span className="text-xs text-gray-500">· Tài khoản:</span>
                              <span className="text-xs font-medium text-gray-300">{sub.account_id}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">📞 {sub.phone} · 🏆 {sub.score} điểm</p>
                        <p className="text-xs text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(sub.created_at).toLocaleString("vi-VN")}
                        </p>
                        {fileMap[sub.id] && fileMap[sub.id].length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {fileMap[sub.id].map((f) => (
                              <button key={f.id} onClick={() => setPreviewImage(f.file_url)} className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded-md hover:border-indigo-400/30 transition-colors flex items-center gap-1 text-gray-400 hover:text-white">
                                <Eye className="w-3 h-3" />
                                {f.file_name.length > 20 ? f.file_name.slice(0, 20) + "..." : f.file_name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {sub.status === "pending" && (
                          <Button size="sm" onClick={() => handleApprove(sub.id)} className="bg-indigo-500 hover:bg-indigo-600 text-white border-0">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Duyệt</span>
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => setDeleteId(sub.id)}>
                          <Trash2 className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Xoá</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#1a1d2e] border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Xác nhận xoá</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">Bạn có chắc muốn xoá yêu cầu này? Hành động không thể hoàn tác.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-gray-300 hover:bg-white/10">Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 text-white hover:bg-red-600">Xác nhận xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 text-white text-3xl">✕</button>
          <img src={previewImage} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default Admin;

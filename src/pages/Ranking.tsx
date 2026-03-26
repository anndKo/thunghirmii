// @ts-nocheck
import { Trophy, Plus, Users, Home } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Podium from "@/components/Podium";
import RankingList from "@/components/RankingList";
import JoinModal from "@/components/JoinModal";
import SuccessModal from "@/components/SuccessModal";
import SubmissionStatusBar from "@/components/SubmissionStatusBar";
import Fireworks from "@/components/Fireworks";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Submission {
  id: string;
  full_name: string;
  score: number;
  avatar_url: string | null;
  created_at: string;
}

interface TimeWindow {
  enabled: boolean;
  start: string | null;
  end: string | null;
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>({ enabled: false, start: null, end: null });
  const [fireworksActive, setFireworksActive] = useState(false);
  const prevTop3Ref = useRef<string[]>([]);

  const fetchSubmissions = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data } = await supabase
      .from("submissions")
      .select("id, full_name, score, avatar_url, created_at")
      .eq("status", "approved")
      .order("score", { ascending: false })
      .limit(100);
    const newSubs = (data as Submission[]) || [];
    const newTop3Ids = newSubs.slice(0, 3).map((s) => s.id);
    const prevTop3 = prevTop3Ref.current;
    if (prevTop3.length > 0 && newTop3Ids.length > 0) {
      const changed = newTop3Ids.some((id, i) => id !== prevTop3[i]);
      if (changed) {
        setFireworksActive(true);
        setTimeout(() => setFireworksActive(false), 100);
      }
    }
    prevTop3Ref.current = newTop3Ids;
    setSubmissions(newSubs);
    setLoading(false);
  };

  const fetchTimeWindow = async () => {
    const { data } = await supabase.from("settings").select("value").eq("key", "time_window").single();
    if (data) setTimeWindow(data.value as unknown as TimeWindow);
  };

  useEffect(() => {
    fetchSubmissions();
    fetchTimeWindow();
    const channel = supabase
      .channel("ranking-updates")
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "submissions" }, () => fetchSubmissions(false))
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "submissions" }, () => fetchSubmissions(false))
      .on("postgres_changes" as any, { event: "DELETE", schema: "public", table: "submissions" }, () => fetchSubmissions(false))
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "settings" }, () => fetchTimeWindow())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);


  const handleJoinClick = () => {
    if (timeWindow.enabled) {
      const now = new Date();
      const start = timeWindow.start ? new Date(timeWindow.start) : null;
      const end = timeWindow.end ? new Date(timeWindow.end) : null;
      if (start && now < start) {
        toast({ title: "⏳ Chưa đến thời gian tham gia", description: `Thời gian bắt đầu: ${start.toLocaleString("vi-VN", { hour12: false })}`, variant: "destructive" });
        return;
      }
      if (end && now > end) {
        toast({ title: "⌛ Đã hết thời gian tham gia", description: `Thời gian kết thúc: ${end.toLocaleString("vi-VN", { hour12: false })}`, variant: "destructive" });
        return;
      }
    }
    setShowModal(true);
  };

  const handleSubmitSuccess = () => {
    fetchSubmissions();
    setShowSuccess(true);
  };

  const top3 = submissions.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden">
      <Fireworks active={fireworksActive} />

      {/* Background effects - dark theme */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* Home button - top left */}
      <button
        onClick={() => navigate("/")}
        className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 hover:border-indigo-400/30 transition-all duration-300 group"
        title="Về trang chủ"
      >
        <Home className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors" />
      </button>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 md:py-16">
        {/* Header */}
        <div className="text-center mb-8 md:mb-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 mb-4">
            <Trophy className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-gray-400">Bảng Xếp Hạng</span>
          </div>
          <h1 className="text-2xl md:text-5xl font-black text-white mb-3">
            Top <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">Xếp Hạng</span>
          </h1>
          <p className="text-gray-500 max-w-md mx-auto text-sm md:text-base">
            Khám phá những người có thành tích xuất sắc nhất
          </p>
        </div>

        {/* Time window notice */}
        {timeWindow.enabled && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 mb-6 text-center">
            <p className="text-xs md:text-sm text-gray-400">
              ⏰ Thời gian tham gia:{" "}
              <span className="text-white font-medium">
                {timeWindow.start ? new Date(timeWindow.start).toLocaleString("vi-VN", { hour12: false }) : "—"}
              </span>
              {" → "}
              <span className="text-white font-medium">
                {timeWindow.end ? new Date(timeWindow.end).toLocaleString("vi-VN", { hour12: false }) : "—"}
              </span>
            </p>
          </div>
        )}

        {/* Podium */}
        <div className="mb-10 md:mb-12">
          {!loading && top3.length > 0 && <Podium top3={top3} />}
          {!loading && top3.length === 0 && (
            <div className="text-center py-12 md:py-16 text-gray-500">
              Chưa có ai tham gia bảng xếp hạng
            </div>
          )}
          {loading && (
            <div className="flex items-end justify-center gap-4 h-52">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-1 max-w-[140px] bg-white/5 rounded-t-xl animate-pulse" style={{ height: `${180 - i * 30}px` }} />
              ))}
            </div>
          )}
        </div>

        {/* Join Button */}
        <div className="flex justify-center mb-8 md:mb-10">
          <Button
            onClick={handleJoinClick}
            size="lg"
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-base md:text-lg px-6 md:px-8 h-12 md:h-14 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all duration-300 hover:scale-105 gap-2 border-0"
          >
            <Plus className="w-5 h-5" />
            THAM GIA
          </Button>
        </div>

        {/* Full Ranking List */}
        <div className="mb-8 pb-20">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h2 className="text-lg md:text-xl font-bold text-white">Danh sách xếp hạng</h2>
            <div className="inline-flex items-center gap-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-3 py-1">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs md:text-sm font-medium text-gray-400">{submissions.length} người tham gia</span>
            </div>
          </div>
          <RankingList entries={submissions} loading={loading} />
        </div>
      </div>

      <JoinModal
        open={showModal}
        onOpenChange={setShowModal}
        onSuccess={handleSubmitSuccess}
        userId={user?.id}
      />

      <SuccessModal open={showSuccess} onClose={() => setShowSuccess(false)} />
      <SubmissionStatusBar submissions={submissions} />
    </div>
  );
};

export default Index;

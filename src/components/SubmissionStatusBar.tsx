// @ts-nocheck
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Trophy, Loader2 } from "lucide-react";

interface SubmissionStatus {
  id: string;
  full_name: string;
  status: "pending" | "approved";
}

const SubmissionStatusBar = ({ submissions }: { submissions: { id: string; full_name: string; score: number }[] }) => {
  const [status, setStatus] = useState<SubmissionStatus | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("my_submission");
    if (saved) {
      const parsed = JSON.parse(saved) as SubmissionStatus;
      setStatus(parsed);
      // Check latest status from DB
      supabase
        .from("submissions")
        .select("id, full_name, status")
        .eq("id", parsed.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const updated = { id: data.id, full_name: data.full_name, status: data.status as "pending" | "approved" };
            setStatus(updated);
            localStorage.setItem("my_submission", JSON.stringify(updated));
          }
        });
    }
  }, []);

  // Re-check when submissions list changes (realtime)
  useEffect(() => {
    const saved = localStorage.getItem("my_submission");
    if (!saved) return;
    const parsed = JSON.parse(saved) as SubmissionStatus;
    supabase
      .from("submissions")
      .select("id, full_name, status")
      .eq("id", parsed.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const updated = { id: data.id, full_name: data.full_name, status: data.status as "pending" | "approved" };
          setStatus(updated);
          localStorage.setItem("my_submission", JSON.stringify(updated));
        }
      });
  }, [submissions]);

  if (!status) return null;

  const rank = status.status === "approved"
    ? submissions.findIndex((s) => s.id === status.id) + 1
    : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in-up">
      <div className="max-w-3xl mx-auto px-4 pb-4">
        {status.status === "pending" ? (
          <div className="bg-[#1a1a2e]/95 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-yellow-500/30 shadow-lg shadow-yellow-500/10">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-200">
                Xin chào, {status.full_name}!
              </p>
                <p className="text-xs text-gray-400">
                ⏳ Số điểm của bạn sẽ sớm được cập nhật trong danh sách trong vòng 24h để đảm bảo tính minh bạch
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1a2e]/95 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-primary/30 shadow-lg shadow-primary/10">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 glow-primary">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-200">
                🎉 Chúc mừng, {status.full_name}!
              </p>
              <p className="text-xs text-gray-400">
                Hạng của bạn là <span className="text-primary font-bold text-sm">#{rank > 0 ? rank : "—"}</span> trong bảng xếp hạng
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionStatusBar;

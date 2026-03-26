import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, Crown, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface RankingEntry {
  id: string;
  full_name: string;
  score: number;
  avatar_url?: string | null;
  created_at?: string;
}

interface RankingListProps {
  entries: RankingEntry[];
  loading: boolean;
}

const MarqueeName = ({ name }: { name: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (container && text) {
      setShouldScroll(text.scrollWidth > container.clientWidth);
    }
  }, [name]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden min-w-0">
      <span
        ref={textRef}
        className={`font-medium text-gray-200 whitespace-nowrap inline-block ${
          shouldScroll ? "animate-marquee-name" : ""
        }`}
      >
        {name}
      </span>
    </div>
  );
};

const RankingList = ({ entries, loading }: RankingListProps) => {
  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 1) return <Medal className="w-5 h-5 text-gray-600" />;
    if (rank === 2) return <Award className="w-5 h-5 text-orange-500" />;
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Chưa có dữ liệu xếp hạng
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className={`rounded-xl p-3 md:p-4 flex items-center gap-3 md:gap-4 transition-all duration-300 group cursor-pointer
            hover:scale-[1.02] hover:border-primary/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]
            ${
              index === 0
                ? "bg-gradient-to-r from-yellow-500/15 to-amber-400/10 border border-yellow-400/50 shadow-[0_0_40px_rgba(255,200,0,0.5)] scale-[1.03]"
                : index === 1
                ? "glass border border-gray-400/30"
                : index === 2
                ? "glass border border-orange-400/30"
                : "glass"
            }`}
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          {/* Rank */}
          <div
            className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center text-sm md:text-base
              ${
                index === 0 || index === 1 || index === 2
                  ? "bg-white shadow-md"
                  : "bg-[#374151] border border-white/10"
              }`}
          >
            {index < 3 && getRankIcon(index)}
            <span
              className={`font-extrabold text-xs md:text-sm ${
                index < 3
                  ? "text-black"
                  : "text-white font-bold"
              }`}
            >
              #{index + 1}
            </span>
          </div>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {entry.avatar_url ? (
              <img
                src={entry.avatar_url}
                alt={entry.full_name}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover ring-2 ring-border group-hover:ring-primary/50 transition-all"
              />
            ) : (
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-gray-300 group-hover:text-white transition-colors text-sm">
                {entry.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            {index === 0 && (
              <Crown className="absolute -top-2 -right-2 w-4 h-4 md:w-5 md:h-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(255,215,0,0.9)] animate-pulse" />
            )}
          </div>

          {/* Name - with marquee for long names */}
          <MarqueeName name={entry.full_name} />

          {/* Score + Time */}
          <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
            <span className="text-base md:text-xl font-extrabold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]">
              {entry.score} điểm
            </span>
            {entry.created_at && (
              <span className="text-[10px] md:text-[11px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(entry.created_at)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RankingList;

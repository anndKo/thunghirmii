import { Trophy } from "lucide-react";

interface PodiumEntry {
  full_name: string;
  score: number;
  avatar_url?: string | null;
}

interface PodiumProps {
  top3: PodiumEntry[];
}

const Podium = ({ top3 }: PodiumProps) => {
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const PodiumCard = ({
    entry,
    rank,
    delay,
  }: {
    entry?: PodiumEntry;
    rank: 1 | 2 | 3;
    delay: string;
  }) => {
    const config = {
      1: {
        height: "h-44 md:h-52",
        gradient: "from-yellow-200 via-yellow-300 to-yellow-500",
        border: "border-yellow-300/60",
        glow: "shadow-[0_0_25px_rgba(255,215,0,0.5)]",
        icon: "text-yellow-300",
        label: "🥇",
        avatarBg: "from-yellow-400 to-amber-500",
        order: "order-2",
        avatarSize: "w-20 h-20 md:w-24 md:h-24",
        float: "animate-float-slow",
        ring: "ring-yellow-300 ring-4",
        crownGlow: "shadow-[0_0_60px_rgba(255,215,0,0.6)]",
      },
      2: {
        height: "h-32 md:h-40",
        gradient: "from-slate-400/20 via-gray-300/10 to-slate-500/20",
        border: "border-slate-400/40",
        glow: "shadow-[0_0_16px_rgba(200,200,255,0.35)]",
        icon: "text-slate-300",
        label: "🥈",
        avatarBg: "from-slate-300 to-gray-400",
        order: "order-1",
        avatarSize: "w-16 h-16 md:w-20 md:h-20",
        float: "animate-float-medium",
        ring: "ring-slate-300 ring-3",
        crownGlow: "",
      },
      3: {
        height: "h-28 md:h-36",
        gradient: "from-orange-600/20 via-amber-700/10 to-orange-700/20",
        border: "border-orange-600/40",
        glow: "shadow-[0_0_6px_rgba(255,140,0,0.15)]",
        icon: "text-orange-400",
        label: "🥉",
        avatarBg: "from-orange-400 to-amber-600",
        order: "order-3",
        avatarSize: "w-16 h-16 md:w-20 md:h-20",
        float: "animate-float-medium",
        ring: "ring-orange-400 ring-3",
        crownGlow: "",
      },
    }[rank];

    if (!entry) return <div className={`flex-1 ${config.order}`} />;

    return (
      <div
        className={`flex-1 flex flex-col items-center ${config.order} animate-podium-rise`}
        style={{ animationDelay: delay }}
      >
        {/* Avatar with float */}
        <div className={`relative mb-3 ${config.float}`}>
          {rank === 1 && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl md:text-3xl z-10 animate-bounce-gentle">
              👑
            </div>
          )}
          {entry.avatar_url ? (
            <img
              src={entry.avatar_url}
              alt={entry.full_name}
              className={`${config.avatarSize} rounded-full object-cover shadow-lg ring-offset-2 ring-offset-background ${config.ring} ${config.crownGlow} transition-transform duration-500`}
            />
          ) : (
            <div
              className={`${config.avatarSize} rounded-full bg-gradient-to-br ${config.avatarBg} flex items-center justify-center text-2xl md:text-3xl font-bold shadow-lg ${config.crownGlow}`}
            >
              {entry.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 text-xl md:text-2xl">
            {config.label}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-sm md:text-base font-semibold text-foreground text-center mb-1 max-w-[120px] truncate">
          {entry.full_name}
        </h3>

        {/* Score */}
        <p className={`text-lg md:text-xl font-bold ${config.icon} mb-3 ${rank === 1 ? "animate-pulse-gentle" : ""}`}>
          {entry.score} điểm
        </p>

        {/* Podium block */}
        <div className="relative w-full">
  
         {rank === 1 && (
            <div className="absolute inset-0 bg-yellow-400/10 blur-xl opacity-50 rounded-t-xl"></div>
          )}
          
          {rank === 2 && (
            <div className="absolute inset-0 bg-slate-300/10 blur-lg opacity-40 rounded-t-xl"></div>
          )}
          
          {rank === 3 && (
            <div className="absolute inset-0 bg-orange-400/10 blur-lg opacity-30 rounded-t-xl"></div>
          )}
        
          <div
            className={`relative w-full ${config.height} rounded-t-xl bg-gradient-to-b ${config.gradient} border-t border-l border-r ${config.border} ${config.glow} flex items-start justify-center pt-4 transition-all duration-500
          
            after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-[2px]
            ${rank === 1
              ? "after:bg-gradient-to-r after:from-transparent after:via-white/80 after:to-transparent"
              : rank === 2
              ? "after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent"
              : "after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent"
            }
          
            ${rank === 1 
              ? "hover:scale-105 hover:shadow-[0_0_40px_rgba(255,215,0,0.6)]" 
              : rank === 2
              ? "hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(200,200,255,0.4)]"
              : "hover:scale-[1.02] hover:shadow-[0_0_12px_rgba(255,140,0,0.3)]"
            } cursor-pointer
            `}
          >
            <span
              className={`text-2xl md:text-3xl font-black ${
                rank === 1
                  ? "text-yellow-800 drop-shadow-[0_0_30px_rgba(255,215,0,0.45)]"
                  : rank === 2
                  ? "bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(200,200,255,0.4)]"
                  : "bg-gradient-to-b from-orange-300 via-amber-400 to-orange-600 bg-clip-text text-transparent drop-shadow-[0_0_2px_rgba(255,140,0,0.4)]"
              }`}
            >
              #{rank}
            </span>
          </div>
      
          
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-end gap-2 md:gap-4">
        <PodiumCard entry={second} rank={2} delay="0.2s" />
        <PodiumCard entry={first} rank={1} delay="0s" />
        <PodiumCard entry={third} rank={3} delay="0.4s" />
      </div>
    </div>
  );
};

export default Podium;

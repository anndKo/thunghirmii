import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_REGISTRATIONS_PER_DEVICE = 3;
const MAX_LOGIN_FAILS = 5;
const LOCKOUT_DURATIONS = [5 * 60, 15 * 60, 30 * 60, 24 * 3600, 0]; // seconds: 5min, 15min, 30min, 24hr, permanent(0)

function getSupabaseAdmin(): any {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function auditLog(
  supabase: any,
  event: {
    event_type: string;
    fingerprint_hash?: string;
    ip_address?: string;
    user_id?: string;
    email?: string;
    metadata?: Record<string, unknown>;
    risk_score?: number;
  }
) {
  await supabase.from("security_audit_log").insert(event);
}

// Check if device is blocked
async function isDeviceBlocked(
  supabase: any,
  fpHash: string
): Promise<{ blocked: boolean; until?: string }> {
  const { data } = await supabase
    .from("blocked_devices")
    .select("blocked_until")
    .eq("fingerprint_hash", fpHash)
    .maybeSingle();

  if (!data) return { blocked: false };

  if (data.blocked_until === null) return { blocked: true }; // permanent

  const until = new Date(data.blocked_until);
  if (until > new Date()) return { blocked: true, until: data.blocked_until };

  // Expired block - remove it
  await supabase
    .from("blocked_devices")
    .delete()
    .eq("fingerprint_hash", fpHash);
  return { blocked: false };
}

// Check registration limit
async function checkRegistrationLimit(
  supabase: any,
  fpHash: string
): Promise<{ allowed: boolean; count: number }> {
  const { count } = await supabase
    .from("device_fingerprints")
    .select("id", { count: "exact", head: true })
    .eq("fingerprint_hash", fpHash);

  return {
    allowed: (count || 0) < MAX_REGISTRATIONS_PER_DEVICE,
    count: count || 0,
  };
}

// Record registration
async function recordRegistration(
  supabase: any,
  fpHash: string,
  userId: string,
  userAgent: string,
  ip: string
) {
  await supabase.from("device_fingerprints").insert({
    fingerprint_hash: fpHash,
    user_id: userId,
    user_agent: userAgent,
    ip_address: ip,
  });
}

// Handle login attempt tracking
async function handleLoginAttempt(
  supabase: any,
  fpHash: string,
  ip: string,
  email: string,
  success: boolean,
  botScore: number
) {
  // Get or create attempt record
  const { data: existing } = await supabase
    .from("login_attempts")
    .select("*")
    .eq("fingerprint_hash", fpHash)
    .maybeSingle();

  if (success) {
    // Reset on success
    if (existing) {
      await supabase
        .from("login_attempts")
        .update({
          fail_count: 0,
          success: true,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("fingerprint_hash", fpHash);
    }
    return { locked: false };
  }

  // Failed attempt
  const newFailCount = (existing?.fail_count || 0) + 1;
  const currentLevel = existing?.lockout_level || 0;

  const attemptData = {
    fingerprint_hash: fpHash,
    ip_address: ip,
    email,
    success: false,
    fail_count: newFailCount,
    device_risk_score: Math.min(100, (existing?.device_risk_score || 0) + botScore + 10),
    is_bot_suspected: botScore > 50,
    last_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (newFailCount >= MAX_LOGIN_FAILS) {
    // Apply lockout
    const newLevel = Math.min(currentLevel + 1, LOCKOUT_DURATIONS.length - 1);
    const duration = LOCKOUT_DURATIONS[newLevel - 1] || LOCKOUT_DURATIONS[0];
    const lockoutUntil =
      duration === 0
        ? null // permanent
        : new Date(Date.now() + duration * 1000).toISOString();

    Object.assign(attemptData, {
      lockout_until: lockoutUntil,
      lockout_level: newLevel,
      fail_count: 0, // reset count after lockout
    });

    // If permanent, also block device
    if (duration === 0) {
      await supabase.from("blocked_devices").upsert({
        fingerprint_hash: fpHash,
        reason: "excessive_login_failures",
        blocked_until: null,
      });
    } else {
      await supabase.from("blocked_devices").upsert({
        fingerprint_hash: fpHash,
        reason: "login_lockout",
        blocked_until: lockoutUntil,
      });
    }

    await auditLog(supabase, {
      event_type: "lockout",
      fingerprint_hash: fpHash,
      ip_address: ip,
      email,
      metadata: { lockout_level: newLevel, lockout_until: lockoutUntil, fail_count: newFailCount },
      risk_score: (attemptData as any).device_risk_score,
    });
  }

  if (existing) {
    await supabase
      .from("login_attempts")
      .update(attemptData)
      .eq("fingerprint_hash", fpHash);
  } else {
    await supabase.from("login_attempts").insert(attemptData);
  }

  return {
    locked: newFailCount >= MAX_LOGIN_FAILS,
    remaining: Math.max(0, MAX_LOGIN_FAILS - newFailCount),
  };
}

// Compute bot risk score from client signals
function computeBotScore(signals: Record<string, unknown>): number {
  let score = 0;

  if (signals.webdriver === true) score += 40;
  if (signals.headless === true) score += 30;
  if (typeof signals.languages === "undefined" || (signals.languages as string[])?.length === 0)
    score += 15;
  if (signals.cpuCores === 0 || signals.cpuCores === undefined) score += 10;
  if (signals.timingAnomaly === true) score += 20;
  if (signals.missingFeatures === true) score += 15;

  return Math.min(100, score);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  try {
    const body = await req.json();
    const {
      action,
      fingerprint_hash,
      user_agent,
      email,
      success,
      user_id,
      bot_signals,
    } = body as {
      action: string;
      fingerprint_hash: string;
      user_agent?: string;
      email?: string;
      success?: boolean;
      user_id?: string;
      bot_signals?: Record<string, unknown>;
    };

    if (!fingerprint_hash || fingerprint_hash.length < 16) {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    // Skip block check for admin actions
    const isAdminAction = action === "admin_block_device" || action === "admin_unblock_device";

    // Check device block first (skip for admin actions)
    if (!isAdminAction) {
      const blockStatus = await isDeviceBlocked(supabase, fingerprint_hash);
      if (blockStatus.blocked) {
        // Fetch the reason
        const { data: blockData } = await supabase
          .from("blocked_devices")
          .select("reason")
          .eq("fingerprint_hash", fingerprint_hash)
          .maybeSingle();

        const reason = blockData?.reason || "hoạt động đáng ngờ";
        return jsonResponse(
          {
            error: "device_blocked",
            message: `Thiết bị đã bị cấm sử dụng do vi phạm: ${reason}`,
            reason,
            blocked_until: blockStatus.until || "permanent",
          },
          403
        );
      }
    }

    const botScore = bot_signals ? computeBotScore(bot_signals) : 0;

    // Bot detected
    if (botScore >= 70) {
      await auditLog(supabase, {
        event_type: "bot_detected",
        fingerprint_hash,
        ip_address: ip,
        email,
        metadata: { bot_signals, bot_score: botScore },
        risk_score: botScore,
      });

      return jsonResponse(
        {
          error: "suspicious_activity",
          message: "Phát hiện hoạt động đáng ngờ. Vui lòng thử lại sau.",
        },
        403
      );
    }

    switch (action) {
      case "check_register": {
        const { allowed, count } = await checkRegistrationLimit(
          supabase,
          fingerprint_hash
        );

        await auditLog(supabase, {
          event_type: "register_check",
          fingerprint_hash,
          ip_address: ip,
          email,
          metadata: { allowed, count, bot_score: botScore },
          risk_score: botScore,
        });

        if (!allowed) {
          return jsonResponse(
            {
              error: "registration_limit",
              message:
                "Thiết bị này đã đạt giới hạn đăng ký tài khoản. Vui lòng liên hệ hỗ trợ.",
            },
            403
          );
        }

        return jsonResponse({ allowed: true, remaining: MAX_REGISTRATIONS_PER_DEVICE - count });
      }

      case "record_register": {
        if (!user_id) return jsonResponse({ error: "Missing user_id" }, 400);

        await recordRegistration(
          supabase,
          fingerprint_hash,
          user_id,
          user_agent || "",
          ip
        );

        await auditLog(supabase, {
          event_type: "register",
          fingerprint_hash,
          ip_address: ip,
          user_id,
          email,
          metadata: { user_agent, bot_score: botScore },
          risk_score: botScore,
        });

        return jsonResponse({ success: true });
      }

      case "login_attempt": {
        // Upsert device fingerprint on login attempt
        if (user_id && success) {
          const { data: existingDev } = await supabase
            .from("device_fingerprints")
            .select("id")
            .eq("fingerprint_hash", fingerprint_hash)
            .eq("user_id", user_id)
            .maybeSingle();
          
          if (existingDev) {
            await supabase.from("device_fingerprints").update({
              user_agent: user_agent || "",
              ip_address: ip,
              created_at: new Date().toISOString(),
            }).eq("id", existingDev.id);
          } else {
            await supabase.from("device_fingerprints").insert({
              fingerprint_hash,
              user_id,
              user_agent: user_agent || "",
              ip_address: ip,
            });
          }

          // Check if user is banned — auto-block device on login
          const { data: banData } = await supabase
            .from("banned_users")
            .select("reason")
            .eq("user_id", user_id)
            .maybeSingle();

          if (banData) {
            // Auto-block this device
            await supabase.from("blocked_devices").upsert({
              fingerprint_hash,
              reason: banData.reason || "banned_user",
              blocked_until: null,
            }, { onConflict: "fingerprint_hash" });

            await auditLog(supabase, {
              event_type: "device_blocked",
              fingerprint_hash,
              ip_address: ip,
              user_id,
              email,
              metadata: { reason: banData.reason, auto_blocked: true },
              risk_score: 100,
            });

            return jsonResponse(
              {
                error: "device_blocked",
                message: `Thiết bị đã bị cấm sử dụng do vi phạm: ${banData.reason}`,
                reason: banData.reason,
                blocked_until: "permanent",
              },
              403
            );
          }
        }

        const result = await handleLoginAttempt(
          supabase,
          fingerprint_hash,
          ip,
          email || "",
          success || false,
          botScore
        );

        await auditLog(supabase, {
          event_type: success ? "login_success" : "login_fail",
          fingerprint_hash,
          ip_address: ip,
          email,
          user_id,
          metadata: { success, bot_score: botScore, ...result },
          risk_score: botScore,
        });

        if (result.locked) {
          // Get the lockout info
          const { data: lockInfo } = await supabase
            .from("login_attempts")
            .select("lockout_until, lockout_level")
            .eq("fingerprint_hash", fingerprint_hash)
            .maybeSingle();

          return jsonResponse(
            {
              error: "account_locked",
              message: lockInfo?.lockout_until === null
                ? "Thiết bị đã bị khóa vĩnh viễn. Vui lòng nhấn Quên mật khẩu để được hỗ trợ."
                : "Quá nhiều lần thử. Thiết bị đã bị tạm khóa.",
              lockout_until: lockInfo?.lockout_until || "permanent",
              lockout_level: lockInfo?.lockout_level || 0,
            },
            429
          );
        }

        return jsonResponse({
          success: true,
          remaining_attempts: result.remaining,
        });
      }

      case "check_status": {
        // Check if device can proceed
        const { data: attempt } = await supabase
          .from("login_attempts")
          .select("lockout_until, fail_count, device_risk_score")
          .eq("fingerprint_hash", fingerprint_hash)
          .maybeSingle();

        const locked =
          attempt?.lockout_until && new Date(attempt.lockout_until) > new Date();

        return jsonResponse({
          locked: !!locked,
          lockout_until: locked ? attempt.lockout_until : null,
          remaining_attempts: Math.max(
            0,
            MAX_LOGIN_FAILS - (attempt?.fail_count || 0)
          ),
          risk_score: attempt?.device_risk_score || 0,
        });
      }

      case "admin_block_device": {
        const { reason } = body as { reason?: string; fingerprint_hash: string };
        await supabase.from("blocked_devices").upsert({
          fingerprint_hash,
          reason: reason || "admin_blocked",
          blocked_until: null, // permanent
        }, { onConflict: "fingerprint_hash" });

        await auditLog(supabase, {
          event_type: "device_blocked",
          fingerprint_hash,
          ip_address: ip,
          metadata: { reason, blocked_by: "admin" },
          risk_score: 100,
        });

        return jsonResponse({ success: true });
      }

      case "admin_unblock_device": {
        await supabase
          .from("blocked_devices")
          .delete()
          .eq("fingerprint_hash", fingerprint_hash);

        // Also clear login attempts lockout
        await supabase
          .from("login_attempts")
          .update({ lockout_until: null, lockout_level: 0, fail_count: 0 })
          .eq("fingerprint_hash", fingerprint_hash);

        await auditLog(supabase, {
          event_type: "device_unblocked",
          fingerprint_hash,
          ip_address: ip,
          metadata: { unblocked_by: "admin" },
        });

        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("Security check error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});

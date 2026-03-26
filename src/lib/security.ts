// Device fingerprinting and bot detection utilities

import { supabase } from "@/integrations/supabase/client";

// Generate a HARDWARE-FOCUSED device fingerprint that stays consistent
// across different browsers, incognito mode, and browser updates on the same device.
// We intentionally EXCLUDE browser-specific signals (user agent, canvas rendering, etc.)
export async function generateFingerprint(): Promise<string> {
  const components: string[] = [];

  // === HARDWARE SIGNALS (same across all browsers on same device) ===
  
  // Screen hardware
  components.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(`pixelRatio:${window.devicePixelRatio}`);

  // CPU & Memory
  components.push(`cores:${navigator.hardwareConcurrency || 0}`);
  components.push(`mem:${(navigator as any).deviceMemory || 0}`);
  components.push(`platform:${navigator.platform}`);

  // Timezone (tied to device location settings, not browser)
  components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  // WebGL GPU info (same GPU regardless of browser)
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const glCtx = gl as WebGLRenderingContext;
      const debugInfo = glCtx.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        components.push(`gpu_vendor:${glCtx.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}`);
        components.push(`gpu_renderer:${glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`);
      }
      // Additional WebGL hardware params
      components.push(`gl_max_texture:${glCtx.getParameter(glCtx.MAX_TEXTURE_SIZE)}`);
      components.push(`gl_max_renderbuffer:${glCtx.getParameter(glCtx.MAX_RENDERBUFFER_SIZE)}`);
      components.push(`gl_max_viewport:${JSON.stringify(glCtx.getParameter(glCtx.MAX_VIEWPORT_DIMS))}`);
      components.push(`gl_max_vertex_attribs:${glCtx.getParameter(glCtx.MAX_VERTEX_ATTRIBS)}`);
      components.push(`gl_max_varying:${glCtx.getParameter(glCtx.MAX_VARYING_VECTORS)}`);
      components.push(`gl_max_vertex_uniforms:${glCtx.getParameter(glCtx.MAX_VERTEX_UNIFORM_VECTORS)}`);
      components.push(`gl_max_fragment_uniforms:${glCtx.getParameter(glCtx.MAX_FRAGMENT_UNIFORM_VECTORS)}`);
    }
  } catch {
    components.push("webgl:unsupported");
  }

  // Audio hardware (sample rate is hardware-dependent)
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    components.push(`audio_rate:${audioCtx.sampleRate}`);
    components.push(`audio_channels:${audioCtx.destination.maxChannelCount}`);
    audioCtx.close();
  } catch {
    components.push("audio:unsupported");
  }

  // Touch support (hardware capability)
  components.push(`touch:${navigator.maxTouchPoints || 0}`);
  
  // OS-level language (less likely to change than browser language)
  components.push(`lang:${navigator.language}`);

  // Hash all components using SHA-256
  const raw = components.join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Detect bot/automation signals
export function detectBotSignals(): Record<string, unknown> {
  const signals: Record<string, unknown> = {};

  // webdriver detection
  signals.webdriver = !!(navigator as any).webdriver;

  // Headless browser detection
  signals.headless =
    !window.outerWidth ||
    !window.outerHeight ||
    (window.outerWidth === 0 && window.outerHeight === 0);

  // Languages check
  signals.languages = navigator.languages;

  // CPU cores
  signals.cpuCores = navigator.hardwareConcurrency;

  // Missing browser features
  signals.missingFeatures =
    !(window as any).chrome && navigator.userAgent.includes("Chrome");

  // Permissions API (automation tools often have different behavior)
  signals.hasNotificationPermission = "Notification" in window;

  return signals;
}

// Track typing behavior for bot detection
export class BehaviorTracker {
  private keyTimings: number[] = [];
  private lastKeyTime = 0;
  private submitCount = 0;
  private lastSubmitTime = 0;

  recordKeystroke() {
    const now = Date.now();
    if (this.lastKeyTime > 0) {
      this.keyTimings.push(now - this.lastKeyTime);
    }
    this.lastKeyTime = now;
  }

  recordSubmit(): boolean {
    const now = Date.now();
    this.submitCount++;

    // Too fast submissions (< 1 second apart)
    if (this.lastSubmitTime > 0 && now - this.lastSubmitTime < 1000) {
      return true; // suspicious
    }

    this.lastSubmitTime = now;

    // Check typing pattern
    if (this.keyTimings.length > 5) {
      const avg = this.keyTimings.reduce((a, b) => a + b, 0) / this.keyTimings.length;
      // Extremely uniform typing (bot-like) or impossibly fast
      if (avg < 10) return true; // suspicious
      const variance =
        this.keyTimings.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) /
        this.keyTimings.length;
      // Near-zero variance = likely automated
      if (variance < 1 && this.keyTimings.length > 10) return true;
    }

    return false;
  }

  getTimingAnomaly(): boolean {
    if (this.keyTimings.length < 3) return false;
    const avg = this.keyTimings.reduce((a, b) => a + b, 0) / this.keyTimings.length;
    return avg < 15; // Too fast for human
  }
}

// Call the security edge function
export async function securityCheck(
  action: string,
  data: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: any; error?: string; message?: string }> {
  try {
    const fingerprint = await generateFingerprint();
    const botSignals = detectBotSignals();

    const { data: result, error } = await supabase.functions.invoke(
      "security-check",
      {
        body: {
          action,
          fingerprint_hash: fingerprint,
          user_agent: navigator.userAgent,
          bot_signals: botSignals,
          ...data,
        },
      }
    );

    if (error) {
      // Try to parse the error response body for lockout/block info
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const errBody = await ctx.json();
          if (errBody?.error === 'device_blocked' || errBody?.error === 'account_locked') {
            return { ok: false, error: errBody.error, message: errBody.message, data: errBody };
          }
        }
      } catch {
        // If we can't parse, check if result itself has error info
      }
      console.error("Security check error:", error);
      return { ok: true }; // Fail open for non-security errors
    }

    if (result?.error) {
      return { ok: false, error: result.error, message: result.message, data: result };
    }

    return { ok: true, data: result };
  } catch (err) {
    console.error("Security check failed:", err);
    return { ok: true }; // Fail open
  }
}

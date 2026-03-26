
-- Table to track device fingerprints and registration count
CREATE TABLE public.device_fingerprints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint_hash text NOT NULL,
  user_id uuid NOT NULL,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_fp_hash ON public.device_fingerprints (fingerprint_hash);
CREATE INDEX idx_device_fp_user ON public.device_fingerprints (user_id);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

-- Only service role can manage these (via edge function)
CREATE POLICY "Service role only" ON public.device_fingerprints FOR ALL USING (false);

-- Table to track login attempts per device
CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint_hash text NOT NULL,
  ip_address text,
  email text,
  success boolean NOT NULL DEFAULT false,
  fail_count integer NOT NULL DEFAULT 0,
  lockout_until timestamptz,
  lockout_level integer NOT NULL DEFAULT 0,
  device_risk_score integer NOT NULL DEFAULT 0,
  is_bot_suspected boolean NOT NULL DEFAULT false,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_login_attempts_fp ON public.login_attempts (fingerprint_hash);
CREATE INDEX idx_login_attempts_ip ON public.login_attempts (ip_address);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.login_attempts FOR ALL USING (false);

-- Security audit log
CREATE TABLE public.security_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL, -- 'register', 'login_success', 'login_fail', 'lockout', 'bot_detected', 'device_blocked'
  fingerprint_hash text,
  ip_address text,
  user_id uuid,
  email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  risk_score integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_event ON public.security_audit_log (event_type);
CREATE INDEX idx_audit_log_fp ON public.security_audit_log (fingerprint_hash);
CREATE INDEX idx_audit_log_created ON public.security_audit_log (created_at DESC);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin can view audit logs
CREATE POLICY "Admin can view audit logs" ON public.security_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role manages (via edge function)  
CREATE POLICY "No direct insert" ON public.security_audit_log FOR INSERT WITH CHECK (false);

-- Blocked devices table
CREATE TABLE public.blocked_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint_hash text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'excessive_attempts',
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz, -- null = permanent
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocked_devices_fp ON public.blocked_devices (fingerprint_hash);

ALTER TABLE public.blocked_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view blocked devices" ON public.blocked_devices
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "No direct modify" ON public.blocked_devices FOR ALL USING (false);

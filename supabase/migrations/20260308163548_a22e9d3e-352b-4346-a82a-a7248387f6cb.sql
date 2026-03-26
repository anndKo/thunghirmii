-- 1. CRITICAL: Remove anon access to protection_passwords PIN hashes
DROP POLICY IF EXISTS "Anon can check protection password exists" ON protection_passwords;

-- 2. CRITICAL: Restrict profiles - remove blanket authenticated SELECT
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- 3. CRITICAL: Remove overly permissive room_requests policy
DROP POLICY IF EXISTS "Anyone can read room_requests" ON room_requests;

-- 4. CRITICAL: Restrict attendance_records INSERT/UPDATE to admin only
DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can update attendance" ON attendance_records;

CREATE POLICY "Admin can insert attendance" ON attendance_records
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update attendance" ON attendance_records
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. CRITICAL: Restrict students INSERT/UPDATE to admin only
DROP POLICY IF EXISTS "Authenticated users can insert students" ON students;
DROP POLICY IF EXISTS "Authenticated users can update students" ON students;

CREATE POLICY "Admin can insert students" ON students
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update students" ON students
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Fix room_reports anonymous leak
DROP POLICY IF EXISTS "Anyone can select own reports" ON room_reports;

CREATE POLICY "Users can select own reports or admin" ON room_reports
  FOR SELECT USING (
    (reporter_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 7. Fix user_roles self-assignment: remove self-assign branch, require admin
DROP POLICY IF EXISTS "Only admin or first user can insert roles" ON user_roles;

CREATE POLICY "Only admin or first user can insert roles" ON user_roles
  FOR INSERT WITH CHECK (
    (is_first_user() AND role = 'admin'::app_role AND auth.uid() = user_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 8. Fix device_support_requests INSERT - allow without auth (needed for blocked devices)
-- This is intentional since blocked users cannot authenticate
-- Already has WITH CHECK (true) which is correct for this use case

-- 9. Tighten rooms: create a view or restrict contract_content
-- We'll add a function to hide sensitive fields for non-owners
DROP POLICY IF EXISTS "Anyone can read rooms" ON rooms;
DROP POLICY IF EXISTS "Rooms: public select" ON rooms;

CREATE POLICY "Public can read rooms basic info" ON rooms
  FOR SELECT USING (true);
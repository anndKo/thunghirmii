
-- =====================================================
-- CRITICAL SECURITY FIX: Remove privilege escalation
-- =====================================================

-- 1. Remove self-service INSERT policies on user_roles (privilege escalation)
DROP POLICY IF EXISTS "Roles: insert own" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- Create restricted insert policy: only first user or admin can insert roles
CREATE POLICY "Only admin or first user can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- First user gets admin
  (public.is_first_user() AND role = 'admin' AND auth.uid() = user_id)
  OR
  -- Admin can assign any role
  public.has_role(auth.uid(), 'admin')
  OR
  -- Non-admin users can only assign non-admin roles to themselves
  (auth.uid() = user_id AND role != 'admin' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()))
);

-- 2. Remove dangerous "Test update" policy on rooms
DROP POLICY IF EXISTS "Test update" ON public.rooms;

-- 3. Fix user_credentials: require authentication for insert
DROP POLICY IF EXISTS "Anyone can insert credentials" ON public.user_credentials;
CREATE POLICY "Authenticated users can insert own credentials"
ON public.user_credentials
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Fix profiles: require authentication for read
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 5. Fix attendance_records: require authentication
DROP POLICY IF EXISTS "Anyone can delete attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone can insert attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone can read attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone can update attendance_records" ON public.attendance_records;

CREATE POLICY "Authenticated users can read attendance"
ON public.attendance_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert attendance"
ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
ON public.attendance_records FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admin can delete attendance"
ON public.attendance_records FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Fix students: require authentication
DROP POLICY IF EXISTS "Allow all for now" ON public.students;

CREATE POLICY "Authenticated users can read students"
ON public.students FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert students"
ON public.students FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update students"
ON public.students FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admin can delete students"
ON public.students FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 7. Fix classes: require authentication
DROP POLICY IF EXISTS "Allow all for now" ON public.classes;

CREATE POLICY "Authenticated users can read classes"
ON public.classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage classes"
ON public.classes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Fix banned_users: restrict to own ban check
DROP POLICY IF EXISTS "Anyone can check ban status" ON public.banned_users;
CREATE POLICY "Authenticated users can check own ban"
ON public.banned_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Allow anon to check ban status for login flow
CREATE POLICY "Anon can check ban by user_id"
ON public.banned_users FOR SELECT TO anon
USING (true);

-- 9. Fix user_roles: restrict public read
DROP POLICY IF EXISTS "Anyone can read user_roles" ON public.user_roles;
CREATE POLICY "Authenticated users can read roles"
ON public.user_roles FOR SELECT TO authenticated USING (true);

-- 10. Fix user_settings: restrict public read  
DROP POLICY IF EXISTS "Anyone can read user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view all user settings" ON public.user_settings;
CREATE POLICY "Authenticated users can view user_settings"
ON public.user_settings FOR SELECT TO authenticated USING (true);

-- 11. Fix ban_appeals: require auth for insert
DROP POLICY IF EXISTS "Anyone can insert appeals" ON public.ban_appeals;
CREATE POLICY "Authenticated users can insert appeals"
ON public.ban_appeals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 12. Fix password_reset_requests: allow anon insert (needed for forgot password)
-- Keep as is since unauthenticated users need this

-- 13. Fix room_reports: require auth for insert
DROP POLICY IF EXISTS "Anyone can insert reports" ON public.room_reports;
CREATE POLICY "Authenticated users can insert reports"
ON public.room_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

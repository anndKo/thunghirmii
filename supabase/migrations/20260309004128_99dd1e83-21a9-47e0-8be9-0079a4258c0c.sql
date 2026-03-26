-- ============================================
-- RLS SECURITY OPTIMIZATION - COMPLETE FIX
-- Tối ưu hóa Row Level Security cho hệ thống phòng trọ
-- ============================================

-- ============================================
-- BƯỚC 1: Drop TẤT CẢ policies cũ
-- ============================================

-- ROOMS
DROP POLICY IF EXISTS "Admin can manage all rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admin can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Landlords can delete own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Landlords can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Landlords can update own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Public can view approved rooms" ON public.rooms;
DROP POLICY IF EXISTS "Rooms: landlord delete" ON public.rooms;
DROP POLICY IF EXISTS "Rooms: landlord insert" ON public.rooms;
DROP POLICY IF EXISTS "Rooms: landlord update" ON public.rooms;

-- USER_SETTINGS
DROP POLICY IF EXISTS "Authenticated users can view user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Settings: select own" ON public.user_settings;
DROP POLICY IF EXISTS "Users can create their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Settings: insert own" ON public.user_settings;
DROP POLICY IF EXISTS "Settings: update own" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Admin can view all settings" ON public.user_settings;

-- MESSAGES
DROP POLICY IF EXISTS "Messages: send" ON public.messages;
DROP POLICY IF EXISTS "Messages: update received" ON public.messages;
DROP POLICY IF EXISTS "Messages: view own" ON public.messages;
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.messages;
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own received messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Sender can edit own messages" ON public.messages;
DROP POLICY IF EXISTS "Receiver can mark messages as read" ON public.messages;

-- PAYMENT_REQUESTS
DROP POLICY IF EXISTS "Admin manage payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admin can delete payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Payments: create" ON public.payment_requests;
DROP POLICY IF EXISTS "Payments: update own" ON public.payment_requests;
DROP POLICY IF EXISTS "Payments: view own" ON public.payment_requests;
DROP POLICY IF EXISTS "Receiver can update own payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Receiver can view own payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can insert payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can read own payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can update own payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can create payment requests" ON public.payment_requests;

-- ROOM_REQUESTS
DROP POLICY IF EXISTS "Admin can delete requests" ON public.room_requests;
DROP POLICY IF EXISTS "Admin can update requests" ON public.room_requests;
DROP POLICY IF EXISTS "Admin can view all requests" ON public.room_requests;
DROP POLICY IF EXISTS "Landlords can update viewed status on forwarded requests" ON public.room_requests;
DROP POLICY IF EXISTS "Landlords can view forwarded requests" ON public.room_requests;
DROP POLICY IF EXISTS "Tenants can create requests" ON public.room_requests;
DROP POLICY IF EXISTS "Tenants can insert requests" ON public.room_requests;
DROP POLICY IF EXISTS "Tenants can view own requests" ON public.room_requests;
DROP POLICY IF EXISTS "Tenants can view their own requests" ON public.room_requests;
DROP POLICY IF EXISTS "Tenants can insert rental requests" ON public.room_requests;

-- PROFILES
DROP POLICY IF EXISTS "Profiles: insert own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: select own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admin views all" ON public.profiles;

-- USER_ROLES
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admin or first user can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Roles: select own" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

-- LANDLORD_PAYMENT_INFO
DROP POLICY IF EXISTS "Admin can manage all payment info" ON public.landlord_payment_info;
DROP POLICY IF EXISTS "Admin can view all payment info" ON public.landlord_payment_info;
DROP POLICY IF EXISTS "Users can insert own payment info" ON public.landlord_payment_info;
DROP POLICY IF EXISTS "Users can update own payment info" ON public.landlord_payment_info;
DROP POLICY IF EXISTS "Users can view own payment info" ON public.landlord_payment_info;

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Admin can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view notifications for their role" ON public.notifications;

-- PASSWORD_RESET_REQUESTS
DROP POLICY IF EXISTS "Admins can update password reset requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Admins can view password reset requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Anyone can insert password reset requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Authenticated users can insert password reset requests" ON public.password_reset_requests;

-- DEVICE_SUPPORT_REQUESTS
DROP POLICY IF EXISTS "Admin can delete support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "Admin can update support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "Admin can view support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "Anyone can insert support requests" ON public.device_support_requests;
DROP POLICY IF EXISTS "Authenticated users can insert support requests" ON public.device_support_requests;

-- BAN_APPEALS
DROP POLICY IF EXISTS "Admins can update appeals" ON public.ban_appeals;
DROP POLICY IF EXISTS "Admins can view appeals" ON public.ban_appeals;
DROP POLICY IF EXISTS "Authenticated users can insert appeals" ON public.ban_appeals;
DROP POLICY IF EXISTS "Banned users can insert appeals" ON public.ban_appeals;

-- ROOM_REPORTS
DROP POLICY IF EXISTS "Admins can update reports" ON public.room_reports;
DROP POLICY IF EXISTS "Admins can view reports" ON public.room_reports;
DROP POLICY IF EXISTS "Authenticated users can insert reports" ON public.room_reports;
DROP POLICY IF EXISTS "Users can select own reports or admin" ON public.room_reports;
DROP POLICY IF EXISTS "Authenticated users can report rooms" ON public.room_reports;

-- ============================================
-- BƯỚC 2: Tạo policies mới an toàn và tối ưu
-- ============================================

-- ============================================
-- PROFILES: User hoặc admin xem được
-- ============================================
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- USER_SETTINGS: An toàn hơn - không cho phép view tất cả
-- ============================================
CREATE POLICY "user_settings_select_own"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_select_admin"
  ON public.user_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_settings_insert_own"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- MESSAGES: Chỉ sender/receiver
-- ============================================
CREATE POLICY "messages_select_participants"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id
  );

CREATE POLICY "messages_insert_as_sender"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages_update_sender"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "messages_update_receiver"
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- ============================================
-- PAYMENT_REQUESTS: Sender/receiver và admin
-- ============================================
CREATE POLICY "payment_requests_select_participants"
  ON public.payment_requests FOR SELECT
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id
  );

CREATE POLICY "payment_requests_select_admin"
  ON public.payment_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "payment_requests_insert_as_sender"
  ON public.payment_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "payment_requests_update_participants"
  ON public.payment_requests FOR UPDATE
  USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id
  );

CREATE POLICY "payment_requests_admin_manage"
  ON public.payment_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "payment_requests_admin_delete"
  ON public.payment_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- ROOM_REQUESTS: Tenant, landlord, admin
-- ============================================
CREATE POLICY "room_requests_insert_tenant"
  ON public.room_requests FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "room_requests_select_tenant"
  ON public.room_requests FOR SELECT
  USING (auth.uid() = tenant_id);

CREATE POLICY "room_requests_select_landlord_forwarded"
  ON public.room_requests FOR SELECT
  USING (
    status = 'forwarded'
    AND EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_requests.room_id
      AND rooms.landlord_id = auth.uid()
    )
  );

CREATE POLICY "room_requests_update_landlord_forwarded"
  ON public.room_requests FOR UPDATE
  USING (
    status = 'forwarded'
    AND EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_requests.room_id
      AND rooms.landlord_id = auth.uid()
    )
  );

CREATE POLICY "room_requests_select_admin"
  ON public.room_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "room_requests_update_admin"
  ON public.room_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "room_requests_delete_admin"
  ON public.room_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- ROOMS: Public approved, landlord own, admin all
-- ============================================
CREATE POLICY "rooms_select_approved_or_own"
  ON public.rooms FOR SELECT
  USING (
    approval_status = 'approved'
    OR landlord_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "rooms_insert_landlord"
  ON public.rooms FOR INSERT
  WITH CHECK (
    auth.uid() = landlord_id 
    AND has_role(auth.uid(), 'landlord'::app_role)
  );

CREATE POLICY "rooms_update_landlord"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = landlord_id);

CREATE POLICY "rooms_delete_landlord"
  ON public.rooms FOR DELETE
  USING (auth.uid() = landlord_id);

CREATE POLICY "rooms_admin_all"
  ON public.rooms FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- USER_ROLES: Authenticated view, admin/first_user manage
-- ============================================
CREATE POLICY "user_roles_select_authenticated"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "user_roles_insert_admin_or_first"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    (is_first_user() AND role = 'admin'::app_role AND auth.uid() = user_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "user_roles_admin_manage"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- LANDLORD_PAYMENT_INFO: Own or admin
-- ============================================
CREATE POLICY "landlord_payment_info_select_own"
  ON public.landlord_payment_info FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "landlord_payment_info_insert_own"
  ON public.landlord_payment_info FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "landlord_payment_info_update_own"
  ON public.landlord_payment_info FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "landlord_payment_info_admin_all"
  ON public.landlord_payment_info FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- NOTIFICATIONS: Filter by role
-- ============================================
CREATE POLICY "notifications_select_by_role"
  ON public.notifications FOR SELECT
  USING (
    is_active = true
    AND (
      target_role = 'all'
      OR target_role IN (
        SELECT role::text FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "notifications_admin_manage"
  ON public.notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "notifications_admin_delete"
  ON public.notifications FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PASSWORD_RESET_REQUESTS: Authenticated insert, admin view/update
-- ============================================
CREATE POLICY "password_reset_insert_authenticated"
  ON public.password_reset_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "password_reset_select_admin"
  ON public.password_reset_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "password_reset_update_admin"
  ON public.password_reset_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- DEVICE_SUPPORT_REQUESTS: Authenticated insert, admin manage
-- ============================================
CREATE POLICY "device_support_insert_authenticated"
  ON public.device_support_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "device_support_select_admin"
  ON public.device_support_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "device_support_update_admin"
  ON public.device_support_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "device_support_delete_admin"
  ON public.device_support_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- BAN_APPEALS: Only banned users can appeal
-- ============================================
CREATE POLICY "ban_appeals_insert_banned"
  ON public.ban_appeals FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.banned_users 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ban_appeals_select_admin"
  ON public.ban_appeals FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ban_appeals_update_admin"
  ON public.ban_appeals FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- ROOM_REPORTS: Authenticated users report, admin view/update
-- ============================================
CREATE POLICY "room_reports_insert_authenticated"
  ON public.room_reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (reporter_id = auth.uid() OR reporter_id IS NULL)
  );

CREATE POLICY "room_reports_select_own_or_admin"
  ON public.room_reports FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "room_reports_update_admin"
  ON public.room_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
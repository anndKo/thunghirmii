-- ============================================
-- FIX: user_settings cần cho phép authenticated users 
-- xem display_id và avatar của user khác (cần cho chat/UI)
-- ============================================

-- Thêm policy cho phép authenticated users xem user_settings
-- (user_settings chỉ chứa display_id và avatar_url - không nhạy cảm)
CREATE POLICY "user_settings_select_authenticated"
  ON public.user_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- FIX: Notifications cho admin quản lý (bao gồm inactive)
-- ============================================
CREATE POLICY "notifications_select_admin_all"
  ON public.notifications FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
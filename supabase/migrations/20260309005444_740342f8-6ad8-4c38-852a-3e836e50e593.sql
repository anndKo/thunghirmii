-- =====================================================
-- CRITICAL RLS SECURITY FIXES
-- Sửa các lỗ hổng bảo mật nghiêm trọng
-- =====================================================

-- =====================================================
-- 1. FIX banned_users - LỖ HỔNG NGHIÊM TRỌNG
-- Hiện tại: Anonymous users có thể thấy TẤT CẢ banned users (USING true)
-- Sửa: Chỉ cho phép check ban status của chính user đó
-- =====================================================

-- Drop policy nguy hiểm
DROP POLICY IF EXISTS "Anon can check ban by user_id" ON public.banned_users;

-- Tạo policy an toàn: Chỉ cho authenticated users check ban status của chính họ
CREATE POLICY "Users can check own ban status"
ON public.banned_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin vẫn có thể xem tất cả (policy đã có sẵn)


-- =====================================================
-- 2. FIX user_roles - LỖ HỔNG NGHIÊM TRỌNG  
-- Hiện tại: Mọi authenticated user thấy TẤT CẢ roles (USING true)
-- Nguy cơ: Attacker biết ai là admin, landlord → targeted attacks
-- Sửa: Chỉ cho xem role của chính mình
-- =====================================================

-- Drop policy nguy hiểm
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;

-- Tạo policy an toàn: User chỉ thấy role của chính mình
CREATE POLICY "user_roles_select_own"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin vẫn có thể xem tất cả roles (policy user_roles_admin_manage đã có)


-- =====================================================  
-- 3. VERIFY user_settings - CHECK XEM CÓ LỘ DATA KHÔNG
-- Hiện tại: user_settings_select_authenticated cho phép authenticated users
-- thấy tất cả display_id và avatar_url
-- Điều này CẦN THIẾT cho chức năng chat (hiển thị tên/avatar người gửi)
-- Nhưng cần đảm bảo chỉ trả về public fields
-- =====================================================

-- Policy hiện tại đã OK vì chỉ có display_id và avatar_url là public
-- Không cần sửa vì các field này cần thiết cho UI chat
-- Nếu muốn bảo mật hơn, có thể tạo view riêng chỉ chứa public fields


-- =====================================================
-- 4. ADD SECURITY NOTES
-- Ghi chú về các policy USING true còn lại (intentional)
-- =====================================================

-- attendance_records, classes, students, guides: 
-- Các bảng này có USING true cho SELECT là OK vì:
-- - Là public content (attendance system, educational guides)
-- - Không chứa dữ liệu nhạy cảm
-- - Cần thiết cho chức năng của hệ thống

COMMENT ON TABLE public.banned_users IS 'SECURITY: RLS policies updated to prevent anonymous enumeration of banned users';
COMMENT ON TABLE public.user_roles IS 'SECURITY: RLS policies restrict role visibility to own user only, preventing reconnaissance attacks';
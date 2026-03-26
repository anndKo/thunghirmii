-- Bước 1: Xóa các chính sách (policy) đang cấu hình sai
DROP POLICY IF EXISTS "Admin can update submissions" ON submissions;
DROP POLICY IF EXISTS "Admin can delete submissions" ON submissions;
DROP POLICY IF EXISTS "Anyone can insert submissions" ON submissions;

-- Bước 2: Tạo lại chính sách cập nhật và xóa dành riêng cho Admin
CREATE POLICY "Admin can update submissions" ON submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete submissions" ON submissions
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Bước 3: Thu hẹp quyền thêm dữ liệu (INSERT)
-- Thay vì để public, chỉ cho phép người dùng đã đăng nhập và lưu đúng dữ liệu của họ
CREATE POLICY "Authenticated users can insert submissions" ON submissions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id); 
-- Lưu ý: Thay 'user_id' bằng cột lưu ID chủ sở hữu thực tế trong bảng submissions của bạn.
-- Bước 1: Xóa các chính sách nguy hiểm
DROP POLICY IF EXISTS "Admin can view all submission files" ON submission_files;
DROP POLICY IF EXISTS "Admin can delete submission files" ON submission_files;
DROP POLICY IF EXISTS "Anyone can insert submission files" ON submission_files;

-- Bước 2: Giới hạn quyền xem tất cả và xóa file chỉ cho Admin
CREATE POLICY "Admin can view all submission files" ON submission_files
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete submission files" ON submission_files
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Bước 3: Giới hạn quyền chèn (INSERT) file
-- Chỉ người dùng đã đăng nhập mới được upload file
CREATE POLICY "Authenticated users can insert submission files" ON submission_files
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
-- 1. Xóa chính sách cho phép mọi người đọc
DROP POLICY IF EXISTS "Anyone can read settings" ON settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON settings;

-- 2. Chỉ cho phép Admin toàn quyền quản lý (Xem, Thêm, Sửa, Xóa)
CREATE POLICY "Admin manage all settings" ON settings
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. (Tùy chọn) Nếu ứng dụng cần người dùng thường đọc một vài cài đặt không nhạy cảm
-- Hãy chỉ định rõ ràng quyền SELECT thay vì để public
CREATE POLICY "Authenticated users can view settings" ON settings
FOR SELECT TO authenticated
USING (true);
-- 1. Xóa các chính sách cũ
DROP POLICY IF EXISTS "Admin can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_admin_or_first" ON user_roles;

-- 2. Admin: Toàn quyền quản lý bảng phân quyền
CREATE POLICY "Admin manage all roles" ON user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Người dùng: Chỉ được phép XEM quyền của chính mình
-- (Để ứng dụng phía Client biết nên hiển thị giao diện nào)
CREATE POLICY "Users can view own roles" ON user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 4. Bảo mật hàm is_first_user (Khởi tạo Admin đầu tiên)
-- Lưu ý: Sau khi hệ thống đã có Admin, bạn nên vô hiệu hóa chính sách này 
-- hoặc kiểm tra kỹ điều kiện để tránh bị chiếm quyền lúc mới setup.

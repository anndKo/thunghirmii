-- Xóa nếu đã tồn tại (để tránh conflict)
DROP FUNCTION IF EXISTS has_role(uuid, text);

-- Tạo lại hàm an toàn
CREATE OR REPLACE FUNCTION has_role(_uid uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _uid
      AND role = _role
  );
$$;

-- Xóa policy cũ
DROP POLICY IF EXISTS "Admin manage settings" ON settings;
DROP POLICY IF EXISTS "Users view settings" ON settings;

-- 🔒 Admin toàn quyền
CREATE POLICY "Admin manage settings"
ON settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 👀 (OPTIONAL) user chỉ xem nếu bạn CHẮC chắn không nhạy cảm
-- Nếu có API key → KHÔNG tạo policy này
CREATE POLICY "Users view settings"
ON settings
FOR SELECT
TO authenticated
USING (true);
-- Xóa policy cũ
DROP POLICY IF EXISTS "Admin manage roles" ON user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON user_roles;

-- 🛠 Admin toàn quyền
CREATE POLICY "Admin manage roles"
ON user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 👀 User chỉ xem role của mình
CREATE POLICY "Users view own roles"
ON user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE submissions
SET user_id = auth.uid()
WHERE user_id IS NULL;


DELETE FROM submissions
WHERE user_id IS NULL;
ALTER TABLE submissions
ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE submissions
ALTER COLUMN user_id SET DEFAULT auth.uid();

DELETE FROM submissions WHERE user_id IS NULL;

ALTER TABLE submissions
ALTER COLUMN user_id SET NOT NULL;

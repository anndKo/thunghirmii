CREATE POLICY "user can insert own role"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);
DROP POLICY IF EXISTS user_roles_insert_admin_or_first ON user_roles;

CREATE POLICY "insert own role"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);


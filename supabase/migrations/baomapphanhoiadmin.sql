✅ Cấu hình RLS CHUẨN
1. Bật RLS (nếu chưa)
alter table feedbacks enable row level security;
2. XÓA policy cũ (tránh conflict)
drop policy if exists "Users can insert feedback" on feedbacks;
drop policy if exists "Users can view own feedback" on feedbacks;
drop policy if exists "Admin can view all feedback" on feedbacks;
drop policy if exists "Admin can update feedback" on feedbacks;
3. Policy cho USER
🟢 Gửi feedback
create policy "Users can insert feedback"
on feedbacks
for insert
to authenticated
with check (auth.uid() = user_id);
🟢 Xem feedback của mình
create policy "Users can view own feedback"
on feedbacks
for select
to authenticated
using (auth.uid() = user_id);
4. Policy cho ADMIN (QUAN TRỌNG)

👉 Vì bạn đang dùng bảng user_roles

🟢 Xem tất cả
create policy "Admin can view all feedback"
on feedbacks
for select
to authenticated
using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and role = 'admin'
  )
);
🟢 Update (trả lời)
create policy "Admin can update feedback"
on feedbacks
for update
to authenticated
using (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and role = 'admin'
  )
)
with check (true);
🔥 (OPTIONAL nhưng nên làm)
❌ Chặn user sửa feedback
create policy "Users cannot update feedback"
on feedbacks
for update
to authenticated
using (false);
❌ Chặn xóa
create policy "No one deletes feedback"
on feedbacks
for delete
to authenticated
using (false);
🧠 Best Practice thêm (rất đáng làm)
1. Không tin frontend

Trong code bạn đang:

update({ admin_reply: ... })

👉 OK, nhưng backend mới là thứ quyết định (RLS đã bảo vệ 👍)

2. Có thể siết chặt hơn (advanced)

Chỉ cho admin sửa cột reply thôi:

with check (
  admin_reply is not null
)


drop policy if exists "Users can insert feedback" on feedbacks;
drop policy if exists "Users can view own feedback" on feedbacks;
drop policy if exists "Admin can view all feedback" on feedbacks;
create policy "Users can insert feedback"
on feedbacks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can view own feedback"
on feedbacks
for select
to authenticated
using (auth.uid() = user_id);

create policy "Admin can view all feedback"
on feedbacks
for select
using (true);



alter table feedbacks add column status text default 'pending';

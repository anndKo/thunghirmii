create table feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  media_urls text[],
  created_at timestamptz default now()
);
alter table feedbacks enable row level security;
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

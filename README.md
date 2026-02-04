# PM TOOL (GitHub + Supabase Ready)

This repo contains the PM TOOL split into separate files and prepared for static hosting (GitHub Pages) with optional Supabase sync + realtime.

## Files
- `auth.js` / `auth.css` – login/signup/reset UI
- `app.html` – team board (workspace)
- `index.html` – login / landing page
- `styles.css` – extracted styles
- `app.js` – app logic (includes optional Supabase sync)
- `supabase-config.js` – Supabase URL/key config

---

## Run locally
Because `app.js` uses ES Modules, use a local server:

### Option A (VS Code)
Install **Live Server** → right-click `index.html` → **Open with Live Server**

### Option B (Python)
```bash
python -m http.server 5500
```
Then open:
`http://localhost:5500`

---

## Enable Supabase
### 1) Create tables
In Supabase SQL Editor, run:

```sql
-- TASKS table
create table if not exists public.tasks (
  id bigint primary key,
  payload jsonb not null
);

-- ARCHIVE table
create table if not exists public.archive (
  id bigint primary key,
  payload jsonb not null
);
```

### 2) Enable RLS + policies (simple / public)
> For internal testing. Tighten later if you add Auth.

```sql
alter table public.tasks enable row level security;
alter table public.archive enable row level security;

create policy "allow all (tasks)"
on public.tasks for all
using (true) with check (true);

create policy "allow all (archive)"
on public.archive for all
using (true) with check (true);
```

### 3) Realtime (optional but recommended)
In Supabase:
- Database → Replication → enable Realtime for `tasks` and `archive`

### 4) Add your keys
Open `supabase-config.js` and paste:
- Project URL
- anon public key

---

## Deploy to GitHub Pages
1. Push this repo to GitHub
2. Repo → **Settings** → **Pages**
3. Source: `Deploy from a branch`
4. Branch: `main` / `(root)`
5. Save

Your site will be live on GitHub Pages.

---

## Notes
- If Supabase is not configured, the app automatically falls back to `localStorage`.
- If configured, the app loads from Supabase first and keeps localStorage as a cache.
- Department is selected from a fixed list: Admin, Workforce, Compliance, Complaints, Acquisition, Teletrim.

---

## Enable Supabase Auth (required for team use)
1. In Supabase Dashboard → **Authentication** → **Providers**
   - Enable **Email**
2. (Optional) Disable email confirmations for faster testing:
   - Authentication → Settings → **Confirm email** (toggle)

### Recommended RLS (authenticated users only)
Replace the public policies with the following if you want to require login:

```sql
drop policy if exists "allow all (tasks)" on public.tasks;
drop policy if exists "allow all (archive)" on public.archive;

create policy "authenticated only (tasks)"
on public.tasks for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated only (archive)"
on public.archive for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
```

Now the app requires login, and the database also blocks anonymous access.

---

## Real-time updates (no refresh needed)
This app subscribes to Supabase Realtime (`postgres_changes`) and re-renders automatically when anyone creates/edits/moves/archives tasks.

To enable this in Supabase:
- Database → Replication → enable Realtime for `tasks` and `archive`


## Admin-only deletes (recommended)
To prevent accidental deletions in a multi-user team, use an `admins` table and Row Level Security (RLS) so **only admins can delete** tasks and archived items.

### 1) Create admins table
```sql
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
```

### 2) RLS policies (authenticated can read/write; only admins can delete)
```sql
alter table public.tasks enable row level security;
alter table public.archive enable row level security;
alter table public.admins enable row level security;

-- Read/insert/update for authenticated users
drop policy if exists "auth read/write tasks" on public.tasks;
create policy "auth read/write tasks"
on public.tasks for select, insert, update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "auth read/write archive" on public.archive;
create policy "auth read/write archive"
on public.archive for select, insert, update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- Allow authenticated users to read admins table (optional)
drop policy if exists "auth read admins" on public.admins;
create policy "auth read admins"
on public.admins for select
using (auth.role() = 'authenticated');

-- Delete only for admins
drop policy if exists "admin delete tasks" on public.tasks;
create policy "admin delete tasks"
on public.tasks for delete
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admin delete archive" on public.archive;
create policy "admin delete archive"
on public.archive for delete
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
```

### 3) Make someone an admin
1. Create their user in Supabase Auth (Dashboard → Authentication → Users → Add user)
2. Copy the user's UUID
3. Insert into `admins`:
   ```sql
   insert into public.admins (user_id) values ('<USER_UUID>');
   ```

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

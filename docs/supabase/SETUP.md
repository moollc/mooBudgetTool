# Supabase Setup Guide for mBT

mBT works fully offline without Supabase. This guide is for users who want cloud backup or cross-device sync.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
3. Choose a name (e.g. `mbt-production`), set a database password, pick a region close to you
4. Wait ~2 minutes for the project to provision

---

## 2. Run the Schema

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the entire contents of [`schema.sql`](schema.sql) and paste it into the editor
4. Click **Run**

This creates 6 tables (`projects`, `stages`, `executions`, `og_ref`, `contacts`, `sessions`) with Row Level Security policies scoped to `auth.uid()`. Each user can only read and write their own rows.

---

## 3. Get Your API Credentials

1. In your project dashboard, go to **Settings → API**
2. Copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — the long JWT string under "Project API keys"

The anon key is safe to use in client-side code. It is scoped by RLS policies.

---

## 4. Configure mBT

1. Open mBT → **Settings**
2. Click **Cloud Sync**
3. Enter your Project URL and anon key when prompted
4. mBT saves these to `localStorage` — they stay on your device

---

## 5. First Sync

After enabling Cloud Sync:
- mBT pushes all local projects to Supabase on the next sync trigger
- On a second device, open mBT, enter the same Supabase credentials, and your projects appear

---

## Schema Reference

| Table | Mirrors | Notes |
|-------|---------|-------|
| `projects` | `mbt_projects` IndexedDB store | Primary budget records |
| `stages` | `mbt_stages` | Stage allocations, linked to projects |
| `executions` | `mbt_executions` | Execution/transaction records |
| `og_ref` | `og_ref` | OpenGate rate reference (user-extended) |
| `contacts` | `contacts` | Crew and vendor registry |
| `sessions` | `sessions` | Auth session state |

All tables use:
- `id TEXT PRIMARY KEY` — matches the local IndexedDB key
- `user_id UUID NOT NULL DEFAULT auth.uid()` — scoped to the authenticated user
- `data JSONB` — full record payload
- `updated_at TIMESTAMPTZ` — for conflict resolution

---

## Row Level Security

All tables have RLS enabled with four policies each:

```sql
-- Example for projects table
CREATE POLICY "projects: owner read"   ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects: owner insert" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects: owner update" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects: owner delete" ON projects FOR DELETE USING (auth.uid() = user_id);
```

No user can read another user's data. The anon key alone cannot bypass RLS.

---

## Notes

- mBT does not require authentication to use. Supabase sync is completely optional.
- If you delete your Supabase project, your local IndexedDB data is unaffected.
- The free Supabase tier (500MB database, 2GB file storage) is sufficient for typical production budgets.

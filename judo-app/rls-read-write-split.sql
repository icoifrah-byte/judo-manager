-- ════════════════════════════════════════════════════════════════
-- הפרדת קריאה/כתיבה — צופים יכולים רק לקרוא, מנהלים גם לכתוב
-- הרץ את כל הקובץ ב-Supabase → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════

-- הגדר סוד לכתיבה. שנה את הערך למשהו משלך (ארוך ואקראי).
-- אותו ערך צריך להיכנס ל-db.js (WRITE_SECRET) ולדפי השיפוט.
-- דוגמה: 'judo-2026-a7Kp9mXq'

-- 1) מחק את המדיניות הישנה "allow all"
drop policy if exists "allow all" on competitions;
drop policy if exists "allow all" on categories;
drop policy if exists "allow all" on competitors;
drop policy if exists "allow all" on matches;

-- 2) פונקציית עזר: בודקת אם הבקשה נושאת את סוד-הכתיבה
create or replace function has_write_access()
returns boolean
language plpgsql
stable
as $$
declare
  hdrs json;
  secret text;
begin
  -- קרא את ה-header 'x-write-secret' מהבקשה
  begin
    hdrs := current_setting('request.headers', true)::json;
    secret := hdrs ->> 'x-write-secret';
  exception when others then
    secret := null;
  end;
  -- ⚠ שנה את הערך הזה לסוד שלך (זהה ל-WRITE_SECRET ב-db.js)
  return secret = 'judo-tybPVyd91Be54qH68JPcED4s';
end;
$$;

-- 3) מדיניות קריאה — פתוחה לכולם (צופים)
create policy "read all competitions" on competitions for select using (true);
create policy "read all categories"    on categories    for select using (true);
create policy "read all competitors"   on competitors   for select using (true);
create policy "read all matches"       on matches       for select using (true);

-- 4) מדיניות כתיבה — רק עם סוד-הכתיבה
create policy "write competitions" on competitions for insert with check (has_write_access());
create policy "update competitions" on competitions for update using (has_write_access()) with check (has_write_access());
create policy "delete competitions" on competitions for delete using (has_write_access());

create policy "write categories" on categories for insert with check (has_write_access());
create policy "update categories" on categories for update using (has_write_access()) with check (has_write_access());
create policy "delete categories" on categories for delete using (has_write_access());

create policy "write competitors" on competitors for insert with check (has_write_access());
create policy "update competitors" on competitors for update using (has_write_access()) with check (has_write_access());
create policy "delete competitors" on competitors for delete using (has_write_access());

create policy "write matches" on matches for insert with check (has_write_access());
create policy "update matches" on matches for update using (has_write_access()) with check (has_write_access());
create policy "delete matches" on matches for delete using (has_write_access());

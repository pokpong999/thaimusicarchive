-- sql/46_hide_songs.sql  (Pk 2 ก.ย. 69)  · รันซ้ำได้
--
--   ซ่อนเพลงบางเพลงให้เห็นเฉพาะผู้ดูแล (ปุ่ม 🙈 ในหน้าฐานข้อมูลเพลง/หน้าเพลง)
--   ๑. คอลัมน์ songs.hidden (ค่าเริ่มต้น false = เห็นตามปกติทุกเพลง)
--   ๒. RLS: แถวที่ hidden อ่านได้เฉพาะผู้ดูแล — ทำเป็น policy แบบ RESTRICTIVE
--      จึงไปบีบ policy เดิมทุกตัวโดยไม่ต้องรู้ว่าของเดิมชื่ออะไร
--      ถ้าตาราง songs ยังไม่เคยมี policy เลย (RLS ยังไม่เปิด) สคริปต์จะสร้าง policy
--      เปิดกว้างเทียบเท่าพฤติกรรมเดิมก่อน แล้วค่อยเปิด RLS — ทุกอย่างเหมือนเดิม ยกเว้นเรื่องซ่อน
--   ๓. ปุ่มซ่อนเรียก set_song_hidden(p_song, p_hidden) — ตรวจ is_admin ในฐานข้อมูล
--      สมาชิก/แขกเรียกไม่ได้ และแก้คอลัมน์ hidden ตรง ๆ ก็ไม่ได้
--
--   ลำดับ: รันไฟล์นี้ใน Supabase SQL editor ก่อน → แล้วค่อยอัปไฟล์เว็บ (thma_hide.zip)
--   หมายเหตุ: ซ่อนที่ "ตารางเพลง" — ทุกหน้า (ฐานข้อมูล/ค้นหา/เปรียบเทียบ/หน้าเพลง) หายไปเอง
--   เพราะกรองที่ฐานข้อมูล ไม่ใช่ที่หน้าจอ

-- ── ๑ · คอลัมน์ ─────────────────────────────────────────────────────
alter table public.songs add column if not exists hidden boolean not null default false;

-- ── ๒ · RLS ─────────────────────────────────────────────────────────
-- ถ้าไม่เคยมี policy บน songs เลย → สร้างชุดเปิดกว้างเทียบเท่าของเดิมก่อนเปิด RLS
-- (ไม่งั้นการเปิด RLS จะทำให้ทั้งเว็บมองไม่เห็นเพลงสักเพลง)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'songs') then
    execute 'create policy songs_legacy_open on public.songs for all using (true) with check (true)';
  end if;
end $$;

alter table public.songs enable row level security;

-- policy จำกัด (restrictive) — AND กับ policy เดิมทุกตัว: แถวซ่อนอ่านได้เฉพาะผู้ดูแล
drop policy if exists songs_hidden_admin_only on public.songs;
create policy songs_hidden_admin_only on public.songs
  as restrictive for select
  using (hidden = false or public.is_admin());

-- แถวซ่อนต้องแก้/ลบไม่ได้ด้วย (กันสมาชิกที่รู้รหัสเพลงยิง API ตรง) และสมาชิกตั้ง hidden เองไม่ได้
drop policy if exists songs_hidden_admin_write on public.songs;
create policy songs_hidden_admin_write on public.songs
  as restrictive for update
  using (hidden = false or public.is_admin())
  with check (hidden = false or public.is_admin());
drop policy if exists songs_hidden_admin_delete on public.songs;
create policy songs_hidden_admin_delete on public.songs
  as restrictive for delete
  using (hidden = false or public.is_admin());

-- policy ต้องเรียก is_admin() ในนาม anon/authenticated ได้
grant execute on function public.is_admin() to anon, authenticated;

-- ── ๓ · ปุ่มซ่อน/เลิกซ่อน (ผู้ดูแลเท่านั้น) ─────────────────────────
create or replace function public.set_song_hidden(p_song text, p_hidden boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลเท่านั้น';
  end if;
  update public.songs set hidden = coalesce(p_hidden, false) where id = p_song;
  if not found then
    raise exception 'ไม่พบเพลง %', p_song;
  end if;
end $$;

-- create function ให้สิทธิ์ EXECUTE กับ public โดยปริยาย — ต้อง revoke จาก public ด้วย (บทเรียน sql/43)
revoke all on function public.set_song_hidden(text, boolean) from public, anon, authenticated;
grant execute on function public.set_song_hidden(text, boolean) to authenticated;

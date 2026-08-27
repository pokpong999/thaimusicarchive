-- ๒๓ ─ จัดระเบียบ "การแจ้งเตือน" ให้ตรงกับหน้าตาตารางจริง  (27 ส.ค. 69)
--
-- ตารางจริงของ public.notifications เก็บข้อความไว้ที่คอลัมน์ message
-- (คอลัมน์ kind / title / body ว่างเป็น NULL ทุกแถว)
-- แต่ trigger หน้าทับที่เพิ่งเพิ่มไปในไฟล์ 21 เขียนลง kind + title
--   → ถ้า message ถูกตั้งเป็น not null เมื่อไร trigger นั้นจะพังทันที
--     (อาการเดียวกับเคส ching ในไฟล์ 22)
--   → และแถวที่ trigger สร้าง จะไม่มี message ให้โปรแกรมอื่นที่อ่าน message ตรง ๆ
--
-- ไฟล์นี้ทำ 3 อย่าง รันซ้ำได้ ไม่ลบข้อมูลเดิม
--   ๑ เติมคอลัมน์ที่ขาด + ปลดล็อก not null ของคอลัมน์ข้อความ
--   ๒ เขียน trigger หน้าทับใหม่ ให้ลง message เป็นหลัก และลง kind ไว้ให้ไอคอนขึ้นถูก
--   ๓ เติม kind ย้อนหลังให้แถวเก่า เดาจากข้อความกับลิงก์ (ไอคอนในกระดิ่งจะได้ไม่ใช่ 🔔 หมดทุกแถว)

do $$
begin
  if to_regclass('public.notifications') is null then
    raise notice 'ไม่มีตาราง public.notifications — ข้ามไฟล์นี้';
    return;
  end if;

  -- ๑ ── โครงตาราง ────────────────────────────────────────────────
  alter table public.notifications add column if not exists message text;
  alter table public.notifications add column if not exists kind    text;
  alter table public.notifications add column if not exists title   text;
  alter table public.notifications add column if not exists body    text;
  alter table public.notifications add column if not exists link    text;
  alter table public.notifications add column if not exists read    boolean;
  alter table public.notifications alter column message drop not null;
  alter table public.notifications alter column title   drop not null;
  alter table public.notifications alter column body    drop not null;
  alter table public.notifications alter column kind    drop not null;
  alter table public.notifications alter column link    drop not null;
  -- read ต้องมีค่าเสมอ ไม่งั้นกระดิ่งนับ "ยังไม่อ่าน" เพี้ยน
  update public.notifications set read = false where read is null;
  alter table public.notifications alter column read set default false;

  -- ๒ ── trigger หน้าทับ เขียนลง message ───────────────────────────
  execute $f$
    create or replace function public.thma_notify_nathab() returns trigger as $t$
    begin
      insert into public.notifications (user_id, kind, message, link, read)
      select p.id, 'nathab_pending',
             'หน้าทับใหม่รอตรวจ "' || coalesce(new.nathab, '(ไม่มีชื่อ)') || '"'
               || case when coalesce(new.instrument,'') <> '' then ' · ' || new.instrument else '' end
               || ' 🥁',
             '/admin', false
      from public.profiles p
      where p.role in ('admin', 'moderator');
      return new;
    end;
    $t$ language plpgsql security definer;
  $f$;
  drop trigger if exists thma_nathab_notify on public.nathab_patterns;
  if to_regclass('public.nathab_patterns') is not null then
    create trigger thma_nathab_notify after insert on public.nathab_patterns
      for each row when (new.status is distinct from 'approved')
      execute function public.thma_notify_nathab();
  end if;

  -- แถวที่ trigger เก่าสร้างไว้ (มี title แต่ไม่มี message) — ย้ายข้อความมาไว้ที่ message
  update public.notifications
     set message = title
   where coalesce(message, '') = '' and coalesce(title, '') <> '';

  -- ๓ ── เติม kind ย้อนหลัง เพื่อให้ไอคอนถูกประเภท ─────────────────
  update public.notifications set kind =
    case
      when message ~ 'ตอบความเห็น'                        then 'reply'
      when message ~ 'ความคิดเห็น'                         then 'comment'
      when message ~ 'ไม่ผ่าน|ถูกปฏิเสธ'                    then 'rejected'
      when message ~ 'เลื่อน(ขั้น|บรรดาศักดิ์)'              then 'rank'
      when message ~ 'หน้าทับ'                             then 'nathab'
      when message ~ 'รอตรวจ'                              then 'pending'
      when message ~ 'อนุมัติ|เข้าฐานข้อมูลแล้ว'             then 'approved'
      when coalesce(link,'') like '/archive/%'             then 'archive'
      when coalesce(link,'') like '/songs/%'               then 'song'
      else null
    end
  where coalesce(kind, '') = '';
end $$;

-- ตรวจผล:
--   select kind, count(*) from public.notifications group by 1 order by 2 desc;
--   select count(*) from public.notifications where coalesce(message,'') = '';   -- ควรได้ 0

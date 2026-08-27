-- ๒๔ ─ นับศักดินาใหม่ทั้งระบบ ตามกติกาที่ Pk เคาะ 27 ส.ค. 69
--
-- ที่มา: ของเดิมให้ +10 เท่ากันทุกประเภท และให้ตอนกดอนุมัติเท่านั้น
--        บางเส้นทางลืมให้ (หน้าทับไม่เคยได้เลย) บางคนได้ซ้ำ → แต้มขาดบ้างเกินบ้าง
--
-- กติกาใหม่ (ตรงกับ lib/points.js)
--   บันทึกจดหมายเหตุ   +10   (แนบรูปอย่างน้อย 1 รูป +5 → รวม 15)
--   เพลงใหม่           +20
--   ทางเครื่อง         +10   ต่อ 1 เครื่องดนตรีต่อ 1 เพลง
--                            (ทางชุดแรกของเพลงที่ตัวเองเป็นคนส่ง นับรวมอยู่ใน 20 แล้ว ไม่บวกซ้ำ)
--   วิดีโอ              +5
--   ไฟล์เสียง           +5
--   ไฟล์โน้ต PDF         0
--   หน้าทับ              0
--
-- ไฟล์นี้ "คำนวณใหม่จากผลงานที่อนุมัติจริง" ไม่ใช่บวกเพิ่มจากของเดิม
-- จึงรันซ้ำกี่รอบก็ได้ผลเท่าเดิมเสมอ และเรียกซ้ำได้ทุกครั้งที่กติกาเปลี่ยน
--
-- ⚠ ศักดินาพิเศษ "ทาส" (999999) ของเจ้าของเว็บ จะไม่ถูกแตะ

-- ๑ ── มุมมองแหล่งแต้ม (ตารางไหนไม่มีในฐาน ก็สร้างเป็นมุมมองว่างไว้ สูตรจะได้ไม่พัง) ──
do $$
declare
  -- ชื่อมุมมอง , เงื่อนไข SQL ถ้าตารางมีจริง
  sql_archive text := $q$
    select r.submitted_by as uid, 'archive'::text as kind, r.id::text as ref,
           10 + case when exists (
                  select 1 from public.archive_media m
                   where m.record_id = r.id and m.media_type = 'image') then 5 else 0 end as pts
      from public.archive_records r
     where r.approved is true and r.submitted_by is not null $q$;
  sql_song text := $q$
    select s.contributed_by as uid, 'song'::text as kind, s.id::text as ref, 20 as pts
      from public.songs s
     where s.contributed_by is not null $q$;
  -- ทางเครื่อง: 1 แถวต่อ (เพลง, เครื่องดนตรี, คนส่ง)
  --   แล้วตัดชุดที่เป็น "ทางแรกของเพลงที่ตัวเองเปิด" ออก เพราะนับอยู่ใน 20 ของเพลงใหม่แล้ว
  sql_tang text := $q$
    with t as (
      select sm.submitted_by as uid, sm.song_id, sm.instrument,
             min(sm.id) as first_id
        from public.song_melody sm
       where coalesce(sm.approved, true) is true and sm.submitted_by is not null
       group by 1, 2, 3),
    own as (
      select t.uid, t.song_id, min(t.first_id) as skip_id
        from t join public.songs s on s.id = t.song_id and s.contributed_by = t.uid
       group by 1, 2)
    select t.uid, 'tang'::text as kind, t.song_id || ' · ' || coalesce(t.instrument,'?') as ref, 10 as pts
      from t left join own o on o.uid = t.uid and o.skip_id = t.first_id
     where o.skip_id is null $q$;
  sql_video text := $q$
    select v.submitted_by as uid, 'video'::text as kind, v.id::text as ref, 5 as pts
      from public.song_videos v
     where v.approved is true and v.submitted_by is not null $q$;
  sql_audio text := $q$
    select a.submitted_by as uid, 'audio'::text as kind, a.id::text as ref, 5 as pts
      from public.song_audio a
     where a.approved is true and a.submitted_by is not null $q$;
  empty text := $q$ select null::uuid as uid, ''::text as kind, ''::text as ref, 0 as pts where false $q$;
  v text; body text;
begin
  foreach v in array array['archive', 'song', 'tang', 'video', 'audio'] loop
    body := case v
      when 'archive' then case when to_regclass('public.archive_records') is not null
                                 and to_regclass('public.archive_media')   is not null then sql_archive else empty end
      when 'song'    then case when to_regclass('public.songs')         is not null then sql_song  else empty end
      when 'tang'    then case when to_regclass('public.song_melody')   is not null
                                 and to_regclass('public.songs')        is not null then sql_tang  else empty end
      when 'video'   then case when to_regclass('public.song_videos')   is not null then sql_video else empty end
      when 'audio'   then case when to_regclass('public.song_audio')    is not null then sql_audio else empty end
    end;
    execute format('create or replace view public.thma_pts_%s as %s', v, body);
  end loop;
end $$;

-- บัญชีแต้มรวมทุกแหล่ง — เปิดดูได้ว่าใครได้แต้มจากชิ้นไหนบ้าง
create or replace view public.thma_points_ledger as
  select * from public.thma_pts_archive
  union all select * from public.thma_pts_song
  union all select * from public.thma_pts_tang
  union all select * from public.thma_pts_video
  union all select * from public.thma_pts_audio;

-- ยอดที่ "ควรจะเป็น" ของแต่ละคน
create or replace view public.thma_points_should_be as
  select p.id,
         least(coalesce(sum(l.pts), 0), 999998)::int as points
    from public.profiles p
    left join public.thma_points_ledger l on l.uid = p.id
   group by p.id;

-- ๒ ── ฟังก์ชันนับใหม่ คืนตารางสรุปว่าใครขยับเท่าไร ──
create or replace function public.thma_recount_points()
returns table (id uuid, display_name text, old_points int, new_points int, diff int)
language plpgsql security definer as $$
begin
  return query
  with target as (
    select p.id, coalesce(p.points, 0)::int as old_pts, b.points as new_pts
      from public.profiles p
      join public.thma_points_should_be b on b.id = p.id
     where coalesce(p.points, 0) < 999999          -- ไม่แตะศักดินาพิเศษ "ทาส"
  ), upd as (
    update public.profiles p
       set points = t.new_pts
      from target t
     where p.id = t.id and coalesce(p.points, 0) <> t.new_pts
     returning p.id
  )
  select t.id, p.display_name, t.old_pts, t.new_pts, t.new_pts - t.old_pts
    from target t join public.profiles p on p.id = t.id
   where t.old_pts <> t.new_pts
   order by abs(t.new_pts - t.old_pts) desc;
end $$;

-- ๓ ── add_points: ให้มีอยู่จริงเสมอ (ของเดิมหน้า admin เรียกแล้วกลืน error เงียบ ๆ) ──
create or replace function public.add_points(uid uuid, pts int)
returns void language plpgsql security definer as $$
begin
  if uid is null or coalesce(pts, 0) = 0 then return; end if;
  update public.profiles
     set points = least(greatest(coalesce(points, 0) + pts, 0), 999998)
   where id = uid and coalesce(points, 0) < 999999;
end $$;

grant execute on function public.thma_recount_points() to authenticated;
grant execute on function public.add_points(uuid, int) to authenticated;

-- ๔ ── นับใหม่เลยหนึ่งรอบ ──
select * from public.thma_recount_points();

-- ตรวจเพิ่มเติม:
--   select kind, count(*), sum(pts) from public.thma_points_ledger group by 1 order by 3 desc;
--   select p.display_name, p.points from public.profiles p order by p.points desc limit 20;
--   select * from public.thma_points_ledger where uid = '<user_id>';   -- ดูรายชิ้นของคนคนเดียว

'use client';
// lib/i18n.js — สองภาษาไทย/อังกฤษ  (ขยายเต็มเว็บ · Pk 27 ส.ค. 69)
//
//   ปุ่มสลับอยู่บนแถบเมนู · จำภาษาที่เลือกไว้ในเครื่อง
//   คำที่ยังไม่ได้แปล จะตกกลับไปใช้ภาษาไทยเสมอ ไม่ขึ้นเป็นรหัสคีย์ให้ผู้ใช้เห็น
//
//   ★ นี่คือ "คำในหน้าเว็บ" เท่านั้น
//     เนื้อหาที่สมาชิกเขียนเอง (ประวัติเพลง · เหตุการณ์) เป็นคนละเรื่อง อยู่ในฐานข้อมูล
import { createContext, useContext, useEffect, useState } from 'react';
import { applyEN } from './uien';

const DICT = {
  th: {
    // ── แบรนด์ · เมนู ──
    brand: 'หอจดหมายเหตุดนตรีไทย', brand_sub: 'Thai Music Archive · THMA',
    nav_db: 'ฐานข้อมูลเพลงไทย', nav_archive: 'หอจดหมายเหตุดนตรีไทย',
    nav_board: 'ทำเนียบสมาชิก', nav_add: 'TH Notation+', nav_mine: 'ผลงานของฉัน',
    nav_diary: '📔 ไดอารี่', nav_homework: '📚 การบ้าน', nav_class: '🎓 ห้องเรียน',
    nav_login: 'เข้าสู่ระบบ', nav_signup: 'เข้าสู่ระบบ / สมัคร', nav_logout: 'ออกจากระบบ',
    nav_admin: 'ผู้ดูแล', nav_profile: 'โปรไฟล์', tb_menu: 'เมนู', tb_points: 'ศักดินา', tb_write: 'บันทึกโน้ตเพลง', tb_record: 'บันทึกเหตุการณ์', nav_side: '☰ เมนูข้าง', nav_top: '⇧ ใช้แถบเมนูด้านบน',
    nav_side_ttl: 'ย้ายเมนูไปเป็นรางไอคอนด้านซ้าย', nav_top_ttl: 'กลับไปใช้แถบเมนูด้านบน',
    nav_homework_ttl: 'ส่งการบ้าน / ตรวจการบ้าน', nav_diary_ttl: 'ไดอารี่ดนตรี → แฟ้มผลงาน',

    // ── ช่องค้นหาบนแถบเมนู ──
    search_ph: 'ค้นเพลง · เหตุการณ์ · ครูดนตรี…',
    search_go: 'ค้นหา', search_all: 'ค้นทั้งเว็บ',

    // ── หน้าแรก ──
    home_db_kicker: 'SONG DATABASE', home_db_title: 'ฐานข้อมูล\nเพลงไทย',
    home_db_sub: 'โน้ต 300 เพลง · 20,000+ วรรค · รหัสกระสวน · เล่นเสียงฆ้องวงจริง',
    home_db_cta: 'เข้าชมฐานข้อมูลเพลง', home_tag: 'โน้ตเพลงไทยที่เล่นเสียงฆ้องวงได้จริง และบันทึกเหตุการณ์ดนตรีไทยบนแผนที่ 700 ปี', home_sec_archive: 'จากหอจดหมายเหตุ', home_sec_archive_sub: 'สุ่มมาให้ดูใหม่ทุกครั้งที่เปิด', home_sec_top: 'นักจดหมายเหตุดนตรีไทยดีเด่น', home_sec_top_sub: 'ศักดินาสูงสุด 3 อันดับ', home_more_board: 'ดูทำเนียบทั้งหมด',
    home_ar_kicker: 'MUSIC ARCHIVE', home_ar_title: 'หอจดหมายเหตุ\nดนตรีไทย',
    home_ar_sub: 'เหตุการณ์ 270+ รายการ · แผนที่ · เส้นเวลา 700 ปี · ครูดนตรี',
    home_ar_cta: 'เข้าชมหอจดหมายเหตุ',

    // ── ฐานข้อมูลเพลง ──
    db_title: 'ฐานข้อมูลเพลงไทย', db_sub: 'โน้ตเพลงไทยพร้อมรหัสกระสวนและเสียงจริง',
    db_search_ph: 'ค้นหาชื่อเพลง หรือ Song ID…',
    db_all_types: 'ทุกประเภท', db_all_styles: 'ทุกลักษณะการบรรเลง', db_all_proof: 'ทุกสถานะตรวจทาน',
    del_ask: 'ลบเพลงนี้ถาวร?', del_warn: 'โน้ต วิดีโอ ไฟล์ และคอมเมนต์ของเพลงนี้จะถูกลบทั้งหมด',
    del_fail: 'ลบไม่สำเร็จ:', del_song: 'ลบเพลง (ผู้ดูแล)', part_of: 'เพลงย่อยใน',
    hide_song: 'ซ่อนเพลงนี้ — เห็นเฉพาะผู้ดูแล', unhide_song: 'เลิกซ่อน — เปิดให้ทุกคนเห็น',
    hidden_badge: 'เพลงนี้ถูกซ่อนอยู่ — เห็นเฉพาะผู้ดูแล', hide_fail: 'ซ่อน/เลิกซ่อนไม่สำเร็จ:',
    hide_need_sql: 'ยังไม่ได้รัน sql/46_hide_songs.sql ใน Supabase — รันก่อนแล้วลองใหม่',
    db_ver: 'หน้าฐานข้อมูลเพลงรุ่น', db_clear: '✕ ล้างตัวกรอง', db_none: 'ไม่พบเพลงที่ค้นหา',
    col_id: 'Song ID', col_name: 'ชื่อเพลง', col_type: 'ประเภท', col_style: 'ลักษณะการบรรเลง',
    col_verses: 'วรรค', col_krasuan: 'กระสวน', col_video: 'วิดีโอ', col_proof: 'ตรวจทาน',
    page_prev: '‹ ก่อนหน้า', page_next: 'ถัดไป ›', page_of: 'หน้า', page_total: 'ทั้งหมด',
    unit_songs: 'เพลง',
    st_songs: 'เพลง', st_records: 'เหตุการณ์', st_members: 'สมาชิก', st_patterns: 'กระสวน',

    // ── ตรวจทาน ──
    proof_head: 'ตรวจทานโน้ต:', proof_done: 'เสร็จแล้ว',
    proof_none: 'ยังไม่ตรวจ', proof_doing: 'กำลังตรวจ', proof_ok: 'ตรวจแล้วถูก', proof_bad: 'พบที่ผิด',
    proof_pick: 'เลือกสถานะ / ใส่หมายเหตุ', proof_note_ph: 'หมายเหตุ เช่น ท่อน 2 ลูกตกผิด',
    proof_enter: 'กด Enter เพื่อบันทึกหมายเหตุ', proof_where: 'กด ▾ เพื่อใส่ว่าผิดตรงไหน',
    proof_hint: 'คลิก = เปลี่ยนสถานะถัดไป · คลิกขวา = เลือกเอง',
    proof_filter: 'กรองตามสถานะการตรวจทานโน้ต', proof_badge: 'โน้ตผ่านการตรวจทานแล้ว',

    // ── ทั่วไป ──
    // ── รางไอคอนซ้าย ──
    rail_g_archive: 'คลัง', rail_g_studio: 'สตูดิโอ', rail_g_school: 'โรงเรียน',
    rail_db: 'ฐานข้อมูลเพลง', rail_archive: 'จดหมายเหตุ', rail_board: 'ทำเนียบสมาชิก',
    rail_search: 'ค้นหา', rail_write: 'เขียนโน้ต', rail_nathab: 'คลังหน้าทับ',
    rail_mine: 'ผลงานของฉัน', rail_diary: 'ไดอารี่ · แฟ้มผลงาน',
    rail_class: 'ห้องเรียน', rail_hw: 'การบ้าน', rail_menu: 'เมนูหลัก', rail_open: 'เปิดเมนู',

    // ── แถบล่าง ──
    f_krasuan: 'ค้นกระสวน', f_nathab: 'คลังหน้าทับ', f_convert: '🔁 แปลงโน้ต',
    f_people: 'ครูดนตรี', f_timeline: 'เส้นเวลา', f_compare: 'เปรียบเทียบเพลง',
    f_search: 'ค้นหา', f_about: 'เกี่ยวกับโครงการ', f_premium: '💎 สมาชิกอุปถัมภ์',
    f_spec: 'Krasuan Code', f_data: 'Open Data', f_glossary: 'อภิธานศัพท์', f_learn: 'เรียนรู้',

    // ── เข้าสู่ระบบ ──
    cta_signup: '✦ สมัครสมาชิก', cta_login: 'เข้าสู่ระบบ',

    // ── ทั่วไป ──
    loading: 'กำลังโหลด…', save: 'บันทึก', cancel: 'ยกเลิก', close: 'ปิด', back: '← กลับ',
    by: 'โดย', at: 'เมื่อ', more: 'ดูเพิ่ม', none_yet: 'ยังไม่มีข้อมูล',
  },
  en: {
    brand: 'Thai Music Archive', brand_sub: 'หอจดหมายเหตุดนตรีไทย · THMA',
    nav_db: 'Song Database', nav_archive: 'Music Archive',
    nav_board: 'Contributors', nav_add: 'TH Notation+', nav_mine: 'My Contributions',
    nav_diary: '📔 Diary', nav_homework: '📚 Homework', nav_class: '🎓 Classroom',
    nav_login: 'Sign in', nav_signup: 'Sign in / Register', nav_logout: 'Sign out',
    nav_admin: 'Admin', nav_profile: 'Profile', tb_menu: 'Menu', tb_points: 'sakdina', tb_write: 'Write notation', tb_record: 'Record an event', nav_side: '☰ Side menu', nav_top: '⇧ Use top bar',
    nav_side_ttl: 'Move the menu to the icon rail on the left', nav_top_ttl: 'Go back to the top menu bar',
    nav_homework_ttl: 'Submit / mark homework', nav_diary_ttl: 'Music diary → portfolio',

    search_ph: 'Search songs · events · musicians…',
    search_go: 'Search', search_all: 'Search everything',

    home_db_kicker: 'SONG DATABASE', home_db_title: 'Thai Song\nDatabase',
    home_db_sub: '300 songs · 20,000+ verses · Krasuan code · real gong-circle audio',
    home_db_cta: 'Browse the database', home_tag: 'Thai classical scores that play with real gong-circle sound, and a 700-year map of Thai music events', home_sec_archive: 'From the archive', home_sec_archive_sub: 'a fresh random pick each visit', home_sec_top: 'Top contributors', home_sec_top_sub: 'highest sakdina, top 3', home_more_board: 'See all contributors',
    home_ar_kicker: 'MUSIC ARCHIVE', home_ar_title: 'Thai Music\nArchive',
    home_ar_sub: '270+ events · map · 700-year timeline · master musicians',
    home_ar_cta: 'Enter the archive',

    db_title: 'Thai Song Database', db_sub: 'Thai classical notation with Krasuan codes and real instrument audio',
    db_search_ph: 'Search song name or Song ID…',
    db_all_types: 'All forms', db_all_styles: 'All performance styles', db_all_proof: 'All proofreading states',
    del_ask: 'Permanently delete this song?', del_warn: 'Its notation, videos, files and comments will all be deleted.',
    del_fail: 'Delete failed:', del_song: 'Delete song (staff)', part_of: 'Part of',
    hide_song: 'Hide this song — staff only', unhide_song: 'Unhide — visible to everyone',
    hidden_badge: 'This song is hidden — visible to staff only', hide_fail: 'Hide/unhide failed:',
    hide_need_sql: 'sql/46_hide_songs.sql has not been run in Supabase yet — run it first',
    db_ver: 'Song database build', db_clear: '✕ Clear filters', db_none: 'No songs found',
    col_id: 'Song ID', col_name: 'Song', col_type: 'Form', col_style: 'Performance style',
    col_verses: 'Verses', col_krasuan: 'Patterns', col_video: 'Video', col_proof: 'Proofread',
    page_prev: '‹ Previous', page_next: 'Next ›', page_of: 'Page', page_total: 'of',
    unit_songs: 'songs',
    st_songs: 'songs', st_records: 'records', st_members: 'members', st_patterns: 'patterns',

    proof_head: 'Proofreading:', proof_done: 'complete',
    proof_none: 'Not checked', proof_doing: 'Checking', proof_ok: 'Verified', proof_bad: 'Error found',
    proof_pick: 'Pick a state / add a note', proof_note_ph: 'Note — e.g. wrong final note in part 2',
    proof_enter: 'Press Enter to save the note', proof_where: 'Press ▾ to say what is wrong',
    proof_hint: 'Click = next state · Right-click = choose',
    proof_filter: 'Filter by proofreading state', proof_badge: 'Notation has been proofread',

    rail_g_archive: 'Archive', rail_g_studio: 'Studio', rail_g_school: 'School',
    rail_db: 'Song Database', rail_archive: 'Records', rail_board: 'Contributors',
    rail_search: 'Search', rail_write: 'Write notation', rail_nathab: 'Drum patterns',
    rail_mine: 'My Contributions', rail_diary: 'Diary · Portfolio',
    rail_class: 'Classroom', rail_hw: 'Homework', rail_menu: 'Main menu', rail_open: 'Open menu',

    f_krasuan: 'Pattern search', f_nathab: 'Drum patterns', f_convert: '🔁 Convert notation',
    f_people: 'Musicians', f_timeline: 'Timeline', f_compare: 'Compare songs',
    f_search: 'Search', f_about: 'About the project', f_premium: '💎 Patron members',
    f_spec: 'Krasuan Code', f_data: 'Open Data', f_glossary: 'Glossary', f_learn: 'Learn',

    cta_signup: '✦ Register', cta_login: 'Sign in',

    loading: 'Loading…', save: 'Save', cancel: 'Cancel', close: 'Close', back: '← Back',
    by: 'by', at: 'on', more: 'See more', none_yet: 'Nothing yet',
  },
};

const LangCtx = createContext({ lang: 'th', setLang: () => {}, t: k => k });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('th');
  useEffect(() => {
    try { const saved = localStorage.getItem('thma_lang'); if (saved === 'en' || saved === 'th') setLangState(saved); }
    catch (e) {}
  }, []);
  // ชั้นแปลทั้งเว็บ (lib/uien.js) — หน้าไหนยังไม่ได้ใส่ t() ก็ยังเป็นอังกฤษได้
  useEffect(() => { applyEN(lang === 'en'); }, [lang]);
  const setLang = l => {
    setLangState(l);
    try { localStorage.setItem('thma_lang', l); } catch (e) {}
    try { document.documentElement.lang = l === 'en' ? 'en' : 'th'; } catch (e) {}
  };
  // คำที่ยังไม่ได้แปล → ใช้ไทยแทน · ไม่มีทั้งคู่ → คืนคีย์ (เห็นแล้วรู้ว่าต้องเติม)
  const t = k => DICT[lang]?.[k] ?? DICT.th[k] ?? k;
  return <LangCtx.Provider value={{ lang, setLang, t, isEN: lang === 'en' }}>{children}</LangCtx.Provider>;
}
export const useLang = () => useContext(LangCtx);

// เลือกข้อความตามภาษา — ใช้กับข้อมูลที่มีทั้งไทยและอังกฤษในฐาน (เช่น songs.name_th / name_en)
export const pick = (lang, th, en) => (lang === 'en' ? (en || th) : (th || en));

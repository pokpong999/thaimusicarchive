'use client';
// lib/melodylog.js — ประวัติการแก้โน้ต  (Pk 27 ส.ค. 69)
//
//   ประวัติถูกจดโดย trigger ที่ฐานข้อมูล (sql/35) ไม่ใช่จากหน้าเว็บ
//   หน้าเว็บมีหน้าที่แค่ "อ่านมาแสดง" กับ "สั่งย้อนกลับ" เท่านั้น
import { supabase } from './supabase';

export const ACTION = {
  insert: { label: 'เพิ่มวรรค', icon: '＋', color: 'var(--jade)'   },
  update: { label: 'แก้โน้ต',   icon: '✎',  color: 'var(--gold2)'  },
  delete: { label: 'ลบวรรค',    icon: '🗑', color: 'var(--danger)' },
};

// ชื่อช่องเป็นภาษาคน — ไม่งั้นแอดมินเห็น 'right_hand' แล้วต้องมาเดา
export const FIELD = {
  combined: 'ทำนองรวม', right_hand: 'มือขวา', left_hand: 'มือซ้าย', third_hand: 'แนวที่สาม',
  krasuan: 'กระสวน', luktok: 'ลูกตก', section: 'ชื่อท่อน', marks: 'กรอ/ประคบ',
  level: 'อัตรา', ching: 'ฉิ่ง', line_no: 'บรรทัด', verse_no: 'เลขวรรค',
  approved: 'สถานะอนุมัติ', instrument: 'ทาง', part_song_id: 'เพลงย่อย', part_section: 'ชื่อท่อนของเพลงย่อย',
};
export const fieldName = k => FIELD[k] ?? k;

export async function loadLog({ songId = null, limit = 200 } = {}) {
  let q = supabase.from('song_melody_log').select('*').order('changed_at', { ascending: false }).limit(limit);
  if (songId) q = q.eq('song_id', songId);
  const { data, error } = await q;
  if (error) return { rows: [], error };
  return { rows: data ?? [], error: null };
}

export async function revertMelody(logId) {
  const { data, error } = await supabase.rpc('thma_revert_melody', { p_log_id: logId });
  return { msg: data ?? '', error };
}

// ช่องที่ต้องแสดงเสมอเมื่อเป็นการเพิ่ม/ลบทั้งวรรค — คนอ่านต้องเห็นว่าโน้ตที่หายไปคืออะไร
const CORE = ['combined', 'right_hand', 'left_hand', 'third_hand'];

// เทียบก่อน/หลัง — ไว้แสดงเป็นบรรทัด "ก่อน → หลัง"
//   ★ ไม่เชื่อ row.changed อย่างเดียว
//     ตอนลบทั้งวรรค บางแถวเก่าไม่มีรายการช่องมาให้ ถ้าเชื่ออย่างเดียวจะไม่แสดงอะไรเลย
//     แล้วโน้ตที่ถูกลบก็หายไปจากสายตา ทั้งที่ฐานเก็บไว้ให้แล้ว
export function diffLines(row) {
  const listed = (row.changed ?? []).filter(k => FIELD[k]);
  const keys = listed.length ? listed
    : CORE.filter(k => (row.before?.[k] ?? null) !== (row.after?.[k] ?? null));
  const out = keys.map(k => ({
    key: k, name: fieldName(k),
    before: row.before?.[k] ?? null,
    after: row.after?.[k] ?? null,
  })).filter(l => l.before !== null || l.after !== null);
  // ลบทั้งวรรคแล้วยังไม่มีอะไรจะโชว์ — อย่างน้อยต้องเห็นทำนองที่หายไป
  if (!out.length && row.before) {
    const k = CORE.find(x => row.before[x]);
    if (k) out.push({ key: k, name: fieldName(k), before: row.before[k], after: null });
  }
  return out;
}

export function logError(m = '') {
  if (/song_melody_log|thma_revert_melody|schema cache|does not exist/i.test(m))
    return 'ยังไม่ได้รัน sql/35 · ' + m;
  return m;
}

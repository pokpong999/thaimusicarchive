'use client';
// lib/songparts.js — เพลงย่อยใน "เพลงเรื่อง"  (Pk 27 ส.ค. 69)
//
//   โน้ตมีชุดเดียว เก็บอยู่ที่เพลงเรื่อง — เพลงย่อยเป็น "มุมมอง" ของช่วงวรรคหนึ่ง
//   ไม่มีการคัดลอกโน้ต จึงไม่มีทางที่สองเพลงจะไม่ตรงกัน (ต้องรัน sql/30)
//
//     songs.parent_song_id      เพลงย่อยชี้กลับไปที่เพลงเรื่อง
//     song_melody.part_song_id  วรรคนี้เป็นของเพลงย่อยไหน
//     song_melody.part_section  ชื่อท่อนเมื่อดูในนามเพลงย่อย ('ท่อน 1')
import { supabase } from './supabase';

// ── ๑ · เพลงนี้เป็นเพลงย่อยไหม ────────────────────────────────────
export async function songRef(id) {
  const { data, error } = await supabase.from('songs').select('*').eq('id', id).maybeSingle();
  if (error || !data) return { id, isPart: false, isSuite: false, song: null };
  const isPart = !!data.parent_song_id;
  return { id, isPart, song: data, parentId: data.parent_song_id ?? null, partNo: data.part_no ?? null, isSuite: false };
}

// ── ๒ · อ่านโน้ต — ที่เดียวที่ทุกหน้าควรเรียก ────────────────────
//   ส่ง id อะไรมาก็ได้ ไม่ต้องรู้ว่าเป็นเพลงเรื่องหรือเพลงย่อย
//   คืนแถวที่ verse_no/section ถูกแปลงเป็น "เลขของเพลงนั้น" แล้ว
//   แต่ยังพก _rowId กับ _srcVerse ไว้ ให้ตอนบันทึกกลับไปถูกแถวเดิม
export async function fetchMelody(id, { instrument = null, approvedOnly = false, columns = '*' } = {}) {
  const ref = await songRef(id);
  const base = () => {
    let q = supabase.from('song_melody').select(columns);
    if (ref.isPart) q = q.eq('part_song_id', id);
    else            q = q.eq('song_id', id);
    if (instrument) q = q.eq('instrument', instrument);
    if (approvedOnly) q = q.eq('approved', true);
    return q.order('verse_no');
  };
  const { data, error } = await base();
  if (error) return { rows: [], error, ref };
  return { rows: renumber(data ?? [], ref.isPart), error: null, ref };
}

// เลขวรรคของเพลงย่อยนับใหม่จาก 1 ต่อ "ทาง" หนึ่ง ๆ
//   ไม่เก็บเป็นคอลัมน์ตั้งใจ — เพิ่ม/ลบวรรคที่เพลงเรื่องแล้วเลขขยับตามเองทันที
export function renumber(rows, isPart) {
  if (!isPart) return rows;
  const seen = new Map();
  return rows.map(r => {
    const k = r.instrument ?? 'ทำนองหลัก';
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return { ...r, _rowId: r.id, _srcVerse: r.verse_no, _srcSection: r.section,
             verse_no: n, section: r.part_section ?? r.section };
  });
}

// ── ๓ · รายการเพลงย่อยของเพลงเรื่อง ───────────────────────────────
export async function listParts(parentId) {
  const { data } = await supabase.from('songs').select('*')
    .eq('parent_song_id', parentId).order('part_no');
  return data ?? [];
}

// ── ๔ · เดาว่าเพลงเรื่องนี้มีเพลงย่อยอะไรบ้าง ─────────────────────
//   ชื่อท่อนในฐานเขียนแบบ 'เพลงจิ้งจกทอง ท่อน 1' อยู่แล้ว
//   จึงตัดคำว่า 'เพลง' นำหน้า แล้วตัดตรง ' ท่อน N' ออก เหลือชื่อเพลงย่อย
//   วรรคที่ติดกันและชื่อเดียวกัน = เพลงเดียวกัน (ไม่รวมช่วงที่ขาดตอนแล้วชื่อซ้ำ —
//   เพลงเรื่องบางเรื่องวนกลับมาเพลงเดิม ซึ่งควรเป็นคนละช่วง ให้คนตัดสิน ไม่ใช่ระบบเดา)
export function baseName(section) {
  let s = (section ?? '').trim();
  if (!s) return '';
  s = s.replace(/^เพลง\s*/, '');
  s = s.replace(/\s*(ท่อน|ตอน|เที่ยว)\s*[\d๐-๙]+.*$/, '');
  s = s.replace(/\s*\(?(สามชั้น|สองชั้น|ชั้นเดียว)\)?\s*$/, m => m.trim() ? m : '');
  return s.trim();
}

export function suggestParts(rows) {
  const out = [];
  rows.forEach(r => {
    const name = baseName(r.section);
    const last = out[out.length - 1];
    if (last && last.name === name) { last.to = r.verse_no; last.verses += 1; last.sections.add(r.section ?? ''); }
    else out.push({ name, from: r.verse_no, to: r.verse_no, verses: 1, sections: new Set([r.section ?? '']) });
  });
  return out.map((p, i) => ({
    partNo: i + 1,
    name: p.name || `ตอนที่ ${i + 1}`,
    from: p.from, to: p.to, verses: p.verses,
    // คำนำหน้าที่จะตัดออกจากชื่อท่อน — ใช้ของจริงจากฐาน ไม่ใช่ที่เราเดา
    strip: [...p.sections][0]?.startsWith('เพลง' + p.name) ? 'เพลง' + p.name
         : [...p.sections][0]?.startsWith(p.name) ? p.name : null,
    sections: [...p.sections],
  }));
}

export const partIdFor = (parentId, n) => `${parentId}-${String(n).padStart(2, '0')}`;

// ── ๕ · ลงมือแยก / ยกเลิก ─────────────────────────────────────────
export async function makePart(parentId, p) {
  const { data, error } = await supabase.rpc('thma_make_part', {
    p_parent: parentId, p_part_id: p.id, p_part_no: p.partNo,
    p_name_th: p.name, p_from: p.from, p_to: p.to, p_strip: p.strip ?? null,
  });
  return { verses: data ?? 0, error };
}

export async function unmakePart(partId) {
  const { data, error } = await supabase.rpc('thma_unmake_part', { p_part_id: partId });
  return { verses: data ?? 0, error };
}

// ── ๖ · ข้อความอธิบายให้คนอ่านรู้เรื่อง ───────────────────────────
export function partError(m = '') {
  if (/function .*thma_make_part|schema cache|does not exist/i.test(m)) return 'ยังไม่ได้รัน sql/30 · ' + m;
  if (/ต้องเป็นผู้ดูแล/.test(m)) return m;
  return m;
}

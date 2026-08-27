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
  if (error || !data) return { id, isPart: false, song: null, ready: false };
  // ยังไม่มีคอลัมน์ = ยังไม่ได้รัน sql/30 — ต้องบอกให้รู้ ไม่ใช่ทำเป็นว่าไม่ใช่เพลงย่อยแล้วโชว์หน้าว่าง
  const ready = 'parent_song_id' in data;
  return { id, isPart: !!data.parent_song_id, song: data, ready,
           parentId: data.parent_song_id ?? null, partNo: data.part_no ?? null };
}

// ── ๒ · อ่านโน้ต — ที่เดียวที่ทุกหน้าควรเรียก ────────────────────
//   ส่ง id อะไรมาก็ได้ ไม่ต้องรู้ว่าเป็นเพลงเรื่องหรือเพลงย่อย
//   คืนแถวที่ verse_no/section ถูกแปลงเป็น "เลขของเพลงนั้น" แล้ว
//   แต่ยังพก _rowId กับ _srcVerse ไว้ ให้ตอนบันทึกกลับไปถูกแถวเดิม
export async function fetchMelody(id, { instrument = null, approvedOnly = false, columns = '*' } = {}) {
  const ref = await songRef(id);
  // ★ ทาง 'ทำนองหลัก' ต้องรับแถวที่ instrument เป็น null ด้วย
  //   ข้อมูลชุดที่นำเข้าจาก Excel หลายแถวไม่ได้ระบุทางไว้ — ถ้าใช้ eq เฉย ๆ จะไม่เจอสักแถว
  const build = withApproved => {
    let qq = supabase.from('song_melody').select(columns);
    qq = ref.isPart ? qq.eq('part_song_id', id) : qq.eq('song_id', id);
    if (instrument === 'ทำนองหลัก') qq = qq.or('instrument.eq.ทำนองหลัก,instrument.is.null');
    else if (instrument) qq = qq.eq('instrument', instrument);
    if (withApproved) qq = qq.eq('approved', true);
    return qq.order('verse_no');
  };
  const { data, error } = await build(approvedOnly);
  if (error) return { rows: [], error, ref, unapproved: false };
  // ★ กรอง approved แล้วว่างเปล่า แต่จริง ๆ มีโน้ตอยู่ = ยังไม่ได้อนุมัติ ไม่ใช่ไม่มีโน้ต
  //   โชว์ให้ดูดีกว่าปล่อยหน้าว่าง แล้วบอกตรง ๆ ว่าสถานะยังไม่อนุมัติ
  if (approvedOnly && (data ?? []).length === 0) {
    const alt = await build(false);
    if (!alt.error && (alt.data ?? []).length > 0) {
      return { rows: renumber(alt.data, ref.isPart), error: null, ref, unapproved: true };
    }
  }
  return { rows: renumber(data ?? [], ref.isPart), error: null, ref, unapproved: false };
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
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const toNum = t => +[...t].map(c => (THAI_DIGITS.includes(c) ? THAI_DIGITS.indexOf(c) : c)).join('');

// เลขท่อนในชื่อ — 'ท่อน 3' → 3 · 'ท่อน ๓' → 3 · ไม่มีเลข → null
export function thonNo(section) {
  const m = (section ?? '').match(/(?:ท่อน|ตอน|เที่ยว)\s*([\d๐-๙]+)/);
  return m ? toNum(m[1]) : null;
}

// ชื่อเพลงที่อยู่ในชื่อท่อน — ตัดคำว่า 'ท่อน N' ออก "ที่ตำแหน่งไหนก็ได้" ไม่ใช่เฉพาะท้ายบรรทัด
//   ต้นฉบับบางชุดเก็บไว้แค่ 'ท่อน 1' ล้วน ๆ (ชื่อเพลงหายไปตอนนำเข้า) → คืนค่าว่าง
//   ค่าว่างไม่ใช่ความล้มเหลว แต่แปลว่า "ชื่อท่อนบอกชื่อเพลงไม่ได้ ต้องใช้สัญญาณอื่น"
export function baseName(section) {
  let s = (section ?? '').trim();
  if (!s) return '';
  s = s.replace(/^[\d๐-๙]+\s*[.)]\s*/, '');                     // เลขลำดับหน้าชื่อ '11. เพลง…'
  s = s.replace(/(?:ท่อน|ตอน|เที่ยว)\s*[\d๐-๙]+/g, ' ');          // 'ท่อน N' ทุกตำแหน่ง
  return s.replace(/\s+/g, ' ').trim();
}

export const prettyName = b => (b ?? '').replace(/^เพลง\s*/, '').trim();

// ── เดาขอบเขตเพลงย่อย ─────────────────────────────────────────────
//   ใช้สองสัญญาณ ไม่ใช่สัญญาณเดียว
//     ๑ ชื่อเพลงในชื่อท่อนเปลี่ยน            ('เพลงจิ้งจกทอง …' → 'เพลงตะทาลา …')
//     ๒ ★ เลขท่อนรีเซ็ต (นับถอยหลังหรือกลับไป 1)
//
//   สัญญาณที่ ๒ สำคัญมาก: ต้นฉบับของ JJT001 ในฐานเก็บชื่อท่อนไว้แค่ 'ท่อน 1'..'ท่อน 6'
//   ชื่อเพลงหายไปตั้งแต่ตอนนำเข้า สัญญาณที่ ๑ จึงใช้ไม่ได้เลย
//   แต่เลขท่อนวิ่ง 1,2,3 แล้วกลับมา 1,2,3,4,5,6 — จุดที่กลับมา 1 คือเพลงใหม่
//   (ตรวจกับของจริงแล้ว: รีเซ็ตที่วรรค 53 = จิ้งจกทอง 52 วรรค / ตะทาลา 96 วรรค ตรงเป๊ะ)
export function suggestParts(rows) {
  const out = [];
  let lastThon = null;
  rows.forEach(r => {
    const key = baseName(r.section);
    const n = thonNo(r.section);
    const last = out[out.length - 1];
    const sameName = last && last.key === key;
    const reset = n != null && lastThon != null && n < lastThon;
    if (sameName && !reset) {
      last.to = r.verse_no; last.verses += 1; last.sections.push(r.section ?? '');
      last.thons.add(n);
    } else {
      out.push({ key, from: r.verse_no, to: r.verse_no, verses: 1,
                 sections: [r.section ?? ''], thons: new Set([n]) });
    }
    if (n != null) lastThon = n;
  });
  return out.map((p, i) => {
    const thons = [...p.thons].filter(x => x != null).sort((a, b) => a - b);
    return {
      partNo: i + 1,
      name: prettyName(p.key) || '',
      rawName: p.key,
      from: p.from, to: p.to, verses: p.verses,
      sections: [...new Set(p.sections)],
      thons,
      // ★ ชื่อเพลงไม่ได้อยู่ในต้นฉบับ — ต้องให้คนพิมพ์เอง ไม่เดาให้
      noName: !p.key,
    };
  });
}

export const partIdFor = (parentId, n) => `${parentId}-${String(n).padStart(2, '0')}`;

// ── ๕ · ลงมือแยก / ยกเลิก ─────────────────────────────────────────
export async function makePart(parentId, p) {
  const { data, error } = await supabase.rpc('thma_make_part', {
    p_parent: parentId, p_part_id: p.id, p_part_no: p.partNo,
    p_name_th: p.name, p_from: p.from, p_to: p.to, p_strip: null,
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

// ── ๗ · ตรวจข้อมูลในฐาน (ต้องรัน sql/31) ─────────────────────────
//   ไว้ดูด้วยตาว่าเพลงเรื่องนี้มีชื่อท่อนอะไรบ้าง ช่วงวรรคไหน ทางอะไร อนุมัติแล้วกี่วรรค
//   เขียนขึ้นเพราะรอบก่อนแยกได้ไม่ครบแล้วหาสาเหตุไม่เจอ — เดาจากไฟล์ Excel ไม่พอ
//   ต้องดูของจริงในฐาน
export async function suiteReport(songId) {
  const { data, error } = await supabase.rpc('thma_suite_report', { p_song: songId });
  if (error) return { rows: [], error };
  return { rows: data ?? [], error: null };
}

// สรุปตัวเลขที่ใช้ตัดสินใจได้เร็ว ๆ
export function reportSummary(rows) {
  const byInst = new Map();
  rows.forEach(r => {
    const k = r.instrument ?? 'ทำนองหลัก';
    const cur = byInst.get(k) ?? { verses: 0, approved: 0, groups: 0, noName: 0, claimed: 0 };
    cur.verses += Number(r.verses); cur.approved += Number(r.approved_n); cur.groups += 1;
    if (!r.section) cur.noName += Number(r.verses);
    if (r.part_song_id) cur.claimed += Number(r.verses);
    byInst.set(k, cur);
  });
  return [...byInst.entries()].map(([instrument, v]) => ({ instrument, ...v }));
}

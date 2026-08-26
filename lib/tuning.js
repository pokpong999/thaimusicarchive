// lib/tuning.js — ระบบเสียง (Tuning): ความถี่จริงของโน้ตแต่ละเสียง (2026-08-26)
//
//   "ระบบเสียง" หนึ่งชุด = บอกได้ว่าโน้ต ด ร ม ฟ ซ ล ท ในแต่ละช่วงเสียง มีความถี่กี่เฮิรตซ์
//   ค่าตั้งต้น = ตารางความถี่เสียงดนตรีไทย กรมศิลปากร (ชุด ม.ว. สำนักการสังคีต) 2 กลุ่ม
//     · เครื่องสาย / มโหรี   ล ช่วงเสียง 5 = 377.8 Hz
//     · ปี่พาทย์             ล ช่วงเสียง 5 = 417.2 Hz   (= เครื่องสายสูงขึ้น 1 เสียง)
//   ทั้งสองชุดเป็น "7 เสียงเท่ากัน" (1 ขั้น = 2^(1/7) ≈ 1.10409)
//
//   รองรับ 3 วิธีกำหนด — เผื่อระบบเสียงอื่นที่ไม่ได้แบ่งเท่ากัน:
//     edo      แบ่งคู่แปดเท่ากัน N เสียง จากเสียงอ้างอิง 1 เสียง            (ค่าปริยาย N = 7)
//     degrees  กำหนดเป็นเซนต์รายเสียงในหนึ่งคู่แปด [0, 171, 343, …]      (ยาวเท่ากับ edo)
//     table    กำหนดความถี่เองทุกเสียง {"ด|0": 230.3, "ร|0": 254.2, …}   (ชนะทุกวิธี · เสียงที่ไม่ได้ระบุตกไปใช้ edo/degrees)
//
//   ช่วงเสียงในตารางกรมศิลปากร (0–9) ↔ ช่วงเสียงในเว็บ (reg): reg = ช่วงเสียง − mid_octave (ปริยาย 5)
//     ช่วงเสียง 5 = reg 0 (กลาง) · ช่วงเสียง 6 = reg +1 · ช่วงเสียง 4 = reg −1
import { supabase } from './supabase';
import { NOTES_TH, stepOf, noteOfStep } from './instruments';

export const MID_OCTAVE_DEFAULT = 5;

// ── ชุดสำรองในโค้ด (ใช้ได้ทันทีแม้ยังไม่ได้รัน SQL) ─────────────────
export const BUILTIN_TUNINGS = [
  { slug: 'silpakorn_sai', name_th: 'กรมศิลปากร — เครื่องสาย / มโหรี', ensemble: 'sai',
    ref_note: 'ล', ref_reg: 0, ref_hz: 377.8, edo: 7, mid_octave: 5, sort: 10, enabled: true, is_default: true,
    note: 'ตารางความถี่เสียงดนตรีไทย กรมศิลปากร (กลุ่มเสียงเครื่องสายและมโหรี) — อ้างอิงเครื่องดนตรีไทยชุด ม.ว. สำนักการสังคีต',
    table_hz: {
      'ด|-5':7.1, 'ร|-5':7.9, 'ม|-5':8.7, 'ฟ|-5':9.6, 'ซ|-5':10.6, 'ล|-5':11.8, 'ท|-5':13.0,
      'ด|-4':14.3, 'ร|-4':15.8, 'ม|-4':17.5, 'ฟ|-4':19.3, 'ซ|-4':21.3, 'ล|-4':23.6, 'ท|-4':26.0,
      'ด|-3':28.7, 'ร|-3':31.7, 'ม|-3':35.0, 'ฟ|-3':38.7, 'ซ|-3':42.7, 'ล|-3':47.2, 'ท|-3':52.1,
      'ด|-2':57.5, 'ร|-2':63.5, 'ม|-2':70.1, 'ฟ|-2':77.4, 'ซ|-2':85.5, 'ล|-2':94.4, 'ท|-2':104.2,
      'ด|-1':115.1, 'ร|-1':127.1, 'ม|-1':140.3, 'ฟ|-1':154.9, 'ซ|-1':171.1, 'ล|-1':188.9, 'ท|-1':208.5,
      'ด|0':230.3, 'ร|0':254.2, 'ม|0':280.7, 'ฟ|0':309.9, 'ซ|0':342.2, 'ล|0':377.8, 'ท|0':417.2,
      'ด|1':460.6, 'ร|1':508.5, 'ม|1':561.5, 'ฟ|1':619.9, 'ซ|1':684.4, 'ล|1':755.7, 'ท|1':834.4,
      'ด|2':921.2, 'ร|2':1017.1, 'ม|2':1123.0, 'ฟ|2':1239.9, 'ซ|2':1368.9, 'ล|2':1511.4, 'ท|2':1668.8,
      'ด|3':1842.5, 'ร|3':2034.2, 'ม|3':2246.0, 'ฟ|3':2479.8, 'ซ|3':2737.9, 'ล|3':3022.9, 'ท|3':3337.6,
      'ด|4':3685.0, 'ร|4':4068.5, 'ม|4':4492.0, 'ฟ|4':4959.6, 'ซ|4':5475.9, 'ล|4':6045.8, 'ท|4':6675.2 } },
  { slug: 'silpakorn_piphat', name_th: 'กรมศิลปากร — ปี่พาทย์', ensemble: 'piphat',
    ref_note: 'ล', ref_reg: 0, ref_hz: 417.2, edo: 7, mid_octave: 5, sort: 20, enabled: true, is_default: false,
    note: 'ตารางความถี่เสียงดนตรีไทย กรมศิลปากร (กลุ่มเสียงปี่พาทย์) — สูงกว่าเครื่องสาย 1 เสียง',
    table_hz: {
      'ด|-5':7.9, 'ร|-5':8.7, 'ม|-5':9.6, 'ฟ|-5':10.6, 'ซ|-5':11.8, 'ล|-5':13.0, 'ท|-5':14.3,
      'ด|-4':15.8, 'ร|-4':17.5, 'ม|-4':19.3, 'ฟ|-4':21.3, 'ซ|-4':23.6, 'ล|-4':26.0, 'ท|-4':28.7,
      'ด|-3':31.7, 'ร|-3':35.0, 'ม|-3':38.7, 'ฟ|-3':42.7, 'ซ|-3':47.2, 'ล|-3':52.1, 'ท|-3':57.5,
      'ด|-2':63.5, 'ร|-2':70.1, 'ม|-2':77.4, 'ฟ|-2':85.5, 'ซ|-2':94.4, 'ล|-2':104.2, 'ท|-2':115.1,
      'ด|-1':127.1, 'ร|-1':140.3, 'ม|-1':154.9, 'ฟ|-1':171.1, 'ซ|-1':188.9, 'ล|-1':208.5, 'ท|-1':230.3,
      'ด|0':254.2, 'ร|0':280.7, 'ม|0':309.9, 'ฟ|0':342.2, 'ซ|0':377.8, 'ล|0':417.2, 'ท|0':460.6,
      'ด|1':508.5, 'ร|1':561.5, 'ม|1':619.9, 'ฟ|1':684.4, 'ซ|1':755.7, 'ล|1':834.4, 'ท|1':921.2,
      'ด|2':1017.1, 'ร|2':1123.0, 'ม|2':1239.9, 'ฟ|2':1368.9, 'ซ|2':1511.4, 'ล|2':1668.8, 'ท|2':1842.5,
      'ด|3':2034.2, 'ร|3':2246.0, 'ม|3':2479.8, 'ฟ|3':2737.9, 'ซ|3':3022.9, 'ล|3':3337.6, 'ท|3':3685.0,
      'ด|4':4068.5, 'ร|4':4492.0, 'ม|4':4959.6, 'ฟ|4':5475.9, 'ซ|4':6045.8, 'ล|4':6675.2, 'ท|4':7370.0 } },
];
export const DEFAULT_TUNING = 'silpakorn_sai';

function norm(t) {
  if (!t) return BUILTIN_TUNINGS[0];
  return {
    ...t,
    ref_note: NOTES_TH.includes(t.ref_note) ? t.ref_note : 'ล',
    ref_reg: Number.isFinite(+t.ref_reg) ? +t.ref_reg : 0,
    ref_hz: +t.ref_hz > 0 ? +t.ref_hz : 377.8,
    edo: +t.edo > 0 ? +t.edo : 7,
    mid_octave: Number.isFinite(+t.mid_octave) ? +t.mid_octave : MID_OCTAVE_DEFAULT,
  };
}

/* ───────── ความถี่ของหนึ่งเสียง ───────── */

// ขั้นเสียงสัมบูรณ์ (ด กลาง = 0) → ความถี่ (Hz)
export function hzOfStep(tuning, step) {
  const t = norm(tuning);
  // 1) ตารางกำหนดเอง (ชนะทุกวิธี)
  if (t.table_hz) {
    const n = noteOfStep(step);
    const v = +t.table_hz[`${n.ch}|${n.reg}`];
    if (v > 0) return v;
  }
  const edo = t.edo;
  const refStep = stepOf(t.ref_note, t.ref_reg);
  const d = step - refStep;
  // 2) เซนต์รายเสียง (ระบบที่ไม่ได้แบ่งเท่ากัน)
  if (Array.isArray(t.degrees) && t.degrees.length === edo) {
    const mod = ((d % edo) + edo) % edo, oct = Math.floor(d / edo);
    const refDeg = ((refStep % edo) + edo) % edo;
    const deg = ((mod + refDeg) % edo);
    const cents = (+t.degrees[deg] || 0) - (+t.degrees[refDeg] || 0);
    const wrap = deg < refDeg ? 1 : 0;            // ข้ามคู่แปดตอนวนกลับ
    return t.ref_hz * Math.pow(2, oct + wrap + cents / 1200);
  }
  // 3) แบ่งคู่แปดเท่ากัน (ปริยาย 7 เสียงเท่ากัน)
  return t.ref_hz * Math.pow(2, d / edo);
}
export function hzOf(tuning, ch, reg = 0) { return hzOfStep(tuning, stepOf(ch, reg)); }

// อัตราเร่ง/หน่วงไฟล์เสียง เพื่อให้ได้ความถี่ที่ต้องการจากไฟล์ที่มี
export function rateFor(targetHz, srcHz) {
  return targetHz > 0 && srcHz > 0 ? targetHz / srcHz : 1;
}
// ช่วงเสียงในตารางกรมศิลปากร (0–9) ↔ reg ของเว็บ
export const octaveOf = (tuning, reg) => (norm(tuning).mid_octave) + (reg || 0);
export const regOfOctave = (tuning, oct) => oct - norm(tuning).mid_octave;
export const hzText = hz => (hz >= 1000 ? hz.toFixed(1) : hz >= 100 ? hz.toFixed(1) : hz.toFixed(2));

// ตารางเต็มไว้แสดงในหน้าผู้ดูแล — [{octave, cells:[{ch, reg, hz}]}]
export function tuningTable(tuning, fromOct = 0, toOct = 9) {
  const t = norm(tuning);
  const rows = [];
  for (let o = fromOct; o <= toOct; o++) {
    const reg = regOfOctave(t, o);
    rows.push({ octave: o, reg, cells: NOTES_TH.map(ch => ({ ch, reg, hz: hzOf(t, ch, reg) })) });
  }
  return rows;
}

/* ───────── โหลดจากฐานข้อมูล ───────── */
let _cache = null, _at = 0;
export async function loadTunings({ force = false } = {}) {
  if (!_cache || force || Date.now() - _at > 60 * 1000) {
    try {
      const { data, error } = await supabase.from('tunings').select('*').order('sort').order('name_th');
      if (error) throw error;
      _cache = (data ?? []).length ? data.map(norm) : BUILTIN_TUNINGS;
    } catch { _cache = _cache || BUILTIN_TUNINGS; }
    _at = Date.now();
  }
  return _cache.filter(t => t.enabled !== false);
}
export function invalidateTunings() { _cache = null; }
export function tuningBySlug(list, slug) {
  const L = (list && list.length ? list : BUILTIN_TUNINGS);
  return L.find(t => t.slug === slug) || L.find(t => t.is_default) || L[0];
}
// ชุดที่ตรงกับปุ่มเดิม (เครื่องสาย / ปี่พาทย์) — ให้เพลงเก่าที่บันทึก ensemble ไว้ยังเปิดได้เหมือนเดิม
export function tuningForEnsemble(list, ens) {
  const L = (list && list.length ? list : BUILTIN_TUNINGS);
  return L.find(t => t.ensemble === ens) || tuningBySlug(L, DEFAULT_TUNING);
}
export function ensembleOf(tuning) { return norm(tuning).ensemble === 'piphat' ? 'piphat' : 'sai'; }

/* ───────── ความถี่รายตำแหน่งของเครื่องดนตรี ───────── */
//   instrument_notes: บอกว่า "ตำแหน่งที่ n ของเครื่องนี้ = โน้ตอะไร ช่วงเสียงไหน ความถี่จริงเท่าไหร่ ไฟล์ชื่ออะไร"
//   ความถี่จริง (hz) ว่างได้ → ถือว่าตรงตามระบบเสียงที่เลือก
const _notes = {}; const _notesAt = {};
export async function loadInstrumentNotes(slug, { force = false } = {}) {
  if (!slug) return [];
  if (!force && _notes[slug] && Date.now() - (_notesAt[slug] || 0) < 60 * 1000) return _notes[slug];
  try {
    const { data, error } = await supabase.from('instrument_notes').select('*').eq('instrument', slug).order('idx');
    if (error) throw error;
    _notes[slug] = data ?? [];
  } catch { _notes[slug] = _notes[slug] || []; }
  _notesAt[slug] = Date.now();
  return _notes[slug];
}
export function invalidateInstrumentNotes(slug) { if (slug) { delete _notes[slug]; delete _notesAt[slug]; } else { for (const k of Object.keys(_notes)) delete _notes[k]; } }
// แปลงเป็นแผนที่ "ขั้นเสียง → ความถี่จริง" ไว้ให้คลังเสียงใช้ตอนคำนวณอัตราเล่น
export function notesToHzMap(rows) {
  const m = {};
  (rows ?? []).forEach(r => { if (+r.hz > 0 && r.note) m[stepOf(r.note, +r.reg || 0)] = +r.hz; });
  return m;
}

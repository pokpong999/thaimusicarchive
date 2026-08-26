// lib/instruments.js — ทะเบียนเครื่องดนตรี (คลังเสียง + ระบบบันทึกที่แนะนำ) (2026-08-26)
//
//   ตาราง instruments ในฐาน = ทะเบียนกลาง · แอดมินเพิ่มเครื่องใหม่ที่ /admin/samples
//   เพิ่มเครื่อง + อัปไฟล์เสียงแล้ว → เครื่องนั้นโผล่ในตัวเลือก "เสียง" ของกระดานและเครื่องเล่นทันที
//
//   การตั้งชื่อไฟล์เสียง 2 แบบ (คอลัมน์ naming)
//     'index' — 01.mp3 02.mp3 … เรียงจากเสียงต่ำสุดขึ้นไปทีละขั้น (ขิม ระนาด จะเข้ ฯลฯ)
//               ไฟล์ 01 = โน้ต low_note + low_reg · ไฟล์ n = ขยับขึ้น n-1 ขั้น (บันไดเสียงไทย 7 เสียงเท่ากัน)
//     'note'  — d_mid.mp3 r_high.mp3 … (ระบบเดิมของฆ้องวงใหญ่ ยังใช้ได้)
import { supabase } from './supabase';

export const NOTES_TH = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
export const NOTE_LATIN = { 'ด': 'd', 'ร': 'r', 'ม': 'm', 'ฟ': 'f', 'ซ': 's', 'ล': 'l', 'ท': 't' };
export const LATIN_NOTE = Object.fromEntries(Object.entries(NOTE_LATIN).map(([a, b]) => [b, a]));
export const REG_NAME = { '-2': 'vlow', '-1': 'low', '0': 'mid', '1': 'high', '2': 'vhigh' };
export const NAME_REG = Object.fromEntries(Object.entries(REG_NAME).map(([a, b]) => [b, +a]));

// ── ขั้นเสียงสัมบูรณ์ (บันไดไทย 7 เสียงเท่ากัน): step = ลำดับโน้ต + 7 × ช่วงเสียง ──
export const stepOf = (ch, reg = 0) => NOTES_TH.indexOf(ch) + 7 * (reg || 0);
export function noteOfStep(step) {
  const i = ((step % 7) + 7) % 7;
  return { ch: NOTES_TH[i], reg: Math.floor(step / 7) };
}
export const noteLabel = (ch, reg) => ch + (reg > 0 ? 'ํ'.repeat(Math.min(2, reg)) : reg < 0 ? 'ฺ'.repeat(Math.min(2, -reg)) : '');
export const stepLabel = step => { const n = noteOfStep(step); return noteLabel(n.ch, n.reg); };

// ── เครื่องปริยาย (ใช้เมื่อยังไม่มีตาราง instruments หรือฐานล่ม) ──
export const BUILTIN = [
  { slug: 'gong', name_th: 'ฆ้องวงใหญ่', kind: 'melody', naming: 'note', low_note: 'ม', low_reg: -1, note_count: 16, transpose: 0, system: 'melody1', sort: 10, enabled: true },
];

// ไฟล์ลำดับที่ n (1-based) → โน้ต · และย้อนกลับ
export function indexToStep(inst, n) { return stepOf(inst.low_note || 'ด', inst.low_reg ?? 0) + (n - 1); }
export function stepToIndex(inst, step) { return step - stepOf(inst.low_note || 'ด', inst.low_reg ?? 0) + 1; }
export function instRange(inst) {
  const lo = stepOf(inst.low_note || 'ด', inst.low_reg ?? 0);
  return { lo, hi: lo + Math.max(1, inst.note_count || 1) - 1 };
}
// รายการไฟล์ที่ "ควรมี" ของเครื่องหนึ่ง — ใช้ทำเช็กลิสต์ในหน้าผู้ดูแล
export function fileChecklist(inst) {
  const n = Math.max(1, Math.min(60, inst.note_count || 1));
  return Array.from({ length: n }, (_, k) => {
    const step = indexToStep(inst, k + 1);
    const nt = noteOfStep(step);
    return {
      index: k + 1,
      step,
      note: noteLabel(nt.ch, nt.reg),
      name: inst.naming === 'note'
        ? `${NOTE_LATIN[nt.ch]}_${REG_NAME[String(nt.reg)] ?? 'mid'}`
        : String(k + 1).padStart(2, '0'),
    };
  });
}

// ── อ่านทะเบียนจากฐาน (แคชสั้น ๆ เพื่อให้เครื่องใหม่โผล่เร็ว) ──
let _cache = null, _at = 0;
export async function loadInstruments({ force = false, kind = null } = {}) {
  if (!_cache || force || Date.now() - _at > 60 * 1000) {
    try {
      const { data, error } = await supabase.from('instruments').select('*').order('sort').order('name_th');
      if (error) throw error;
      _cache = (data ?? []).length ? data : BUILTIN;
    } catch { _cache = _cache || BUILTIN; }
    _at = Date.now();
  }
  const list = _cache.filter(i => i.enabled !== false);
  return kind ? list.filter(i => (i.kind || 'melody') === kind) : list;
}
export function invalidateInstruments() { _cache = null; }
export function instBySlug(list, slug) { return (list ?? []).find(i => i.slug === slug) || null; }

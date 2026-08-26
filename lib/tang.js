// lib/tang.js — ทาง (บันไดเสียง) 7 ทาง × 2 ระบบบันทึก (2026-08-26)
//
//   ทางหนึ่ง = ปัญจมูล 5 เสียง เรียงตามรูป 1 2 3 x 5 6 x จากเสียงตั้ง (tonic)
//   ทางเรียงจากเสียงตั้งต่ำไปสูง ทางละ 1 ขั้น · ครบ 7 ทางแล้ววนกลับ
//
//   สองระบบบันทึก — ทางเดียวกัน เครื่องสายเขียนตัวอักษร "สูงกว่า" ปี่พาทย์ 1 ขั้น
//   หมุดยืนยันจาก Pk: ทางชวา ปี่พาทย์ขึ้นด้วย ม · เครื่องสายขึ้นด้วย ฟ
//   ผลคือ "โน้ตชุดเดียวกันมีสองชื่อ" เช่น ร ม ซ ล ท = ทางใน (ปี่พาทย์) = ทางเพียงออล่าง (เครื่องสาย)
//   → เวลาระบุทางจากโน้ต ต้องรู้ก่อนว่าต้นฉบับจดด้วยระบบไหน ไม่งั้นเพี้ยน 1 ขั้น
//
//   เสียงที่ได้ยินเท่ากันทั้งสองระบบ เพราะตารางความถี่สองชุดก็ต่างกัน 1 ขั้นพอดี (lib/tuning.js)
import { NOTES_TH, stepOf, noteOfStep } from './instruments';

export const ENSEMBLES = { piphat: 'ปี่พาทย์', khrueangsai: 'เครื่องสาย' };
export const DEFAULT_ENSEMBLE = 'piphat';
// เครื่องสายเขียนสูงกว่าปี่พาทย์ 1 ขั้น
export const ensembleOffset = ens => (ens === 'khrueangsai' ? 1 : 0);

// รูปปัญจมูล: หยิบขั้นที่ 1 2 3 5 6 ของบันได 7 เสียง (เว้นขั้นที่ 4 กับ 7)
export const PENTA = [0, 1, 2, 4, 5];

// เสียงตั้งของแต่ละทางในระบบปี่พาทย์ — ไล่จาก ฟ ขึ้นทีละขั้น
export const TANGS = [
  { no: 1, name: 'ทางเพียงออล่าง', short: 'เพียงออล่าง', tonic: 3 },
  { no: 2, name: 'ทางใน',          short: 'ใน',          tonic: 4 },
  { no: 3, name: 'ทางกลาง',        short: 'กลาง',        tonic: 5 },
  { no: 4, name: 'ทางเพียงออบน',   short: 'เพียงออบน',   tonic: 6, alias: 'ทางนอกต่ำ' },
  { no: 5, name: 'ทางนอก',         short: 'นอก',         tonic: 0, alias: 'ทางกรวด' },
  { no: 6, name: 'ทางกลางแหบ',     short: 'กลางแหบ',     tonic: 1 },
  { no: 7, name: 'ทางชวา',         short: 'ชวา',         tonic: 2 },
];
export const TANG_NOS = TANGS.map(t => t.no);

export function tangOf(no) { return TANGS.find(t => t.no === no) || TANGS[1]; }
// อ่านชื่อทางจากข้อความอิสระ เช่น "ทางใน (ปี่พาทย์) / ทางเพียงออล่าง"
//   เลือกชื่อที่โผล่ก่อน (ทางหลักของเพลงมักเขียนไว้ต้นข้อความ) · ชื่อยาวชนะชื่อสั้นที่ตำแหน่งเดียวกัน
//   (ไม่งั้น "ทางกลางแหบ" จะถูกอ่านเป็น "ทางกลาง")
export function tangByName(name) {
  const s = String(name || '').replace(/\s+/g, '');
  if (!s) return null;
  let best = null;
  for (const t of TANGS) {
    for (const w of [t.name, t.alias].filter(Boolean).map(x => x.replace('ทาง', ''))) {
      const i = s.indexOf(w);
      if (i < 0) continue;
      if (!best || i < best.i || (i === best.i && w.length > best.len)) best = { t, i, len: w.length };
    }
  }
  return best ? best.t : null;
}
// เสียงตั้งของทางนี้ ในระบบบันทึกที่ระบุ (0–6)
export function tonicOf(no, ens = DEFAULT_ENSEMBLE) { return (tangOf(no).tonic + ensembleOffset(ens)) % 7; }
// ปัญจมูล 5 เสียงของทางนี้ (เรียงจากเสียงตั้ง)
export function scaleOf(no, ens = DEFAULT_ENSEMBLE) {
  const t = tonicOf(no, ens);
  return PENTA.map(d => NOTES_TH[(t + d) % 7]);
}
export const scaleText = (no, ens) => scaleOf(no, ens).join(' ');
// รูปแบบ "ดรม X ซล X" ที่ใช้ในเอกสารวิชาการ
export function pentaText(no, ens = DEFAULT_ENSEMBLE) {
  const s = scaleOf(no, ens);
  return s.slice(0, 3).join('') + ' X ' + s.slice(3).join('') + ' X';
}

/* ───────── หมุนทำนองข้ามทาง ───────── */

// กี่ขั้นเสียงจากทาง A ไปทาง B (ในระบบบันทึกเดียวกัน) — ย่อให้อยู่ในช่วง -3..3 (ทางใกล้สุด)
export function shiftBetween(fromNo, toNo) {
  let d = (tangOf(toNo).tonic - tangOf(fromNo).tonic) % 7;
  if (d > 3) d -= 7;
  if (d < -3) d += 7;
  return d;
}
// ขั้นเสียงที่ต้องเลื่อน เมื่อเปลี่ยนทั้งทางและระบบบันทึก
export function shiftFor(fromNo, fromEns, toNo, toEns) {
  return shiftBetween(fromNo, toNo) + ensembleOffset(toEns) - ensembleOffset(fromEns);
}

// เลื่อนโน้ตหนึ่งตัว {ch, reg} ไปกี่ขั้น
export function shiftNote(n, by) {
  const s = stepOf(n.ch, n.reg || 0) + by;
  return noteOfStep(s);
}
// เลื่อนทั้งวรรค (cells แบบ {r,l,x}) — ใช้กับกระดานโน้ต
export function shiftCells(cells, by, hands = ['r', 'l', 'x']) {
  return cells.map(c => {
    const o = {};
    hands.forEach(h => { o[h] = (c[h] || []).map(n => shiftNote(n, by)); });
    return o;
  });
}

// ช่วงเสียงที่เขียนเป็นข้อความได้มีแค่ 3 (ดฺ ด ดํ) → -7..13
export const WRITABLE_MIN = -7, WRITABLE_MAX = 13;
export const fitsWritable = steps => steps.every(s => s >= WRITABLE_MIN && s <= WRITABLE_MAX);

// เลือกทิศหมุนให้ทำนองอยู่ใกล้ช่วงเดิมที่สุด (หมุนขึ้น k = หมุนลง k-7 เสียงเดียวกัน)
//   คืนจำนวนขั้นที่ควรใช้จริง
export function bestShift(steps, by) {
  const cands = [by, by - 7, by + 7, by - 14, by + 14];
  const mid = steps.length ? (Math.min(...steps) + Math.max(...steps)) / 2 : 0;
  let best = by, score = Infinity;
  for (const c of cands) {
    const moved = steps.map(s => s + c);
    const out = moved.filter(s => s < WRITABLE_MIN || s > WRITABLE_MAX).length;
    // เกินช่วงที่เขียนได้ = แย่ที่สุด · รองลงมาเลือกตัวที่ทำนองขยับน้อยที่สุด
    const drift = Math.abs((Math.min(...moved) + Math.max(...moved)) / 2 - mid);
    const sc = out * 1000 + drift;
    if (sc < score) { score = sc; best = c; }
  }
  return best;
}

/* ───────── หาทางจากโน้ต ───────── */

// เซตเสียงที่ใช้ (0–6, ไม่สนช่วงเสียง) → ทางที่เป็นไปได้ พร้อมคะแนน
//   คืน [{no, ens, name, missing, extra, score}] เรียงจากตรงที่สุด
export function guessTang(steps, { ens = null } = {}) {
  const used = new Set(steps.map(s => ((s % 7) + 7) % 7));
  const count = {};
  steps.forEach(s => { const p = ((s % 7) + 7) % 7; count[p] = (count[p] || 0) + 1; });
  const total = steps.length || 1;
  const out = [];
  const envs = ens ? [ens] : Object.keys(ENSEMBLES);
  for (const e of envs) {
    for (const t of TANGS) {
      const sc = new Set(PENTA.map(d => (tonicOf(t.no, e) + d) % 7));
      let inside = 0;
      for (const [p, c] of Object.entries(count)) if (sc.has(+p)) inside += c;
      const extra = [...used].filter(p => !sc.has(p));
      const missing = [...sc].filter(p => !used.has(p));
      out.push({ no: t.no, ens: e, name: t.name,
        cover: inside / total, extra: extra.map(p => NOTES_TH[p]), missing: missing.map(p => NOTES_TH[p]),
        score: inside / total - extra.length * 0.15 - missing.length * 0.03 });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ───────── รูปทำนองที่ไม่ขึ้นกับทาง ───────── */
//   ทำนองสองอันที่เป็น "ทำนองเดียวกันคนละทาง" ต้องได้กุญแจเดียวกัน
//   ใช้ผลต่างขั้นเสียงเทียบตัวแรก — ย้ายทางเท่าไหร่ก็ไม่เปลี่ยน
export function shapeKey(steps) {
  if (!steps || !steps.length) return '';
  const a = steps[0];
  return steps.map(s => s - a).join(',');
}
// กุญแจที่รวมจังหวะด้วย (ช่องว่างสำคัญ) — steps เป็น array ที่ช่องว่างเป็น null
export function shapeKeyWithRhythm(cells) {
  const snd = cells.filter(s => s != null);
  if (!snd.length) return cells.map(() => '-').join('');
  const a = snd[0];
  return cells.map(s => (s == null ? '-' : String(s - a))).join(',');
}

// หน้าทับกลอง + ฉิ่ง — เสียงจริงจากคลังตัวอย่าง ถ้ายังไม่มีไฟล์ใช้เสียงสังเคราะห์แทน
// pattern มาจากตาราง nathab_patterns = "คลังหน้าทับกลาง" (2026-08-25)
//   เขียน/แก้ได้ที่หน้า /nathab (แอดมินบันทึกตรง · สมาชิกระดับขุนขึ้นไปส่งรออนุมัติ)
//   เพลงผูกกับหน้าทับผ่านตาราง song_nathab (หน้าทับหลัก + ข้อยกเว้นต่อท่อน)
import { playFromBank, loadBank } from './samplebank';
import { supabase } from './supabase';

export { loadBank as loadDrumBank };

// ── ค่าคงที่ของคลังหน้าทับ ──
export const LEVELS = ['สามชั้น', 'สองชั้น', 'ชั้นเดียว', 'ทุกอัตรา'];   // ทุกอัตรา = หน้าทับที่ไม่ผูกอัตรา (หน้าพาทย์ ฯลฯ)
export const DRUMS = ['ตะโพน', 'กลองแขก', 'กลองสองหน้า', 'โทนรำมะนา', 'กลองทัด'];
// พยางค์ที่ใช้เขียนโน้ตของแต่ละเครื่อง (พิมพ์พยางค์อื่นเพิ่มเองได้ ระบบเล่นด้วยเสียงสังเคราะห์ตามประเภท)
export const SYLLABLES = {
  'ตะโพน':       ['เท่ง', 'ติง', 'ตุ๊บ', 'พรึม', 'พลึง', 'เพลิ่ง', 'ถะ', 'ป๊ะ'],
  'กลองสองหน้า': ['เท่ง', 'ติง', 'ตุ๊บ', 'พรึม', 'พลึง', 'เพลิ่ง', 'ถะ', 'ป๊ะ'],
  'กลองแขก':     ['โจ๊ะ', 'จ๊ะ', 'ติง', 'ทั่ง', 'ทั่ม'],
  'โทนรำมะนา':   ['โจ๊ะ', 'จ๊ะ', 'ติง', 'ทั่ง', 'ทั่ม'],
  'กลองทัด':     ['ตูม', 'ต้อม'],
};
// เครื่องที่ใช้พยางค์ชุดเดียวกัน — โน้ตที่เขียนให้เครื่องหนึ่ง เล่นด้วยเสียงอีกเครื่องได้
export const DRUM_FAMILY = {
  'ตะโพน': ['ตะโพน', 'กลองสองหน้า'], 'กลองสองหน้า': ['กลองสองหน้า', 'ตะโพน'],
  'กลองแขก': ['กลองแขก', 'โทนรำมะนา'], 'โทนรำมะนา': ['โทนรำมะนา', 'กลองแขก'],
  'กลองทัด': ['กลองทัด'],
};
// จำนวนห้องเริ่มต้นของหน้าทับใหม่ตามอัตรา
export const DEFAULT_HONGS = { 'สามชั้น': 8, 'สองชั้น': 4, 'ชั้นเดียว': 2, 'ทุกอัตรา': 4 };

// cells (array พยางค์/'-' ยาว hongs×4) ⇄ pattern_text ("- - - เท่ง | - - - พรึม")
export function cellsToText(cells) {
  const out = [];
  for (let i = 0; i < cells.length; i += 4) out.push(cells.slice(i, i + 4).map(c => c || '-').join(' '));
  return out.join(' | ');
}
export function textToCells(text) {
  const cells = [];
  for (const hong of (text || '').split('|')) {
    const toks = hong.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    while (toks.length < 4) toks.push('-');
    cells.push(...toks.slice(0, 4).map(t => t === '-' ? '' : t));
  }
  return cells;
}

// ── คลังหน้าทับ (อ่านครั้งเดียวต่อหน้า) ──
let _lib = null, _libAt = 0;
export async function loadNathabLibrary({ force = false } = {}) {
  if (_lib && !force && Date.now() - _libAt < 5 * 60 * 1000) return _lib;
  const { data } = await supabase.from('nathab_patterns').select('*').order('nathab').order('level').order('instrument');
  _lib = data ?? []; _libAt = Date.now();
  return _lib;
}
export function invalidateNathabLibrary() { _lib = null; }
export const approvedRows = rows => (rows ?? []).filter(r => (r.status ?? 'approved') === 'approved');
// ชื่อหน้าทับทั้งหมดในคลัง (เรียงตามชื่อ)
export function nathabNames(rows) {
  return [...new Set(approvedRows(rows).map(r => r.nathab))].sort((a, b) => a.localeCompare(b, 'th'));
}

// หาแถวโน้ตที่ตรงที่สุด: อัตราตรง → 'ทุกอัตรา' → เครื่องตระกูลเดียวกัน → อัตราใดก็ได้ของชื่อนั้น
export function findPattern(rows, nathab, level, instrument) {
  const ok = approvedRows(rows).filter(r => r.nathab === nathab);
  if (!ok.length) return null;
  const fam = DRUM_FAMILY[instrument] ?? [instrument];
  for (const inst of fam) {
    const exact = ok.find(r => r.instrument === inst && r.level === level);
    if (exact) return exact;
    const any = ok.find(r => r.instrument === inst && r.level === 'ทุกอัตรา');
    if (any) return any;
  }
  for (const inst of fam) { const r = ok.find(x => x.instrument === inst); if (r) return r; }
  return ok[0];
}

// ── ผูกหน้าทับกับเพลง ──
// rules = แถวจาก song_nathab ของเพลงนั้น (section null = หน้าทับหลัก)
// verses = แถว song_melody เรียงตาม verse_no · คืน array ต่อวรรค {nathab, level, drum} หรือ null
export async function loadSongNathab(songId) {
  const { data } = await supabase.from('song_nathab').select('*').eq('song_id', songId).order('id');
  return data ?? [];
}
export function planSongNathab(verses, rules, { level: fallbackLevel = 'สองชั้น' } = {}) {
  const main = (rules ?? []).find(r => !r.section) ?? null;
  const bySec = {};
  (rules ?? []).forEach(r => { if (r.section) bySec[r.section.trim()] = r; });
  return (verses ?? []).map(v => {
    const sec = (v.section ?? '').trim();
    const r = bySec[sec] ?? main;
    if (!r) return null;
    return { nathab: r.nathab, level: r.level || v.level || fallbackLevel, drum: r.drum || null, section: sec };
  });
}

// ฉิ่ง: ตำแหน่งตายตัวตามอัตราชั้น (1 ห้อง = 4 ตำแหน่ง)
export const CHING_PATTERNS = {
  'สามชั้น':  { hongs: 8, hits: { 16: 'ฉิ่ง', 32: 'ฉับ' } },
  'สองชั้น':  { hongs: 4, hits: { 8: 'ฉิ่ง', 16: 'ฉับ' } },
  'ชั้นเดียว': { hongs: 1, hits: { 2: 'ฉิ่ง', 4: 'ฉับ' } },   // ฉิ่งขีดที่ 2 ฉับขีดที่ 4 (Pk เคาะ 2026-08-24)
};

// ประเภทเสียงต่อพยางค์กลอง
const STROKE_TYPE = {
  'ติง':'mid', 'ทิง':'mid', 'เท่ง':'mid',
  'ตุ๊บ':'low', 'พลึง':'low', 'พรึม':'low', 'เพลิ่ง':'low', 'ทั่ง':'low', 'ทั่ม':'low', 'จ๊ะทั่ม':'low',
  'ถะ':'slap', 'ป๊ะ':'slap', 'จ๊ะ':'slap', 'โจ๊ะ':'slap', 'ฉะ':'slap',
  'ตูม':'boom', 'ต้อม':'boom',                     // กลองทัด เสียงใหญ่ ทุ้มลึก
  'ฉิ่ง':'ching', 'ฉับ':'chap',
};

// แปลง pattern text "- - - เท่ง | ..." → array ของ {pos(1-based), syll}
export function parsePattern(text) {
  const hits = [];
  let pos = 0;
  for (const hong of (text || '').split('|')) {
    const tokens = hong.trim().split(/\s+/).filter(t => t.length > 0);
    for (const t of tokens) {
      pos++;
      if (t !== '-') hits.push({ pos, syll: t });
    }
  }
  return { hits, len: pos };
}

// instrument = ชื่อเครื่องไทย เช่น 'ตะโพน' · ถ้ามีไฟล์เสียงจริงในคลังจะใช้ไฟล์ก่อนเสมอ
export function playPercussion(ctx, syll, time, gain = 0.8, instrument = null) {
  // ฉิ่ง/ฉับ อยู่คนละเครื่องกับกลอง จึงหาในโฟลเดอร์ ching เสมอ
  const from = (syll === 'ฉิ่ง' || syll === 'ฉับ') ? 'ฉิ่ง' : instrument;
  if (from && playFromBank(ctx, from, syll, time, gain)) return true;   // ใช้เสียงจริงแล้ว
  const type = STROKE_TYPE[syll] || 'mid';
  if (type === 'boom') membrane(ctx, 62, 34, 0.85, time, gain);
  else if (type === 'low') membrane(ctx, 85, 50, 0.35, time, gain);
  else if (type === 'mid') membrane(ctx, 190, 120, 0.22, time, gain * 0.9);
  else if (type === 'slap') slap(ctx, time, gain * 0.7);
  else if (type === 'ching') ching(ctx, time, gain * 0.5, 1.1);
  else if (type === 'chap') ching(ctx, time, gain * 0.5, 0.09);
  return false;                                                        // ใช้เสียงสังเคราะห์
}

function membrane(ctx, f1, f2, dur, time, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f1, time);
  osc.frequency.exponentialRampToValueAtTime(f2, time + dur * 0.7);
  osc.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.start(time); osc.stop(time + dur + 0.05);
}

function slap(ctx, time, gain) {
  const len = 0.09;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(time);
}

function ching(ctx, time, gain, dur) {
  [2900, 4350, 6100].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    osc.connect(g); g.connect(ctx.destination);
    const amp = gain * [1, 0.5, 0.25][i];
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(amp, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.start(time); osc.stop(time + dur + 0.05);
  });
}

// หน้าทับกลอง + ฉิ่ง — เสียงจริงจากคลังตัวอย่าง ถ้ายังไม่มีไฟล์ใช้เสียงสังเคราะห์แทน
// pattern มาจากตาราง nathab_patterns = "คลังหน้าทับกลาง" (2026-08-25)
//   เขียน/แก้ได้ที่หน้า /nathab (แอดมินบันทึกตรง · สมาชิกระดับขุนขึ้นไปส่งรออนุมัติ)
//   เพลงผูกกับหน้าทับผ่านตาราง song_nathab (หน้าทับหลัก + ข้อยกเว้นต่อท่อน)
import { playFromBank, loadBank } from './samplebank';
import { supabase } from './supabase';

export { loadBank as loadDrumBank };

// ── ค่าคงที่ของคลังหน้าทับ ──
export const LEVELS = ['สามชั้น', 'สองชั้น', 'ชั้นเดียว', 'ทุกอัตรา'];   // ทุกอัตรา = หน้าทับที่ไม่ผูกอัตรา (หน้าพาทย์ ฯลฯ)
// ── ชุดเครื่องกำกับจังหวะ (Pk เคาะ 2026-08-25): หนึ่ง "ชุด" = หลายบรรทัด (voice) ตีพร้อมกันได้ ──
//   ตะโพน มากับกลองทัดเสมอ (2 บรรทัด แม้กลองทัดจะเงียบทั้งเพลง)
//   กลองแขก = ตัวผู้/ตัวเมีย 2 บรรทัด · โทนรำมะนา = โทน/รำมะนา 2 บรรทัด
//   เพิ่มชุดใหม่ (เครื่องอื่น) = เพิ่มรายการตรงนี้: label · voices[{label, banks (โฟลเดอร์เสียงที่ลองตามลำดับ), syll (แป้นพยางค์)}]
//   pattern_text ของชุดหลายบรรทัด = หลายบรรทัดคั่นด้วย \n (บรรทัดละ voice) — ชุดเก่าบรรทัดเดียวยังอ่านได้ (บรรทัดที่ขาดถือว่าว่าง)
const TAPHON = ['เท่ง', 'ติง', 'ตุ๊บ', 'พรึม', 'พลึง', 'เพลิ่ง', 'ถะ', 'ป๊ะ'];
const KHAEK  = ['โจ๊ะ', 'จ๊ะ', 'ติง', 'ทั่ง', 'ทั่ม'];
const THAT   = ['ตูม', 'ต้อม'];
export const DRUM_SETS = {
  'ตะโพน':       { label: 'ตะโพน + กลองทัด', voices: [
                     { label: 'ตะโพน',   banks: ['ตะโพน'],   syll: TAPHON },
                     { label: 'กลองทัด', banks: ['กลองทัด'], syll: THAT } ] },
  'กลองสองหน้า': { label: 'กลองสองหน้า', voices: [
                     { label: 'กลองสองหน้า', banks: ['กลองสองหน้า', 'ตะโพน'], syll: TAPHON } ] },
  'กลองแขก':     { label: 'กลองแขก (ตัวผู้ + ตัวเมีย)', voices: [
                     { label: 'ตัวผู้',  banks: ['กลองแขกตัวผู้', 'กลองแขก'],  syll: KHAEK },
                     { label: 'ตัวเมีย', banks: ['กลองแขกตัวเมีย', 'กลองแขก'], syll: KHAEK } ] },
  'โทนรำมะนา':   { label: 'โทน + รำมะนา', voices: [
                     { label: 'โทน',    banks: ['โทน', 'โทนรำมะนา'],    syll: KHAEK },
                     { label: 'รำมะนา', banks: ['รำมะนา', 'โทนรำมะนา'], syll: KHAEK } ] },
  // ชุดเก่า (แถวในฐานที่เขียนไว้ก่อน) — ไม่ขึ้นในรายการให้เลือกใหม่ แต่ยังเล่นได้
  'กลองทัด':     { label: 'กลองทัด (เดี่ยว — ชุดเก่า)', legacy: true, voices: [ { label: 'กลองทัด', banks: ['กลองทัด'], syll: THAT } ] },
};
export const DRUMS = Object.keys(DRUM_SETS).filter(k => !DRUM_SETS[k].legacy);
export const drumLabel = inst => DRUM_SETS[inst]?.label ?? inst;
// ชุดของเครื่องที่ไม่รู้จัก (เผื่อคลังเครื่องอื่นในอนาคต) = บรรทัดเดียว โฟลเดอร์เสียงชื่อเดียวกัน
export const setOf = inst => DRUM_SETS[inst] ?? { label: inst, voices: [{ label: inst, banks: [inst], syll: TAPHON }] };
// พยางค์ (คงไว้ให้โค้ดเก่า) = ของ voice แรก
export const SYLLABLES = Object.fromEntries(Object.keys(DRUM_SETS).map(k => [k, DRUM_SETS[k].voices[0].syll]));
// เครื่องที่ใช้พยางค์ชุดเดียวกัน — โน้ตที่เขียนให้เครื่องหนึ่ง เล่นด้วยเสียงอีกเครื่องได้
export const DRUM_FAMILY = {
  'ตะโพน': ['ตะโพน', 'กลองสองหน้า'], 'กลองสองหน้า': ['กลองสองหน้า', 'ตะโพน'],
  'กลองแขก': ['กลองแขก', 'โทนรำมะนา'], 'โทนรำมะนา': ['โทนรำมะนา', 'กลองแขก'],
  'กลองทัด': ['กลองทัด'],
};
// จำนวนห้องเริ่มต้นของหน้าทับใหม่ตามอัตรา
export const DEFAULT_HONGS = { 'สามชั้น': 8, 'สองชั้น': 4, 'ชั้นเดียว': 2, 'ทุกอัตรา': 4 };

// cells (array พยางค์/'-' ยาว hongs×4) ⇄ pattern_text ("- - - เท่ง | - - - พรึม")
// หลาย voice: voicesToText([cells0, cells1]) ⇄ textToVoices(text, n) — บรรทัดละ voice
export function voicesToText(voices) { return voices.map(cellsToText).join('\n'); }
export function textToVoices(text, n) {
  const lines = String(text || '').split(/\r?\n/).map(textToCells);
  while (lines.length < n) lines.push([]);
  const len = Math.max(...lines.map(l => l.length), 0);
  return lines.slice(0, Math.max(n, 1)).map(l => { const c = l.slice(); while (c.length < len) c.push(''); return c; });
}
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
  if (_lib && !force && Date.now() - _libAt < 60 * 1000) return _lib;   // แคช 1 นาที (หน้าทับใหม่ที่เพิ่งบันทึกโผล่ในเครื่องเล่นเร็ว)
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
// กฎรายท่อน (section ≠ null) มี 2 แบบ (คอลัมน์ scope)
//   'only' = เฉพาะท่อนที่ชื่อตรง                        เพลงเถา: ลูกหมด → หน้าทับลูกหมด
//   'from' = ตั้งแต่ท่อนนั้นไปจนกว่าจะเจอกฎ 'from' ถัดไป  เพลงเรื่อง: สองไม้ → เพลงเร็ว → ลา
// เทียบชื่อท่อน: ตรงทั้งชื่อก่อน · ไม่ตรงจึงเทียบ "ขึ้นต้นด้วย" (กฎ 'เพลงเร็ว' ครอบ 'เพลงเร็ว ท่อน 2')
export function matchSection(ruleSec, sec) {
  const a = (ruleSec ?? '').trim(), b = (sec ?? '').trim();
  if (!a || !b) return 0;
  if (a === b) return 2;
  if (b.startsWith(a)) return 1;
  return 0;
}
function pickRule(list, sec) {
  let best = null, score = 0;
  for (const r of list) { const s = matchSection(r.section, sec); if (s > score) { best = r; score = s; } }
  return { rule: best, score };
}
export function planSongNathab(verses, rules, { level: fallbackLevel = 'สองชั้น' } = {}) {
  const all = rules ?? [];
  const main = all.find(r => !r.section) ?? null;
  const only = all.filter(r => r.section && r.scope !== 'from');
  const from = all.filter(r => r.section && r.scope === 'from');
  let running = null, lastSec = null, pick = null;
  return (verses ?? []).map(v => {
    const sec = (v.section ?? '').trim();
    if (sec !== lastSec) {                       // ต้นท่อนใหม่ → เลือกกฎของท่อนนี้ครั้งเดียว
      lastSec = sec;
      const f = pickRule(from, sec), o = pickRule(only, sec);
      if (f.rule) running = f.rule;              // กฎ from ที่ตรงท่อนนี้ → เริ่มกระแสใหม่
      // only ชนะเมื่อชื่อตรงไม่น้อยกว่ากฎ from ของท่อนเดียวกัน (ตรงทั้งชื่อ > ขึ้นต้นด้วย)
      pick = (o.rule && o.score >= f.score) ? o.rule : (running ?? main);
    }
    const r = pick;
    if (!r) return null;
    return { nathab: r.nathab, level: r.level || v.level || fallbackLevel, drum: r.drum || null, section: sec };
  });
}

// เดากฎจากชื่อท่อน (ปุ่ม ✨ ในแผงหน้าทับ) — คืน [{section, nathab, scope}] เฉพาะที่คลังมีหน้าทับชื่อนั้น
//   ท่อนที่ชื่อมีคำ ลูกหมด/สองไม้/เพลงเร็ว(เร็ว)/ลา/เชิด/เพลงช้า → หน้าทับชื่อเดียวกัน
//   ลูกหมด = เฉพาะท่อน (only) · ที่เหลือ = ตั้งแต่ท่อนนั้นไป (from) · ท่อนแรกของเพลงไม่ตั้งกฎ (ใช้หน้าทับหลัก)
const GUESS = [
  { re: /ลูกหมด/,           nathab: 'ลูกหมด',  scope: 'only' },
  { re: /สองไม้/,           nathab: 'สองไม้',  scope: 'from' },
  { re: /เพลงเร็ว|(^|\s)เร็ว/, nathab: 'เพลงเร็ว', scope: 'from' },
  { re: /เพลงช้า|(^|\s)ช้า($|\s)/, nathab: 'ปรบไก่', scope: 'from' },
  { re: /(^|\s)ลา($|\s)/,   nathab: 'ลา',      scope: 'from' },
  { re: /เชิด/,              nathab: 'เชิด',    scope: 'from' },
];
export function guessSongNathab(sections, names, { main = null } = {}) {
  const out = [];
  const have = new Set(names ?? []);
  let cur = main || null;                       // หน้าทับที่กำลังเดินอยู่ (หลัก หรือกฎ from ล่าสุด)
  (sections ?? []).forEach((sec, i) => {
    const s = (sec ?? '').trim();
    if (!s) return;
    const g = GUESS.find(x => x.re.test(s));
    if (!g || !have.has(g.nathab)) return;
    if (g.scope === 'from') {
      if (i === 0 && !cur) { cur = g.nathab; return; }   // ท่อนแรก = หน้าทับหลักอยู่แล้ว
      if (g.nathab === cur) return;                       // ยังเป็นหน้าทับเดิม ไม่ต้องตั้งซ้ำ
      cur = g.nathab;
    }
    if (out.some(o => o.section === s)) return;
    out.push({ section: s, nathab: g.nathab, scope: g.scope });
  });
  return out;
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

// แปลง pattern text → {hits: [{pos(1-based), syll, voice}], len, voices: [{hits, len}]}
// หลายบรรทัด = หลาย voice (บรรทัดที่ 1 = voice 0) · len = ยาวสุดในทุกบรรทัด
export function parsePattern(text) {
  const voices = String(text || '').split(/\r?\n/).map((line, vi) => {
    const hits = []; let pos = 0;
    for (const hong of line.split('|')) {
      const tokens = hong.trim().split(/\s+/).filter(t => t.length > 0);
      for (const t of tokens) { pos++; if (t !== '-') hits.push({ pos, syll: t, voice: vi }); }
    }
    return { hits, len: pos };
  }).filter((v, i) => i === 0 || v.len > 0);
  const len = Math.max(...voices.map(v => v.len), 0);
  return { hits: voices.flatMap(v => v.hits), len, voices };
}
// โฟลเดอร์เสียงของ voice ในชุดเครื่อง (ลองตามลำดับ ไม่มีไฟล์ตกไปตัวถัดไป สุดท้ายสังเคราะห์)
export function banksFor(instrument, voice = 0) {
  const v = setOf(instrument).voices; return (v[voice] ?? v[0]).banks;
}
// โหลดเสียงทุก voice ของชุด (+ฉิ่งถ้าต้องการ)
export async function loadSetBanks(ctx, instrument, { ching = false } = {}) {
  const all = new Set(setOf(instrument).voices.flatMap(v => v.banks));
  if (ching) all.add('ฉิ่ง');
  await Promise.all([...all].map(b => loadBank(ctx, b).catch(() => null)));
}
// เล่นหนึ่ง hit จาก parsePattern ด้วยเสียงของ voice นั้น
export function playHit(ctx, instrument, hit, time, gain = 0.75) {
  return playPercussion(ctx, hit.syll, time, gain, banksFor(instrument, hit.voice ?? 0));
}

// instrument = ชื่อเครื่องไทย เช่น 'ตะโพน' หรือ array ของโฟลเดอร์ที่จะลองตามลำดับ · มีไฟล์เสียงจริงใช้ไฟล์ก่อนเสมอ
export function playPercussion(ctx, syll, time, gain = 0.8, instrument = null) {
  // ฉิ่ง/ฉับ อยู่คนละเครื่องกับกลอง จึงหาในโฟลเดอร์ ching เสมอ
  const list = (syll === 'ฉิ่ง' || syll === 'ฉับ') ? ['ฉิ่ง'] : (Array.isArray(instrument) ? instrument : instrument ? banksFor(instrument, 0) : []);
  for (const from of list) if (from && playFromBank(ctx, from, syll, time, gain)) return true;   // ใช้เสียงจริงแล้ว
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

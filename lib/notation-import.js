// lib/notation-import.js — นำเข้า/แปลงโน้ตข้ามระบบ (2026-08-25)
//   ไทย (อักษรไทย ดรมฟซลท + ํ/ฺ) · TH Notation (รหัสแป้น qwertyu/asdfghj/zxcvbnm) · โน้ตสากล (MusicXML · MIDI · ตารางตัวอักษร C4 D4 …)
//   ทุกแบบ → verses (โมเดลกระดาน: {sec, cells:[{r:[{ch,reg}], l:[]}]}) → ทุกแบบ
//   ไม่แตะ DOM ยกเว้น DOMParser (MusicXML) — ใช้ได้ทั้งเบราว์เซอร์และ node (ส่ง parser เข้ามาได้)
//
//   หลักเทียบเสียง (Pk เคาะ 2026-08-25): ด = C เป็นค่าเริ่มต้น เปลี่ยนได้ (tonic) · 1 ตำแหน่ง = เขบ็ตหนึ่งชั้น · 1 ห้อง = 2/4
//   จังหวะตก: โน้ตไทยตกท้ายห้อง · โน้ตสากลตกต้นห้อง → beat:'western' เลื่อน 3 ตำแหน่ง (ตัวแรกของเพลงลงตำแหน่ง 4)
import { NOTES, HIGH, LOW, KEYMAP, KEY_OF, unitNotes, mkVerse, splitLine, hongOf, hasSound, textToVerses } from './notation-core';

/* ───────── รู้จักรูปแบบข้อความ ───────── */
export const TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'E#': 5, 'B#': 0, Fb: 4 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];                 // ด ร ม ฟ ซ ล ท
const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// 'thai' = อักษรไทย · 'thn' = รหัสแป้น TH Notation · 'western' = ตารางตัวอักษรสากล · 'unknown'
export function detectFormat(text) {
  const s = String(text || '');
  const thai = (s.match(/[ดรมฟซลท]/g) || []).length;
  const west = (s.match(/\b[A-Ga-g][#b♯♭]?\d\b/g) || []).length;
  const keys = (s.match(/(^|[\s|\-–])[qwertyuasdfghjzxcvbnm]{1,2}(?=[\s|\-–]|$)/g) || []).length;
  if (west >= 1 && thai === 0 && west >= keys) return 'western';
  if (west >= 3 && west >= thai) return 'western';
  if (thai >= 1) return 'thai';
  if (keys >= 1) return 'thn';
  return 'unknown';
}

/* ───────── ข้อความ (ไทย / TH Notation) → verses ─────────
   textToVerses ของ core อ่านทั้งตัวไทยและรหัสแป้นได้อยู่แล้ว — ตรงนี้แค่ทำความสะอาดก่อน  */
export function cleanNotationText(text) {
  return String(text || '')
    .replace(/[–—−]/g, '-')                 // ขีดชนิดอื่น → -
    .replace(/[ุ]/g, LOW)                   // สระอุแทนพินทุ (ไฟล์เก่า)
    .replace(/ํ/g, HIGH)               // นิคหิต
    .replace(/[│┃|]/g, '|')                 // เส้นตั้ง unicode
    .replace(/\r/g, '')
    .split('\n').filter(l => !l.trim().startsWith('%'))
    .map(chunkLine).join('\n');   // บรรทัด % = หมายเหตุ/meta จาก AI ข้าม
}
// บรรทัดที่ไม่มีเส้นห้อง (PDF/ตารางที่เส้นไม่ใช่ข้อความ) แต่มีหน่วยเกิน 4 และหาร 4 ลงตัว → ตัดทุก 4 หน่วยเป็นห้อง
function chunkLine(line) {
  if (line.includes('|') || /^\s*#/.test(line)) return line;
  const toks = line.trim().split(/\s+/).filter(Boolean);
  if (toks.length <= 4 || toks.length % 4 !== 0) return line;
  if (!toks.every(t => /^[-ดรมฟซลทqwertyuasdfghjzxcvbnmํฺ]+$/.test(t))) return line;
  const out = []; for (let i = 0; i < toks.length; i += 4) out.push(toks.slice(i, i + 4).join(' '));
  return out.join(' | ');
}
export function textToVersesAny(text, opts = {}) {
  return textToVerses(cleanNotationText(text), opts);
}

/* ───────── PDF: ชิ้นข้อความพร้อมพิกัด → บรรทัดข้อความ ─────────
   items = [{str, x, y, w, h, font}] (จาก pdf.js textContent.items: transform[4], transform[5])
   จัดกลุ่มตาม y (บรรทัด) เรียงตาม x · ช่องว่างกว้างผิดปกติ = เว้นวรรค · ถ้าไม่มี '|' และหน่วยหารด้วย 4 ลงตัวก็ปล่อยให้ lineToHongs แบ่งเอง */
export function pdfItemsToLines(items, { yTol = 3 } = {}) {
  const its = (items || []).filter(i => i.str != null && i.str !== '').map(i => ({ ...i, x: +i.x || 0, y: +i.y || 0 }));
  its.sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  for (const it of its) {
    const L = lines[lines.length - 1];
    if (L && Math.abs(L.y - it.y) <= yTol) L.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map(L => {
    L.items.sort((a, b) => a.x - b.x);
    const solid = L.items.filter(i => i.str.trim());
    const avgH = solid.length ? solid.reduce((s, i) => s + (i.h || 10), 0) / solid.length : 10;
    // ชิ้นข้อความ → ลำดับ {gap, str}: gap = ช่องไฟก่อนชิ้นนี้ (จากพิกัด หรือจากชิ้นช่องว่างของ pdf.js ที่มี width)
    const seq = []; let lastEnd = null, pendingSpace = 0;
    for (const it of L.items) {
      if (!it.str.trim()) { pendingSpace = Math.max(pendingSpace, it.w || avgH * 0.3); lastEnd = it.x + (it.w || 0); continue; }
      const gap = lastEnd === null ? 0 : Math.max(pendingSpace, it.x - lastEnd);
      seq.push({ gap, str: it.str });
      lastEnd = it.x + (it.w || it.str.length * avgH * 0.5); pendingSpace = 0;
    }
    const hasBar = seq.some(t => t.str.includes('|'));
    const big = avgH * 1.1;   // ช่องไฟกว้างกว่าความสูงตัวอักษร = ขอบช่องตาราง (ไม่มีเส้น '|' เป็นข้อความ) → ใส่ '|' ให้
    let out = '';
    seq.forEach((t, i) => {
      if (i > 0) out += (!hasBar && t.gap > big) ? ' | ' : (t.gap > avgH * 0.15 ? ' ' : '');
      out += t.str;
    });
    return out.trim();
  }).filter(Boolean);
}

/* ───────── ตารางตัวอักษรสากล (C4 D4 - E4 | …) ⇄ events ─────────
   1 token = 1 ตำแหน่ง (เขบ็ตหนึ่งชั้น) · '-' = ลากยาว/พัก · 'r' หรือ 'z' = พัก · โน้ตสองตัวติดกัน "C4D4" = คู่สะบัด · "C4+E4" = พร้อมกัน */
export function noteNameToMidi(name) {
  const m = String(name).trim().match(/^([A-Ga-g])([#♯]|[b♭])?(-?\d)$/);
  if (!m) return null;
  const pc = PC[m[1].toUpperCase() + (m[2] ? (m[2] === '#' || m[2] === '♯' ? '#' : 'b') : '')];
  return (parseInt(m[3]) + 1) * 12 + pc;
}
export function midiToNoteName(midi, { flat = false } = {}) {
  const n = (flat ? NAMES_FLAT : NAMES_SHARP)[((midi % 12) + 12) % 12];
  return n + (Math.floor(midi / 12) - 1);
}
export function westernGridToEvents(text) {
  // คืน [{pos, notes:[midi…], sabat:bool}] — pos = ดัชนีตำแหน่งจากต้น (ตามลำดับที่อ่าน)
  const ev = []; let pos = 0;
  String(text || '').split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('%')) return;
    line.split('|').forEach(chunk => {
      chunk.trim().split(/\s+/).filter(Boolean).forEach(tok => {
        if (/^[-–—.]$/.test(tok) || /^[rz]$/i.test(tok)) { pos++; return; }
        const parts = tok.split('+');
        const chord = parts.map(noteNameToMidi).filter(x => x != null);
        if (chord.length) { ev.push({ pos, notes: chord }); pos++; return; }
        const pair = tok.match(/^([A-Ga-g][#b♯♭]?\d)([A-Ga-g][#b♯♭]?\d)$/);
        if (pair) { ev.push({ pos, notes: [noteNameToMidi(pair[1])], sabat: noteNameToMidi(pair[2]) }); pos++; return; }
        pos++;   // token แปลก ๆ ข้าม
      });
    });
  });
  return { events: ev, length: pos };
}

/* ───────── MIDI number → โน้ตไทย {ch, reg, approx} ─────────
   tonic = ชื่อเสียงของ ด (C…B) · ด กลาง (reg 0) = tonic ในช่วง octave 4 (C4 = 60) · โน้ตนอกบันได → ใกล้สุด (ต่ำก่อน) ติดธง approx */
export function midiToThai(midi, tonic = 'C') {
  const t = 60 + (PC[tonic] ?? 0);
  const d = midi - t;
  let reg = Math.floor(d / 12), pc = ((d % 12) + 12) % 12;
  let best = 0, bestDist = 99;
  MAJOR.forEach((s, i) => { const dist = Math.abs(s - pc); if (dist < bestDist) { bestDist = dist; best = i; } });
  // ท (11) กับ ด ถัดไป (12): ถ้า pc = 11.5… ไม่มี · pc 6 → ฟ (5) ใกล้กว่า ซ (7)? เท่ากัน → ต่ำก่อน (ฟ)
  return { ch: NOTES[best], reg: Math.max(-2, Math.min(2, reg)), approx: bestDist !== 0 };
}
export function thaiToMidi(n, tonic = 'C') {
  return 60 + (PC[tonic] ?? 0) + MAJOR[NOTES.indexOf(n.ch)] + 12 * (n.reg || 0);
}

/* ───────── events (ตำแหน่งเขบ็ต) → verses ─────────
   beat:'thai' = ตำแหน่ง 0 ลงช่องแรก · 'western' = ตำแหน่ง 0 (จังหวะตก) ลงช่องที่ 4 ของห้องแรก (เลื่อน 3)
   hands: 'r' ใส่มือขวาหมด · 'split' = โน้ตต่ำสุดของคอร์ดไปมือซ้าย */
export function eventsToVerses(events, { length, tonic = 'C', beat = 'thai', base = 4, lineHong = 8, sec = 'ท่อน 1', hands = 'split' } = {}) {
  // สากล: จังหวะตก (ต้นห้องสากล) ต้องมาอยู่ท้ายห้องไทย → เลื่อนถอย 1 ตำแหน่ง · ถ้ามีโน้ตก่อนจังหวะตกแรก (pickup) ให้เพิ่มห้องหน้าแทน (เลื่อน +3)
  const shift = beat !== 'western' ? 0 : (events.some(e => e.pos < 1 && e.notes?.length) ? 3 : -1);
  const total = Math.max(length + shift, ...events.map(e => e.pos + shift + 1), 0);
  const nH = Math.max(1, Math.ceil(total / 4));
  const cells = Array.from({ length: nH * 4 }, () => ({ r: [], l: [] }));
  const warn = [];
  for (const e of events) {
    const c = cells[e.pos + shift]; if (!c) continue;   // ตำแหน่งติดลบ (ไม่มีโน้ต) ข้าม
    const notes = [...e.notes].sort((a, b) => a - b).map(m => midiToThai(m, tonic));
    notes.forEach(n => { if (n.approx) warn.push(`ตำแหน่ง ${e.pos + 1}: ${midiToNoteName(e.notes[0])} อยู่นอกบันไดเสียง ด=${tonic} → ปัดเป็น ${n.ch}`); });
    const strip = n => ({ ch: n.ch, reg: n.reg });
    if (notes.length >= 2 && hands === 'split') { c.l = [strip(notes[0])]; c.r = [strip(notes[notes.length - 1])]; }
    else c.r = notes.slice(-2).map(strip);
    if (e.sabat != null) { const s = midiToThai(e.sabat, tonic); c.r = [strip(notes[notes.length - 1] ?? s), strip(s)]; }
  }
  // แบ่งเป็นวรรค/บรรทัด: ทุก lineHong ห้อง = 1 บรรทัด → วรรคขนาด base
  const verses = [];
  let h = 0, first = true;
  while (h < nH) {
    const lineH = Math.min(lineHong, nH - h);
    const sizes = splitLine(lineH, base);
    sizes.forEach((sz, k) => {
      const v = mkVerse(sec, sz, k === 0);
      for (let i = 0; i < sz * 4; i++) v.cells[i] = cells[h * 4 + i] ?? { r: [], l: [] };
      verses.push(v); h += sz;
    });
    first = false;
  }
  return { verses, warnings: [...new Set(warn)].slice(0, 20) };
}

/* ───────── MusicXML → events ─────────
   parser = new DOMParser() (เบราว์เซอร์) หรือส่ง {parseFromString} ของ xmldom เข้ามา · เลือก part ที่มีโน้ตมากสุด (หรือ partIndex)
   หน่วย: divisions ต่อ quarter → 1 ตำแหน่ง = divisions/2 · โน้ตสั้นกว่าเขบ็ตหนึ่งชั้นในตำแหน่งเดียวกัน = คู่สะบัด (16th สองตัว) · ที่เหลือปัดลงกริด */
export function parseMusicXML(xml, { parser, partIndex = null } = {}) {
  const P = parser || (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!P) throw new Error('ไม่มี XML parser');
  const doc = P.parseFromString(xml, 'application/xml');
  const parts = Array.from(doc.getElementsByTagName('part'));
  if (!parts.length) throw new Error('ไม่พบ <part> ใน MusicXML');
  const readPart = part => {
    const events = []; let divisions = 1, t = 0;   // t = ตำแหน่งเป็น "quarter" หน่วย division
    let beatsPerMeasure = 2, beatType = 4, measureLen = null;
    const measures = Array.from(part.getElementsByTagName('measure'));
    let mStart = 0;
    for (const m of measures) {
      const div = m.getElementsByTagName('divisions')[0]; if (div) divisions = parseInt(div.textContent) || divisions;
      const bt = m.getElementsByTagName('beats')[0], btt = m.getElementsByTagName('beat-type')[0];
      if (bt) beatsPerMeasure = parseInt(bt.textContent) || 2;
      if (btt) beatType = parseInt(btt.textContent) || 4;
      measureLen = divisions * beatsPerMeasure * 4 / beatType;
      t = mStart;
      let lastNoteStart = t;
      for (const el of Array.from(m.children)) {
        const tag = el.tagName;
        if (tag === 'backup') { t -= parseInt(el.getElementsByTagName('duration')[0]?.textContent || 0); continue; }
        if (tag === 'forward') { t += parseInt(el.getElementsByTagName('duration')[0]?.textContent || 0); continue; }
        if (tag !== 'note') continue;
        const dur = parseInt(el.getElementsByTagName('duration')[0]?.textContent || 0);
        const isChord = el.getElementsByTagName('chord').length > 0;
        const isRest = el.getElementsByTagName('rest').length > 0;
        const grace = el.getElementsByTagName('grace').length > 0;
        const tieStop = Array.from(el.getElementsByTagName('tie')).some(x => x.getAttribute('type') === 'stop');
        const start = isChord ? lastNoteStart : t;
        if (!isChord) lastNoteStart = t;
        if (!isRest && !tieStop) {
          const p = el.getElementsByTagName('pitch')[0];
          if (p) {
            const step = p.getElementsByTagName('step')[0]?.textContent || 'C';
            const alter = parseInt(p.getElementsByTagName('alter')[0]?.textContent || 0);
            const oct = parseInt(p.getElementsByTagName('octave')[0]?.textContent || 4);
            const midi = (oct + 1) * 12 + PC[step] + alter;
            const pos8 = start / (divisions / 2);           // ตำแหน่งเขบ็ต (ทศนิยมได้)
            events.push({ pos8, midi, dur8: grace ? 0 : dur / (divisions / 2), grace });
          }
        }
        if (!isChord && !grace) t += dur;
      }
      mStart += measureLen;
    }
    return { events, count: events.length, total8: mStart / (divisions / 2) };
  };
  const all = parts.map(readPart);
  const pick = partIndex != null ? all[partIndex] : all.reduce((b, p) => p.count > b.count ? p : b, all[0]);
  return { ...groupEvents(pick.events), length: Math.ceil(pick.total8), parts: all.map(p => p.count) };
}
// รวมโน้ตที่ตำแหน่งเดียวกันเป็นคอร์ด · โน้ตครึ่งตำแหน่ง (16th) รวมเป็นคู่สะบัดกับตัวถัดไป
function groupEvents(list) {
  const byPos = new Map();
  const sorted = [...list].filter(e => !e.grace).sort((a, b) => a.pos8 - b.pos8);
  for (const e of sorted) {
    const p = Math.floor(e.pos8 + 1e-6);
    const frac = e.pos8 - p;
    if (!byPos.has(p)) byPos.set(p, { pos: p, notes: [], sabat: null });
    const g = byPos.get(p);
    if (frac > 0.25) { g.sabat = e.midi; }                    // ครึ่งหลังของตำแหน่ง = ตัวตามสะบัด
    else if (!g.notes.includes(e.midi)) g.notes.push(e.midi);
  }
  const events = [...byPos.values()].map(g => {
    if (g.sabat != null && g.notes.length) return { pos: g.pos, notes: [g.notes[g.notes.length - 1]], sabat: g.sabat };   // ตัวนำ + ตัวตาม
    if (g.sabat != null) return { pos: g.pos, notes: [g.sabat] };
    return { pos: g.pos, notes: g.notes };
  });
  return { events };
}

/* ───────── MIDI (SMF) → events ───────── */
export function parseMidi(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let p = 0;
  const rd32 = () => (u8[p++] << 24 | u8[p++] << 16 | u8[p++] << 8 | u8[p++]) >>> 0;
  const rd16 = () => (u8[p++] << 8 | u8[p++]);
  const str4 = () => String.fromCharCode(u8[p++], u8[p++], u8[p++], u8[p++]);
  if (str4() !== 'MThd') throw new Error('ไม่ใช่ไฟล์ MIDI');
  const hlen = rd32(); const fmt = rd16(); const ntr = rd16(); const div = rd16(); p += hlen - 6;
  if (div & 0x8000) throw new Error('MIDI แบบ SMPTE ยังไม่รองรับ');
  const ppq = div;
  const tracks = [];
  for (let ti = 0; ti < ntr && p < u8.length; ti++) {
    if (str4() !== 'MTrk') break;
    const len = rd32(); const end = p + len;
    let tick = 0, status = 0; const notes = []; const on = new Map(); let bpm = null;
    const vlq = () => { let v = 0, b; do { b = u8[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
    while (p < end) {
      tick += vlq();
      let b = u8[p];
      if (b & 0x80) { status = b; p++; } else if (status === 0) { p++; continue; }
      const type = status & 0xf0;
      if (status === 0xff) { const mt = u8[p++]; const l = vlq(); if (mt === 0x51) { bpm = 60000000 / ((u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2]); } p += l; }
      else if (status === 0xf0 || status === 0xf7) { const l = vlq(); p += l; }
      else if (type === 0x90 || type === 0x80) {
        const n = u8[p++], vel = u8[p++];
        if (type === 0x90 && vel > 0) on.set(n, tick);
        else if (on.has(n)) { notes.push({ midi: n, start: on.get(n), end: tick }); on.delete(n); }
      }
      else if (type === 0xa0 || type === 0xb0 || type === 0xe0) p += 2;
      else if (type === 0xc0 || type === 0xd0) p += 1;
      else p++;
    }
    p = end;
    tracks.push({ notes, bpm });
  }
  const bpm = tracks.find(t => t.bpm)?.bpm ?? null;
  const best = tracks.reduce((b, t) => t.notes.length > (b?.notes.length ?? -1) ? t : b, null);
  const per8 = ppq / 2;
  const list = (best?.notes ?? []).map(n => ({ pos8: n.start / per8, midi: n.midi, dur8: (n.end - n.start) / per8 }));
  const total8 = Math.ceil(Math.max(0, ...(best?.notes ?? []).map(n => n.end / per8)));
  return { ...groupEvents(list), length: total8, bpm, tracks: tracks.map(t => t.notes.length), ppq };
}

/* ───────── verses → โน้ตสากล (events / ตาราง / MusicXML / MIDI) ─────────
   ตำแหน่ง = เขบ็ตหนึ่งชั้น · ช่องว่าง = ลากเสียงก่อนหน้า (ไทย: เสียงดังจนถึงตัวถัดไป) · คู่สะบัดในช่อง = เขบ็ตสองชั้น 2 ตัว · R+L = คอร์ด */
export function versesToFlat(verses) {
  // คืน [{r:[notes], l:[notes]}] ต่อเนื่องทั้งเพลง + ขอบเขตห้อง
  const flat = [];
  (verses || []).forEach(v => { if (hasSound(v) || flat.length) v.cells.forEach(c => flat.push({ r: c.r || [], l: c.l || [] })); });
  return flat;
}
export function versesToWesternGrid(verses, { tonic = 'C', flat = false } = {}) {
  const cells = versesToFlat(verses);
  const lines = [];
  for (let h = 0; h < cells.length; h += 16) {
    const hongs = [];
    for (let b = h; b < Math.min(h + 16, cells.length); b += 4) {
      hongs.push(cells.slice(b, b + 4).map(c => {
        const all = [...(c.l || []), ...(c.r || [])];
        if (!all.length) return '-';
        if (c.r.length === 2) return midiToNoteName(thaiToMidi(c.r[0], tonic), { flat }) + midiToNoteName(thaiToMidi(c.r[1], tonic), { flat });
        return [...new Set(all.map(n => midiToNoteName(thaiToMidi(n, tonic), { flat })))].join('+');
      }).join(' '));
    }
    lines.push(hongs.join(' | '));
  }
  return lines.join('\n');
}
// เหตุการณ์สำหรับเขียนไฟล์: [{start8, dur8, midis[]}] — ช่องว่างต่อความยาวเสียงก่อนหน้า (สูงสุด 4 ตำแหน่ง) · คู่สะบัดแยกครึ่ง
export function versesToNoteEvents(verses, { tonic = 'C', sustain = true } = {}) {
  const cells = versesToFlat(verses);
  const out = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const r = c.r || [], l = c.l || [];
    if (!r.length && !l.length) continue;
    let span = 1;
    if (sustain) while (i + span < cells.length && !(cells[i + span].r || []).length && !(cells[i + span].l || []).length && span < 4) span++;
    if (r.length === 2) {
      out.push({ start8: i, dur8: 0.5, midis: [thaiToMidi(r[0], tonic), ...l.map(n => thaiToMidi(n, tonic))] });
      out.push({ start8: i + 0.5, dur8: span - 0.5, midis: [thaiToMidi(r[1], tonic)] });
    } else {
      out.push({ start8: i, dur8: span, midis: [...new Set([...l, ...r].map(n => thaiToMidi(n, tonic)))] });
    }
  }
  return { events: out, length: cells.length };
}
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function versesToMusicXML(verses, { tonic = 'C', title = 'เพลงไทย', composer = '', bpm = 80, beat = 'western' } = {}) {
  // divisions = 4 ต่อ quarter → เขบ็ต = 2 · 16th = 1 · ห้อง 2/4 = 8
  const DIV = 4, MEAS = 8;
  const { events, length } = versesToNoteEvents(verses, { tonic });
  const shift = beat === 'western' ? 1 : 0;   // ไทยตกท้ายห้อง → ให้ตำแหน่ง 4 ของห้องไทยเป็นจังหวะตกสากล: เลื่อน 1 ตำแหน่ง (เขบ็ต) ไปข้างหน้า
  const total = (length + shift) * 2;
  const nMeas = Math.max(1, Math.ceil(total / MEAS));
  // ตารางเวลา (หน่วย 16th) → ตัวโน้ต/พัก ต่อห้อง โดยไม่ข้ามเส้นห้อง (ผูก tie)
  const timeline = [];   // {at, dur, midis, tie:'start'|'stop'|null}
  events.forEach(e => {
    const at = Math.round((e.start8 + shift) * 2), dur = Math.max(1, Math.round(e.dur8 * 2));
    let a = at, left = dur;
    while (left > 0) {
      const room = MEAS - (a % MEAS);
      const d = Math.min(room, left);
      timeline.push({ at: a, dur: d, midis: e.midis, tieStart: left > d, tieStop: a !== at });
      a += d; left -= d;
    }
  });
  timeline.sort((x, y) => x.at - y.at);
  const durType = d => ({ 1: '16th', 2: 'eighth', 3: 'eighth', 4: 'quarter', 6: 'quarter', 8: 'half' })[d] || 'eighth';
  const dots = d => (d === 3 || d === 6) ? '<dot/>' : '';
  const measures = [];
  for (let m = 0; m < nMeas; m++) {
    const evs = timeline.filter(t => Math.floor(t.at / MEAS) === m);
    let cursor = m * MEAS; let body = '';
    const rest = d => `<note><rest/><duration>${d}</duration><type>${durType(d)}</type>${dots(d)}</note>`;
    const fillRest = upto => { while (cursor < upto) { const room = Math.min(upto - cursor, MEAS - (cursor % MEAS)); const d = [8, 6, 4, 3, 2, 1].find(x => x <= room) ?? 1; body += rest(d); cursor += d; } };
    for (const t of evs) {
      fillRest(t.at);
      if (t.at < cursor) continue;     // ซ้อนทับ (คอร์ดถูกรวมแล้ว) ข้าม
      t.midis.forEach((midi, i) => {
        const name = midiToNoteName(midi), stepM = name.match(/^([A-G])(#?)(-?\d)$/);
        body += `<note>${i ? '<chord/>' : ''}<pitch><step>${stepM[1]}</step>${stepM[2] ? '<alter>1</alter>' : ''}<octave>${stepM[3]}</octave></pitch><duration>${t.dur}</duration>${t.tieStart ? '<tie type="start"/>' : ''}${t.tieStop ? '<tie type="stop"/>' : ''}<type>${durType(t.dur)}</type>${dots(t.dur)}${t.tieStart || t.tieStop ? `<notations>${t.tieStop ? '<tied type="stop"/>' : ''}${t.tieStart ? '<tied type="start"/>' : ''}</notations>` : ''}</note>`;
      });
      cursor = t.at + t.dur;
    }
    fillRest((m + 1) * MEAS);
    const attrs = m === 0 ? `<attributes><divisions>${DIV}</divisions><key><fifths>0</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>` : '';
    measures.push(`<measure number="${m + 1}">${attrs}${body}</measure>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
<work><work-title>${xmlEsc(title)}</work-title></work>
<identification>${composer ? `<creator type="composer">${xmlEsc(composer)}</creator>` : ''}<encoding><software>Thai Music Archive (thaimusicarchive.com) · ด=${xmlEsc(tonic)}</software></encoding></identification>
<part-list><score-part id="P1"><part-name>${xmlEsc(title)}</part-name></score-part></part-list>
<part id="P1">${measures.join('\n')}</part>
</score-partwise>`;
}
export function versesToMidi(verses, { tonic = 'C', bpm = 80, program = 12, beat = 'western' } = {}) {
  const shift = beat === 'western' ? 1 : 0;   // ท้ายห้องไทย → ต้นห้องสากล
  // SMF format 0 · PPQ 480 · เขบ็ต = 240 tick · program 12 = marimba (ใกล้ระนาด)
  const PPQ = 480, per8 = PPQ / 2;
  const { events } = versesToNoteEvents(verses, { tonic });
  const msgs = [];
  events.forEach(e => {
    const on = Math.round((e.start8 + shift) * per8), off = Math.round((e.start8 + shift + e.dur8) * per8) - 1;
    e.midis.forEach(m => { msgs.push({ t: on, b: [0x90, m, 90] }); msgs.push({ t: Math.max(on + 1, off), b: [0x80, m, 0] }); });
  });
  msgs.sort((a, b) => a.t - b.t || (a.b[0] === 0x80 ? -1 : 1));
  const bytes = [];
  const vlq = v => { const s = [v & 0x7f]; while ((v >>= 7) > 0) s.unshift((v & 0x7f) | 0x80); return s; };
  const usPerQ = Math.round(60000000 / bpm);
  bytes.push(...vlq(0), 0xff, 0x51, 0x03, (usPerQ >> 16) & 0xff, (usPerQ >> 8) & 0xff, usPerQ & 0xff);
  bytes.push(...vlq(0), 0xc0, program & 0x7f);
  let last = 0;
  msgs.forEach(m => { bytes.push(...vlq(m.t - last), ...m.b); last = m.t; });
  bytes.push(...vlq(0), 0xff, 0x2f, 0x00);
  const be32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const out = [0x4d, 0x54, 0x68, 0x64, ...be32(6), 0, 0, 0, 1, (PPQ >> 8) & 255, PPQ & 255, 0x4d, 0x54, 0x72, 0x6b, ...be32(bytes.length), ...bytes];
  return new Uint8Array(out);
}

/* ───────── verses → ข้อความไทย / TH Notation ───────── */
export function versesToThaiText(verses, { keys = false, twoHands = null } = {}) {
  const two = twoHands ?? (verses || []).some(v => v.cells.some(c => (c.l || []).length));
  const tok = arr => !arr || !arr.length ? '-' : arr.map(n => keys ? (KEY_OF[n.ch + '|' + n.reg] || n.ch) : n.ch + (n.reg === 1 ? HIGH : n.reg === -1 ? LOW : '')).join('');
  const hand = (v, side) => { const out = []; for (let h = 0; h < hongOf(v); h++) out.push(v.cells.slice(h * 4, h * 4 + 4).map(c => tok(c[side])).join(' ')); return out.join(' | '); };
  const lines = []; let lastSec = null;
  (verses || []).forEach(v => {
    if (!hasSound(v)) return;
    if (v.sec !== lastSec) { lines.push('# ' + v.sec); lastSec = v.sec; }
    if (two) { lines.push('R: ' + hand(v, 'r')); lines.push('L: ' + hand(v, 'l')); }
    else lines.push(hand(v, 'r'));
  });
  return lines.join('\n');
}

/* ───────── ทางเข้ารวม: อ่านข้อความทุกแบบ → verses ───────── */
export function importText(text, { format = null, tonic = 'C', beat = 'thai', base = 4, lineHong = 8 } = {}) {
  const fmt = format || detectFormat(text);
  if (fmt === 'western') {
    const g = westernGridToEvents(text);
    const r = eventsToVerses(g.events, { length: g.length, tonic, beat, base, lineHong });
    const meta = String(text).match(/^%\s*meta\s+(.*)$/im)?.[1] ?? '';
    const tempo = parseInt(meta.match(/tempo=(\d+)/)?.[1] ?? '') || null;
    const key = meta.match(/key=([A-G][#b]?)/)?.[1] ?? null;
    return { format: 'western', verses: r.verses, warnings: r.warnings, meta: { tempo, key, time: meta.match(/time=(\S+)/)?.[1] ?? null } };
  }
  const verses = textToVersesAny(text, { base });
  return { format: fmt === 'unknown' ? 'thai' : fmt, verses, warnings: verses.length ? [] : ['อ่านโน้ตไม่ได้ — ตรวจว่าข้อความเป็นโน้ตไทย (- - - ด | …) รหัสแป้น หรือตารางสากล (C4 D4 …)'] };
}

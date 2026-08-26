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
export function pdfItemsToLines(items, { yTol = 3, withY = false } = {}) {
  const its = (items || []).filter(i => i.str != null && i.str !== '').map((i, idx) => ({ ...i, x: +i.x || 0, y: +i.y || 0, idx }));
  // x ต่างกันน้อยกว่า 0.5pt ถือว่าเท่ากัน → คงลำดับเดิมของ pdf.js (เครื่องหมายบน/ล่าง width 0 กับช่องว่างถัดไปมี x เท่ากันแต่คลาดทศนิยม)
  const byX = (a, b) => Math.abs(a.x - b.x) > 0.5 ? a.x - b.x : a.idx - b.idx;
  its.sort((a, b) => (Math.abs(a.y - b.y) > yTol ? b.y - a.y : 0) || byX(a, b));
  const lines = [];
  for (const it of its) {
    const L = lines[lines.length - 1];
    if (L && Math.abs(L.y - it.y) <= yTol) L.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map(L => {
    L.items.sort(byX);
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
    return withY ? { text: out.trim(), y: L.y } : out.trim();
  }).filter(l => withY ? l.text : l);
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
export function importText(text, { format = null, tonic = 'C', beat = 'thai', base = 4, lineHong = 8, layout = 'single' } = {}) {
  const fmt = format || detectFormat(text);
  if (fmt !== 'western' && layout) text = applyLayout(text, layout);   // single = ถอดป้าย R/L ออก
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

/* ───────── รูปแบบบรรทัด (layout): หัวเดียว / สองมือ (บรรทัดคู่) / 3 บรรทัด (ขิม) / มีเนื้อร้องแทรก ─────────
   ปัญหา: PDF โน้ตสองมือ = บรรทัดบน (ขวา) + บรรทัดล่าง (ซ้าย) ต่อระบบ — ถ้าอ่านเป็นบรรทัดอิสระจะได้วรรคซ้ำสองเท่า
   detectLayout(lines) lines = [{text, y?}] (y จาก PDF ถ้ามี) → {layout, confidence, reason}
   applyLayout(text, layout) → ข้อความที่จับคู่เป็น "R: …" / "L: …" ให้ textToVerses อ่าน · บรรทัดที่ไม่ใช่โน้ต (เนื้อร้อง/หัวข้อ) ข้าม/คงไว้ */
export const LAYOUTS = {
  single:  'หัวเดียว (บรรทัดละแนวเดียว)',
  two:     'สองมือ — บรรทัดบน = ขวา · ล่าง = ซ้าย',
  'two-rev': 'สองมือ — บรรทัดบน = ซ้าย · ล่าง = ขวา',
  three:   'ขิม 3 บรรทัด — บน = ขวา · กลาง = ซ้าย · ล่าง = ข้าม',
  labeled: 'มีป้าย R:/L: (ขวา:/ซ้าย:) กำกับอยู่แล้ว',
};
const HAND_RE = /^\s*(?:ว\.?\s*\d+\s*)?(R|L|ขวา|ซ้าย|มือขวา|มือซ้าย|มือบน|มือล่าง|บน|ล่าง)\s*[:.]\s*/i;
const HAND_OF = { r: 'R', l: 'L', 'ขวา': 'R', 'ซ้าย': 'L', 'มือขวา': 'R', 'มือซ้าย': 'L', 'มือบน': 'R', 'มือล่าง': 'L', 'บน': 'R', 'ล่าง': 'L' };
export function isNotationLine(line) {
  let s = String(line || '').trim();
  if (!s || s.startsWith('#') || s.startsWith('%')) return false;
  s = s.replace(HAND_RE, '').replace(/^ว\.?\s*\d+\s*[:.]?\s*/, '');
  const ok = new Set([...NOTES, HIGH, LOW, 'ุ', '-', '–', '|', ' ', '\t']);
  let good = 0, bad = 0;
  for (const c of s) { if (ok.has(c) || /[a-zA-Z]/.test(c)) good++; else bad++; }
  return good >= 4 && good / (good + bad) >= 0.85 && /[ดรมฟซลทa-zA-Z]/.test(s);
}
const noteCount = s => (String(s).replace(HAND_RE, '').match(/[ดรมฟซลทqwertyuasdfghjzxcvbnm]/gi) || []).length;
const hongCount = s => String(s).replace(HAND_RE, '').split('|').filter(x => x.trim()).length;
export function detectLayout(lines) {
  const L = (lines || []).map(l => typeof l === 'string' ? { text: l } : l).filter(l => isNotationLine(l.text));
  if (!L.length) return { layout: 'single', confidence: 0, reason: 'ไม่พบบรรทัดโน้ต' };
  if (L.some(l => HAND_RE.test(l.text))) return { layout: 'labeled', confidence: 1, reason: 'มีป้าย R:/L: กำกับ' };
  // 1) ระยะห่างแนวตั้ง (PDF): บรรทัดคู่ชิดกัน สลับกับช่องว่างกว้างระหว่างระบบ
  if (L.length >= 4 && L.every(l => typeof l.y === 'number')) {
    const gaps = []; for (let i = 1; i < L.length; i++) gaps.push(Math.abs(L[i - 1].y - L[i].y));
    const sorted = [...gaps].sort((a, b) => a - b), small = sorted[0], large = sorted[sorted.length - 1];
    if (large > small * 1.5) {
      const isSmall = g => g <= small * 1.25, isLarge = g => g >= large * 0.75;
      const pat2 = gaps.every((g, i) => i % 2 === 0 ? isSmall(g) : isLarge(g));
      const pat3 = L.length >= 6 && gaps.every((g, i) => i % 3 === 2 ? isLarge(g) : isSmall(g));
      if (pat3) return { layout: 'three', confidence: 0.9, reason: 'บรรทัดโน้ตเกาะกลุ่มละ 3 (ช่องไฟชิด 2 กว้าง 1)' };
      if (pat2) return { layout: 'two', confidence: 0.9, reason: 'บรรทัดโน้ตเกาะกันเป็นคู่ (ช่องไฟชิด-กว้างสลับกัน) = น่าจะเป็นโน้ตสองมือ' };
    }
  }
  // 2) เนื้อหา: จำนวนบรรทัดคู่ · ทุกคู่ห้องเท่ากัน · บรรทัดล่างโน้ตไม่มากกว่าบน (มือซ้ายมักบางกว่า) → เดา "สองมือ" ความมั่นใจต่ำ
  if (L.length >= 2 && L.length % 2 === 0) {
    let okPairs = 0, sparser = 0;
    for (let i = 0; i < L.length; i += 2) {
      if (hongCount(L[i].text) === hongCount(L[i + 1].text)) okPairs++;
      if (noteCount(L[i + 1].text) <= noteCount(L[i].text)) sparser++;
    }
    const n = L.length / 2;
    if (okPairs === n && sparser >= n * 0.8 && n >= 2) return { layout: 'two', confidence: 0.4, reason: 'บรรทัดเป็นคู่ห้องเท่ากันและบรรทัดล่างโน้ตบางกว่า — อาจเป็นโน้ตสองมือ (ตรวจดู)' };
  }
  return { layout: 'single', confidence: 0.6, reason: 'ไม่พบสัญญาณโน้ตสองมือ' };
}
export function applyLayout(text, layout = 'single') {
  const lines = String(text || '').split('\n');
  if (layout === 'labeled') {
    return lines.map(l => { const m = l.match(HAND_RE); return m ? l.replace(HAND_RE, (HAND_OF[m[1].toLowerCase()] ?? HAND_OF[m[1]] ?? 'R') + ': ') : l; }).join('\n');
  }
  if (layout === 'single') return lines.map(l => l.replace(HAND_RE, '')).join('\n');   // หัวเดียว: ป้าย R:/L: (ถ้ามี) ถอดออก ทุกบรรทัดเป็นแนวเดียว
  const per = layout === 'three' ? 3 : 2;
  const rIdx = layout === 'two-rev' ? 1 : 0, lIdx = layout === 'two-rev' ? 0 : 1;   // แถวไหนเป็นมือขวา/ซ้าย (แถวที่ 3 ของขิมข้าม)
  const out = []; let group = [];
  const flush = () => {
    // textToVerses ต้องเจอ R: ก่อน L: เสมอ
    if (group[rIdx] != null) out.push('R: ' + group[rIdx].trim());
    else if (group[lIdx] != null) out.push('R: ' + group[lIdx].trim());   // กลุ่มไม่ครบ (เหลือแถวเดียว) → มือขวา
    if (group[rIdx] != null && group[lIdx] != null) out.push('L: ' + group[lIdx].trim());
    group = [];
  };
  for (const l of lines) {
    if (isNotationLine(l)) { group.push(l.replace(HAND_RE, '')); if (group.length === per) flush(); }
    else { if (group.length) flush(); out.push(l); }   // หัวข้อ/เนื้อร้อง: ปิดกลุ่มค้าง (กลุ่มไม่ครบ = มือขวาอย่างเดียว) แล้วคงบรรทัดไว้
  }
  if (group.length) flush();
  return out.join('\n');
}

/* ───────── PDF ตาราง Word (ตระกูลไฟล์ของ Pk): ตัวถอดตามตาราง (port จาก extract_all.py ที่ใช้ลงฐาน v35) ─────────
   chars = [{text, x0, x1, top, bot}] (y ลง · จาก pdf.js แยกเป็นรายอักขระ) · vsegs = [{x, top, bot}] เส้นตั้งของตาราง
   1) จัดอักขระเป็นแถวตาม top (tol 6.5) → แถวโน้ต / คำร้อง / หัวข้อ
   2) เส้นตั้ง → แถวช่องตาราง (cell rows) → กลุ่ม (band) ที่แถวติดกัน (<5pt) = บรรทัดโน้ต 1 บรรทัด (2 แถว = R/L · 3 แถว = นำ/ตาม)
   3) ขอบคอลัมน์ต่อ band จากเส้นตั้ง · ในช่อง: อักขระจัดเป็นหน่วยตามช่องไฟจริง (glue 1.5pt) · >4 หน่วยรวมคู่ที่ชิดสุด (สะบัด) · <4 แยกรายอักขระ
   คืน { lines:[{y, text}] (มี "R: …"/"L: …" · หัวข้อ · "% เนื้อร้อง:") , report } — ป้อน importText(layout:'labeled') ต่อได้ */
const KEYCHARS = 'abcdefghjmnqrstuvwxyz';
const NOTE_CHARS = new Set([...KEYCHARS, ...NOTES, HIGH, LOW, 'ุ', '-']);
export function gridToLines(chars, vsegs, { rowTol = 6.5, glue = 1.5 } = {}) {
  const report = { lyric_rows: [], headings: [], short_cells: [] };
  const cs = (chars || []).filter(c => c.text && c.text.trim()).map(c => ({ ...c })).sort((a, b) => (a.top - b.top) || (a.x0 - b.x0));
  // ---- rows ----
  const rows = [];
  for (const c of cs) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(c.top - r.top) <= rowTol) { r.chars.push(c); r.top = Math.min(r.top, c.top); r.bot = Math.max(r.bot, c.bot); }
    else rows.push({ top: c.top, bot: c.bot, chars: [c] });
  }
  for (const r of rows) {
    r.chars.sort((a, b) => a.x0 - b.x0);
    // ข้อความของแถว: เว้นวรรคตามช่องไฟจริง (อักขระช่องว่างถูกตัดไปแล้ว)
    let txt = ''; let prev = null;
    for (const c of r.chars) { if (prev && c.x0 - prev.x1 > glue) txt += ' '; txt += c.text; prev = c; }
    const body = txt.replace(/\s+/g, '');
    const known = [...body].filter(ch => NOTE_CHARS.has(ch) || ch === '3' || '‐‑‒–—―−'.includes(ch)).length;
    const notes = [...body].filter(ch => KEYCHARS.includes(ch) || NOTES.includes(ch)).length;
    r.txt = txt;
    const frac = known / Math.max(body.length, 1);
    const thaiOther = [...body].filter(ch => /[ก-๙]/.test(ch) && !NOTES.includes(ch) && ch !== HIGH && ch !== LOW).length;
    const dashes = (body.match(/[-‐‑‒–—―−]/g) || []).length;
    if (frac >= 0.85 && notes >= 1) r.kind = 'note';
    else if (body.includes('-') && notes / Math.max(body.length, 1) >= 0.4 && notes / Math.max(body.length, 1) <= 0.85 && body.length > 8) { r.kind = 'lyric'; report.lyric_rows.push(txt.slice(0, 60)); }
    else if (dashes >= 3 && thaiOther >= 3) { r.kind = 'lyric'; report.lyric_rows.push(txt.slice(0, 60)); }   // แถวคำร้องไทยใต้โน้ต (- เจ้า - ดอก …)
    else r.kind = 'text';
  }
  // ---- cell rows from vertical segments ----
  const vb = new Map();
  for (const s of (vsegs || [])) { const k = `${Math.round(s.top)}|${Math.round(s.bot)}`; if (!vb.has(k)) vb.set(k, { top: Math.round(s.top), bot: Math.round(s.bot), xs: [] }); vb.get(k).xs.push(Math.round(s.x * 10) / 10); }
  const cellrows = [];
  for (const cr of [...vb.values()].sort((a, b) => (a.top - b.top) || (a.bot - b.bot))) {
    const last = cellrows[cellrows.length - 1];
    if (last && cr.top <= last.bot - 3) { last.xs.push(...cr.xs); last.bot = Math.max(last.bot, cr.bot); }
    else cellrows.push({ top: cr.top, bot: cr.bot, xs: [...cr.xs] });
  }
  const groups = [];
  for (const cr of cellrows) { const g = groups[groups.length - 1]; if (g && cr.top - g[g.length - 1].bot < 5) g.push(cr); else groups.push([cr]); }
  // ตารางเดียวที่มี ≥4 แถวติดกัน (โน้ตหัวเดียวหลายบรรทัดในตารางเดียว) → แตกเป็นกลุ่มละ 1 แถว (ผู้ใช้เลือก "สองมือ" ทีหลังได้)
  for (let gi = groups.length - 1; gi >= 0; gi--) if (groups[gi].length >= 4) groups.splice(gi, 1, ...groups[gi].map(cr => [cr]));
  const classify = r => {
    const yc = (r.top + r.bot) / 2;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (g[0].top - 4 <= yc && yc <= g[g.length - 1].bot + 4) {
        if (g.length === 1) return [gi, 'top'];
        const m = (g[0].bot + g[1].top) / 2;
        if (Math.abs(yc - m) <= 6) return [gi, 'mid'];
        return [gi, yc < m ? 'top' : 'bot'];
      }
    }
    return [null, null];
  };
  const grouped = new Map(), events = [];
  for (const r of rows) {
    if (r.kind === 'text') { const h = cleanHeading(r.txt); if (h) { events.push({ y: r.top, kind: 'head', payload: h }); report.headings.push(h); } continue; }
    if (r.kind === 'lyric') { events.push({ y: r.top, kind: 'lyric', payload: r.txt }); continue; }
    const [gi, cls] = classify(r);
    if (gi === null) { events.push({ y: r.top, kind: 'loose', payload: r }); continue; }   // แถวโน้ตนอกตาราง (PDF ไม่มีเส้น)
    if (!grouped.has(gi)) grouped.set(gi, {});
    const d = grouped.get(gi);
    if (d[cls]) { d[cls].chars.push(...r.chars); d[cls].chars.sort((a, b) => a.x0 - b.x0); d[cls].top = Math.min(d[cls].top, r.top); d[cls].bot = Math.max(d[cls].bot, r.bot); }
    else d[cls] = r;
    if (Object.keys(d).length === 1) events.push({ y: r.top, kind: 'band', payload: gi });
  }
  const lines = [];
  const unitsOf = (row, x0, x1) => {
    if (!row) return ['-', '-', '-', '-'];
    const cell = row.chars.filter(c => x0 - 0.5 <= (c.x0 + c.x1) / 2 && (c.x0 + c.x1) / 2 < x1 - 0.5);
    if (!cell.length) return ['-', '-', '-', '-'];
    let units = [], cur = [];
    for (const c of cell) { if (cur.length && c.x0 - cur[cur.length - 1].x1 > glue) { units.push(cur); cur = []; } cur.push(c); }
    if (cur.length) units.push(cur);
    if (units.length < 4) {   // ตัวทับกัน/ไม่มีช่องไฟ → แยกรายอักขระ ผูกเครื่องหมายบน/ล่างกับตัวก่อน
      units = [];
      for (const c of cell) { if (units.length && (c.text === HIGH || c.text === LOW || c.text === 'ุ')) units[units.length - 1].push(c); else units.push([c]); }
    }
    while (units.length > 4) {   // รวมคู่ที่ชิดสุด = คู่สะบัดใช้ช่องเดียว
      let best = 0, bg = Infinity;
      for (let m = 0; m < units.length - 1; m++) { const gp = units[m + 1][0].x0 - units[m][units[m].length - 1].x1; if (gp < bg) { bg = gp; best = m; } }
      units[best] = units[best].concat(units[best + 1]); units.splice(best + 1, 1);
    }
    const vals = units.map(u => u.map(c => c.text).join('').replace(/[‐‑‒–—―−]/g, '-'));
    if (units.length < 4) report.short_cells.push({ y: row.top, x0 });
    while (vals.length < 4) vals.push('-');
    return vals;
  };
  const cellHasChar = (rowsOfBand, x0, x1) => rowsOfBand.some(row => row && row.chars.some(c => x0 - 0.5 <= (c.x0 + c.x1) / 2 && (c.x0 + c.x1) / 2 < x1 - 0.5));
  events.sort((a, b) => a.y - b.y);
  for (const ev of events) {
    if (ev.kind === 'head') { lines.push({ y: ev.y, text: '# ' + ev.payload, kind: 'head' }); continue; }
    if (ev.kind === 'lyric') { lines.push({ y: ev.y, text: '% เนื้อร้อง: ' + ev.payload, kind: 'lyric' }); continue; }
    if (ev.kind === 'loose') { lines.push({ y: ev.y, text: looseRowText(ev.payload, glue), kind: 'note' }); continue; }
    const gi = ev.payload, g = groups[gi], d = grouped.get(gi);
    const xsAll = [...new Set(g.flatMap(cr => cr.xs))].sort((a, b) => a - b);
    const edges = []; for (const x of xsAll) if (!edges.length || x - edges[edges.length - 1] > 4) edges.push(x);
    if (edges.length < 2) { ['top', 'mid', 'bot'].forEach(k => { if (d[k]) lines.push({ y: d[k].top, text: looseRowText(d[k], glue), kind: 'note' }); }); continue; }
    const topr = d.top, midr = d.mid, botr = d.bot;
    const R = [], L = [], roles = [];
    for (let k = 0; k < edges.length - 1; k++) {
      const x0 = edges[k], x1 = edges[k + 1];
      const midHas = midr && midr.chars.some(c => x0 - 0.5 <= (c.x0 + c.x1) / 2 && (c.x0 + c.x1) / 2 < x1 - 0.5);
      if (midHas) { R.push(unitsOf(midr, x0, x1)); L.push(['-', '-', '-', '-']); roles.push('นำ'); }
      else { R.push(unitsOf(topr, x0, x1)); L.push(unitsOf(botr, x0, x1)); roles.push(midr ? 'ตาม' : ''); }
    }
    let keep = R.length;
    while (keep > 0 && !cellHasChar([topr, midr, botr], edges[keep - 1], edges[keep])) keep--;
    if (!keep) continue;
    const twoRows = !!(botr || midr);
    const fmt = cells => cells.slice(0, keep).map(c => c.join(' ')).join(' | ');
    if (twoRows) { lines.push({ y: (topr ?? midr).top, text: 'R: ' + fmt(R), kind: 'note', hands: 2 }); lines.push({ y: (botr ?? midr).top + 0.01, text: 'L: ' + fmt(L), kind: 'note', hands: 2 }); }
    else lines.push({ y: topr.top, text: fmt(R), kind: 'note', hands: 1 });
    if (midr) lines.push({ y: (botr ?? midr).top + 0.02, text: `% เครื่องนำ ห้อง ${roles.map((r, i) => r === 'นำ' ? i + 1 : null).filter(Boolean).join(',')}`, kind: 'note-meta' });
  }
  return { lines, report };
}
function looseRowText(row, glue) {
  // แถวโน้ตที่ไม่มีเส้นตาราง: จัดหน่วยตามช่องไฟ · ช่องไฟกว้าง (> 3×glue) = ขอบห้อง
  const cs = [...row.chars].sort((a, b) => a.x0 - b.x0);
  let out = '', last = null;
  const h = Math.max(1, (row.bot - row.top));
  for (const c of cs) {
    if (last) { const gp = c.x0 - last.x1; out += gp > h * 1.1 ? ' | ' : gp > glue ? ' ' : ''; }
    out += c.text; last = c;
  }
  return out.replace(/[‐‑‒–—―−]/g, '-');
}
const HEAD_FIXES = [['หน้าทบั', 'หน้าทับ'], ['สองชนั้', 'สองชั้น'], ['สามชนั้', 'สามชั้น'], ['ชนั้เดยีว', 'ชั้นเดียว'], ['ชนั้', 'ชั้น'], ['เทยี่ว', 'เที่ยว'], ['เดยีว', 'เดียว'], ['กลบั', 'กลับ'], ['เรว็', 'เร็ว'], ['ท ี่', 'ที่'], ['ไม ้', 'ไม้'], ['ปี่พาทย', 'ปี่พาทย์'], ['พาทย ์', 'พาทย์']];
function cleanHeading(s) {
  let t = String(s || '').replace(/[‐‑‒–—―−]/g, '-');
  for (const [a, b] of HEAD_FIXES) t = t.split(a).join(b);
  return t.replace(/\s+/g, ' ').trim();
}

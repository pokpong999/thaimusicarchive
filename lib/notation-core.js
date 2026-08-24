// lib/notation-core.js — ตรรกะกลางของโน้ตไทย THMA (ไม่แตะ DOM ใช้ได้ทั้งเบราว์เซอร์และ Node)
// กระดานโน้ต (NotationInput) และเครื่องเล่น (NotationPlayer) เรียกไฟล์นี้ตัวเดียวกัน
// กฎสะบัด / สองมือ / กระสวน / ลูกตก / การแบ่งวรรค จึงมีที่อยู่ที่เดียวในโปรเจกต์

export const NOTES = ['ด','ร','ม','ฟ','ซ','ล','ท'];
export const EN = {'ด':'C','ร':'D','ม':'E','ฟ':'F','ซ':'G','ล':'A','ท':'B'};
export const HIGH = 'ํ';   // ํ  เสียงสูง
export const LOW  = 'ฺ';   // ฺ  เสียงต่ำ
const LOW2 = 'ุ';          // ุ  บางไฟล์พิมพ์สระอุแทนพินทุ

export const CODE16 = {'----':'O','X---':'A','-X--':'B','--X-':'C','---X':'D',
  'XX--':'E','X-X-':'F','X--X':'G','-XX-':'H','-X-X':'I','--XX':'J',
  'XXX-':'K','XX-X':'L','X-XX':'M','-XXX':'N','XXXX':'P'};

// แป้น TH Notation: แถวบน = สูง · แถวกลาง = กลาง · แถวล่าง = ต่ำ
export const KEYROW = {1:'qwertyu', 0:'asdfghj', '-1':'zxcvbnm'};
export const KEYMAP = {};
export const KEY_OF = {};
for (const reg of [1, 0, -1]) [...KEYROW[reg]].forEach((k, i) => {
  KEYMAP[k] = { i, reg };
  KEY_OF[NOTES[i] + '|' + reg] = k;
});

// ค่าปริยายที่ Pk เคาะ (2026-08-24): ช่องไฟสะบัด 80 ms เท่ากันทุกช่วง ตัวสุดท้ายลงตรงจังหวะ
export const SABAT_GAP_DEFAULT = 0.08;
// ฉิ่ง–ฉับ ตามอัตราชั้น: ห้องต่อรอบ (ตรงกับ CHING_PATTERNS ใน lib/nathab.js)
export const CHING_CYCLE = {'สามชั้น': 8, 'สองชั้น': 4, 'ชั้นเดียว': 2};

/* ───────── โน้ตหนึ่งเสียง = {ch, reg} ───────── */
export const noteText = n => n.ch + (n.reg === 1 ? HIGH : n.reg === -1 ? LOW : '');
export const noteKey  = n => KEY_OF[n.ch + '|' + n.reg] || '';
export const cellText = arr => (arr && arr.length) ? arr.map(noteText).join('') : '-';

// อ่านหนึ่งหน่วย (token) เป็นรายการโน้ต — รับทั้งตัวไทย (ดํ ทฺ) และรหัสแป้น (q j m)
export function unitNotes(tok) {
  const notes = [], ch = [...(tok || '')];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], ti = NOTES.indexOf(c);
    if (ti >= 0) {
      let reg = 0;
      if (ch[i + 1] === HIGH) { reg = 1; i++; }
      else if (ch[i + 1] === LOW || ch[i + 1] === LOW2) { reg = -1; i++; }
      notes.push({ ch: NOTES[ti], reg });
    } else if (KEYMAP[c.toLowerCase()]) {
      const m = KEYMAP[c.toLowerCase()];
      notes.push({ ch: NOTES[m.i], reg: m.reg });
    }
  }
  return notes.slice(0, 2);   // กฎกันพลาด: ไม่มี token ใดมีโน้ตเกิน 2 ตัว
}

/* ───────── สตริงโน้ตหนึ่งมือ ⇄ ตำแหน่ง ─────────
   "- - - ซ | - ล - ดํ"  ⇄  [[],[],[],[ซ], [],[ล],[],[ดํ]]   */
export function parseHand(str) {
  if (!str) return [];
  const out = [];
  String(str).split('|').forEach(hong => {
    const toks = hong.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return;
    const cells = toks.map(t => (t === '-' || t === '–') ? [] : unitNotes(t));
    while (cells.length < 4) cells.push([]);
    out.push(...cells.slice(0, 4));
  });
  return out;
}
export function formatHand(positions) {
  const hongs = [];
  for (let i = 0; i < positions.length; i += 4) hongs.push(positions.slice(i, i + 4).map(cellText).join(' '));
  return hongs.join(' | ');
}

/* ───────── การแบ่งวรรคในบรรทัด ─────────
   กฎของ Pk (2026-08-12): ตัดวรรคละ base ห้องจากซ้าย เศษเป็นวรรคสั้น ห้ามวรรคคร่อมบรรทัด
   7 ห้อง = 4+3 · 8 = 4+4 · 6 = 4+2 · 4 = 4 · 3 = 3                              */
export function splitLine(lineHong, base = 4) {
  const out = [];
  let left = lineHong;
  while (left > base) { out.push(base); left -= base; }
  if (left > 0) out.push(left);
  return out.length ? out : [base];
}

/* ───────── วรรค = {sec, nl, cells:[{r:[],l:[]}]} ───────── */
export function mkVerse(sec, hong, nl = false) {
  return { sec, nl: !!nl, cells: Array.from({ length: hong * 4 }, () => ({ r: [], l: [] })) };
}
export const hongOf   = v => v.cells.length / 4;
export const hasSound = v => v.cells.some(c => c.r.length || c.l.length);
const cellOn = c => (c.r.length || c.l.length) ? 'X' : '-';

export function krasuanOf(v, h) {
  return CODE16[v.cells.slice(h * 4, h * 4 + 4).map(cellOn).join('')] || '?';
}
// รหัสยาวเท่าจำนวนห้องจริง — วรรคสั้น 3 ห้องได้รหัส 3 ตัว
export function verseCode(v) {
  return Array.from({ length: hongOf(v) }, (_, h) => krasuanOf(v, h)).join('');
}
// ลูกตก = ตัวท้ายของห้องสุดท้าย · ถ้าห้องสุดท้ายว่างใช้เสียงท้ายสุดที่มี (exact=false → ติดธง)
export function luktokOf(v) {
  for (let i = v.cells.length - 1; i >= 0; i--) {
    const c = v.cells[i], src = c.r.length ? c.r : c.l;
    if (src.length) return { ch: src[src.length - 1].ch, exact: i === v.cells.length - 1 };
  }
  return null;
}
// รหัสคู่ลูกตก ดด01 … ทท49 + โรมัน
export function pairId(a, b) {
  const n = NOTES.indexOf(a) * 7 + NOTES.indexOf(b) + 1;
  return { th: a + b + String(n).padStart(2, '0'), en: EN[a] + EN[b] + String(n).padStart(2, '0') };
}
export function chingAt(step, level = 'สองชั้น') {
  const cyc = (CHING_CYCLE[level] || 4) * 4;
  const p = (step % cyc) + 1;
  return p === cyc / 2 ? 'ฉิ่ง' : p === cyc ? 'ฉับ' : '';
}

/* ───────── แนวเสียงสำหรับเล่น ─────────
   รับตำแหน่งสองมือยาวตลอดเพลง G[0]=R, G[1]=L (ถ้าไม่แยกมือ ให้ G[1] ว่าง)
   สะบัด = คู่โน้ตในช่องเดียว + ตัวนำจากช่องก่อนหน้า (มือเดียวกันก่อน ไม่มีจึงข้ามมือ
   โดยอีกมือต้องว่างในช่องคู่) ตัวนำที่ถูกดึงติด consumed จึงไม่ดังซ้ำที่จังหวะเดิม
   เวลาเล่น: ตัวสุดท้ายลงตรงจังหวะ ตัวก่อนหน้าถอยหลังทีละ gap — สองมือจึงลงพร้อมกันเสมอ */
export function buildVoices(G) {
  const total = Math.max(G[0].length, G[1] ? G[1].length : 0);
  const L0 = G[0], L1 = G[1] || [];
  const at = (li, s) => (li ? L1[s] : L0[s]) || [];
  const consumed = [new Array(total).fill(false), new Array(total).fill(false)];
  const runs = new Map();
  for (let s = 0; s < total; s++) {
    for (let li = 0; li < 2; li++) {
      const cell = at(li, s);
      if (cell.length < 2) continue;
      let lead = [], leadStep = -1, leadHand = -1;
      if (s > 0) {
        const lj = 1 - li;
        if (at(li, s - 1).length === 1 && !consumed[li][s - 1]) {
          lead = at(li, s - 1); consumed[li][s - 1] = true; leadStep = s - 1; leadHand = li;
        } else if (at(lj, s).length === 0 && at(lj, s - 1).length === 1 && !consumed[lj][s - 1]) {
          lead = at(lj, s - 1); consumed[lj][s - 1] = true; leadStep = s - 1; leadHand = lj;
        }
      }
      runs.set(li * total + s, { notes: [...lead, ...cell], leadStep, leadHand, hand: li, step: s });
    }
  }
  return { total, runs, consumed, at };
}
// ตารางเวลาเล่น: คืน [{t, note, vel}] · t สัมพัทธ์จาก 0 · stepDur = วินาทีต่อตำแหน่ง
export function scheduleNotes(G, { fromStep = 0, stepDur = 0.25, gap = SABAT_GAP_DEFAULT } = {}) {
  const { total, runs, consumed, at } = buildVoices(G);
  const out = [];
  for (let s = fromStep; s < total; s++) {
    const t = (s - fromStep) * stepDur;
    for (let li = 0; li < 2; li++) {
      if (consumed[li][s]) continue;
      const run = runs.get(li * total + s);
      if (run) run.notes.forEach((n, i) => {
        const back = run.notes.length - 1 - i;
        out.push({ t: t - back * gap, step: s, hand: li, note: n, vel: back === 0 ? 1 : back === 1 ? 0.8 : 0.65 });
      });
      else at(li, s).forEach(n => out.push({ t, step: s, hand: li, note: n, vel: 1 }));
    }
  }
  return out;
}

/* ───────── แถว song_melody ⇄ วรรคของกระดาน ─────────
   แถว = {verse_no, section, combined, right_hand, left_hand, line_no}
   line_no: เลขบรรทัดในต้นฉบับ (วรรคที่ line_no เปลี่ยน = ขึ้นบรรทัดใหม่)
   ถ้าไม่มี line_no (ข้อมูลเก่า) จัดบรรทัดละ 2 วรรค                                  */
export function rowsToVerses(rows, { base = 4 } = {}) {
  const sorted = [...(rows || [])].sort((a, b) => (a.verse_no || 0) - (b.verse_no || 0));
  const hasLine = sorted.some(r => r.line_no != null);
  let lastLine = null, count = 0;
  return sorted.map(r => {
    const rh = parseHand(r.right_hand), lh = parseHand(r.left_hand), cb = parseHand(r.combined);
    const useHands = rh.length || lh.length;
    const len = Math.max(rh.length, lh.length, cb.length, 4);
    const v = mkVerse(r.section || 'ท่อน 1', Math.ceil(len / 4));
    for (let i = 0; i < v.cells.length; i++) {
      if (useHands) { v.cells[i].r = rh[i] || []; v.cells[i].l = lh[i] || []; }
      else v.cells[i].r = cb[i] || [];
    }
    if (hasLine) { v.nl = r.line_no !== lastLine; lastLine = r.line_no; }
    else { v.nl = count % 2 === 0; }
    count++;
    return v;
  });
}
export function versesToRows(verses, { twoHands = false } = {}) {
  const rows = [];
  let line = 0;
  verses.forEach((v, i) => {
    if (!hasSound(v)) return;
    if (v.nl || i === 0) line++;
    const R = v.cells.map(c => c.r), L = v.cells.map(c => c.l);
    const combined = v.cells.map(c => c.r.length ? c.r : c.l);   // มือขวาก่อน ว่างจึงใช้มือซ้าย
    rows.push({
      verse_no: rows.length + 1,
      section: v.sec || null,
      line_no: line,
      combined: formatHand(combined),
      right_hand: twoHands ? formatHand(R) : null,
      left_hand:  twoHands ? formatHand(L) : null,
      krasuan: verseCode(v),
      luktok: (luktokOf(v) || {}).ch || null,
    });
  });
  return rows;
}
// ตัดวรรคว่างท้ายทิ้ง แล้วนับใหม่
export function trimVerses(verses) {
  const out = verses.slice();
  while (out.length && !hasSound(out[out.length - 1])) out.pop();
  return out;
}

/* ───────── ข้อความโน้ตแบบเก่า ⇄ วรรค ─────────
   รองรับ: "# ท่อน N" · "ว.3 R: …" / "L: …" · ตัวไทยเว้นวรรค · รหัสแป้นไม่เว้นวรรค (---g|-h-q)
   · ท้ายบรรทัดมี [รหัส] หรือ ← หมายเหตุ ก็ข้ามให้                                     */
function looksLikeNotation(line) {
  const ok = new Set([...NOTES, HIGH, LOW, LOW2, '-', '–', '|', ' ', '\t']);
  let good = 0, bad = 0;
  for (const c of line) { if (ok.has(c) || /[a-zA-Z]/.test(c)) good++; else bad++; }
  return good >= 4 && good / (good + bad) >= 0.85;
}
function splitDense(s) {
  const out = [], ch = [...s];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (c === '-' || c === '–') { out.push('-'); continue; }
    let u = c;
    if (ch[i + 1] === HIGH || ch[i + 1] === LOW || ch[i + 1] === LOW2) u += ch[++i];
    out.push(u);
  }
  return out;
}
function lineToHongs(line) {
  const hongs = [];
  line.split('|').forEach(chunk => {
    const toks = chunk.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return;
    let units = toks.length >= 3 ? toks : splitDense(toks.join(''));
    // เกิน 4 หน่วย = คู่สะบัดอัดช่องเดียว รวมคู่ที่ชิดที่สุดจากท้ายมาหน้า (กฎเดียวกับ extract_all.py)
    while (units.length > 4) {
      let merged = false;
      for (let i = units.length - 2; i >= 0; i--) {
        if (units[i] !== '-' && units[i + 1] !== '-') { units.splice(i, 2, units[i] + units[i + 1]); merged = true; break; }
      }
      if (!merged) units = units.slice(0, 4);
    }
    while (units.length < 4) units.push('-');
    hongs.push(units.map(u => (u === '-' || u === '–') ? [] : unitNotes(u)));
  });
  return hongs;
}
export function textToVerses(text, { base = 4, defaultSec = 'ท่อน 1' } = {}) {
  const verses = [];
  let sec = defaultSec, pendingR = null;
  String(text || '').split('\n').forEach(raw => {
    let line = raw.trim();
    if (!line) return;
    if (line.startsWith('#')) { sec = line.replace(/^#+\s*/, '').trim() || sec; return; }
    let hand = null;
    const mh = line.match(/^(?:ว\.?\s*\d+\s*)?([RL])\s*[:.]\s*/i);
    if (mh) { hand = mh[1].toUpperCase(); line = line.slice(mh[0].length); }
    else line = line.replace(/^ว\.?\s*\d+\s*[:.]?\s*/i, '');
    line = line.replace(/\[[A-Z?]+\]\s*$/, '').replace(/←.*$/, '').trim();
    if (!line || !looksLikeNotation(line)) return;
    const hongs = lineToHongs(line);
    if (!hongs.length) return;
    if (hand === 'L' && pendingR) {
      // มือซ้ายของวรรคชุดที่เพิ่งอ่านมือขวาไป
      let at = 0;
      pendingR.forEach(v => {
        for (let h = 0; h < hongOf(v); h++) {
          const src = hongs[at + h];
          if (src) for (let p = 0; p < 4; p++) v.cells[h * 4 + p].l = src[p] || [];
        }
        at += hongOf(v);
      });
      pendingR = null;
      return;
    }
    const sizes = splitLine(hongs.length, base);
    let at = 0;
    const made = sizes.map((sz, k) => {
      const v = mkVerse(sec, sz, k === 0);
      for (let h = 0; h < sz; h++) {
        const src = hongs[at + h];
        if (src) for (let p = 0; p < 4; p++) v.cells[h * 4 + p].r = src[p] || [];
      }
      at += sz;
      return v;
    });
    verses.push(...made);
    pendingR = hand === 'R' ? made : null;
  });
  return verses;
}
export function versesToText(verses, { twoHands = false } = {}) {
  const lines = [];
  let lastSec = null;
  verses.forEach((v, i) => {
    if (!hasSound(v)) return;
    if (v.sec !== lastSec) { lines.push('# ' + v.sec); lastSec = v.sec; }
    const n = 'ว.' + (i + 1);
    if (twoHands) {
      lines.push(n + ' R: ' + formatHand(v.cells.map(c => c.r)));
      lines.push(' '.repeat(n.length) + ' L: ' + formatHand(v.cells.map(c => c.l)));
    } else {
      lines.push(n + '  ' + formatHand(v.cells.map(c => c.r.length ? c.r : c.l)) + '   [' + verseCode(v) + ']');
    }
  });
  return lines.join('\n');
}

/* ───────── ตรวจตามกฎฐานข้อมูล ───────── คืน [{kind:'ok'|'warn', title, detail}] */
export function checkVerses(verses, { base = 4 } = {}) {
  const out = [];
  const used = verses.filter(hasSound);
  if (!used.length) return [{ kind: 'ok', title: 'ยังไม่มีโน้ต', detail: 'พิมพ์ตัวแรกแล้วระบบจะเริ่มตรวจให้ทันที' }];

  const odd = used.filter(v => hongOf(v) !== base);
  if (odd.length) out.push({ kind: 'ok', title: 'วรรคขนาดพิเศษ ' + odd.length + ' วรรค',
    detail: 'บันทึกเป็นจังหวะพิเศษตามกฎ "ตัดวรรคละ ' + base + ' ห้องจากซ้าย เศษเป็นวรรคสั้น" — รหัสกระสวนสั้นลงตามจริง' });

  const secs = {};
  used.forEach(v => { secs[v.sec] = (secs[v.sec] || 0) + 1; });
  const oddSec = Object.entries(secs).filter(([, n]) => n % 2);
  if (oddSec.length) out.push({ kind: 'warn', title: 'ประโยคไม่ครบคู่',
    detail: oddSec.map(([s, n]) => s + ' มี ' + n + ' วรรค').join(' · ') + ' — วรรคเศษจะไม่เข้าคลังลูกตก' });
  else out.push({ kind: 'ok', title: 'ทุกท่อนแบ่งประโยคได้ลงตัว', detail: '' });

  const sab = [];
  verses.forEach((v, vi) => {
    if (!hasSound(v)) return;
    for (let h = 0; h < hongOf(v); h++) {
      const c = v.cells[h * 4];
      if (c.r.length > 1 || c.l.length > 1) sab.push('ว.' + (vi + 1) + '/ห้อง ' + (h + 1));
    }
  });
  if (sab.length) out.push({ kind: 'warn', title: 'สะบัดคร่อมต้นห้อง ' + sab.length + ' แห่ง',
    detail: sab.slice(0, 4).join(' · ') + (sab.length > 4 ? ' …' : '') + ' — ไม่มีตัวนำให้ดึง อ่านได้สองทาง ควรเปิดภาพต้นฉบับยืนยัน' });

  const blank = used.filter(v => { const l = luktokOf(v); return l && !l.exact; });
  if (blank.length) out.push({ kind: 'warn', title: 'ห้องท้ายวรรคว่าง ' + blank.length + ' วรรค',
    detail: 'ระบบใช้เสียงท้ายสุดที่มีแทนลูกตก — ตรงกับกฎของฐาน แต่ติดธงไว้ให้ตรวจ' });

  let lastS = -1;
  verses.forEach((v, i) => { if (hasSound(v)) lastS = i; });
  const silent = verses.filter((v, i) => i < lastS && !hasSound(v));
  if (silent.length) out.push({ kind: 'warn', title: 'วรรคเงียบทั้งวรรค ' + silent.length + ' วรรค',
    detail: 'ถ้าตั้งใจ (คุกพาทย์) ปล่อยไว้ได้ ถ้าไม่ใช่ให้ลบทิ้งก่อนส่ง' });

  if (!out.some(o => o.kind === 'warn')) out.push({ kind: 'ok', title: 'ไม่พบจุดที่ต้องตรวจ', detail: 'ส่งเข้าฐานได้เลย' });
  return out;
}
export function statsOf(verses) {
  const used = verses.filter(hasSound);
  let notes = 0, hongs = 0;
  const freq = {};
  used.forEach(v => {
    for (let h = 0; h < hongOf(v); h++) { hongs++; const k = krasuanOf(v, h); freq[k] = (freq[k] || 0) + 1; }
    v.cells.forEach(c => notes += c.r.length + c.l.length);
  });
  return { verses: used.length, hongs, notes, unique: new Set(used.map(verseCode)).size,
    top: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6) };
}

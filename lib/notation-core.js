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
// ฉิ่ง–ฉับ (Pk เคาะ 2026-08-24): สามชั้น ฉิ่งท้ายห้อง 4 ฉับท้ายห้อง 8 · สองชั้น ฉิ่งท้ายห้อง 2 ฉับท้ายห้อง 4
// ชั้นเดียว ฉิ่งขีดที่ 2 ฉับขีดที่ 4 (รอบ = 1 ห้อง)
export const CHING_CYCLE = {'สามชั้น': 8, 'สองชั้น': 4, 'ชั้นเดียว': 1};

/* ───────── เครื่องหมายวิธีบรรเลง (Pk เคาะ 2026-08-26) ─────────
   เก็บที่ v.marks[] — หนึ่งค่าต่อหนึ่งตำแหน่ง เหมือน v.ching
     'kro'  = กรอ   ตีสลับสองมือถี่ ๆ ให้เสียงยาว · เริ่มที่ตำแหน่งนี้ ยาวไปจนถึงเสียงถัดไป
     'damp' = ประคบ ใช้มืออีกข้างกด/ประคบให้เสียงสั้น ไม่กังวานทับกัน
   ผูกกับ "ตำแหน่ง" ไม่ผูกกับ "มือ" — Pk: ใส่เครื่องหมายที่มือขวามือเดียว เวลาเล่นกรอทั้งสองมือ
   ลงฐานเป็นสตริงตัวอักษรไทยตัวเดียวต่อตำแหน่ง (คอลัมน์ song_melody.marks · sql/19)      */
export const MARK_CHAR = { kro: 'ก', damp: 'ป' };
export const CHAR_MARK = { 'ก': 'kro', 'ป': 'damp' };
// เก็บไว้ "ที่ตัวเซลล์" (c.m) ไม่ใช่ที่วรรค — เวลาแทรก/ตัด/ย้ายห้อง เครื่องหมายจึงติดไปกับโน้ตเอง
export const markAt = (v, i) => (v && v.cells[i] && v.cells[i].m) || '';
export function setMark(v, i, mark) {
  const c = v.cells[i];
  if (!c) return v;
  if (mark) c.m = mark; else delete c.m;
  return v;
}
export const marksToText = v => v.cells.some(c => c.m)
  ? v.cells.map(c => MARK_CHAR[c.m] || '-').join('') : null;
export function applyMarksText(v, str) {
  if (!str) return v;
  [...String(str)].forEach((ch, i) => { const m = CHAR_MARK[ch]; if (m && v.cells[i]) v.cells[i].m = m; });
  return v;
}
// ระดับเสียงสัมบูรณ์ของโน้ตหนึ่งตัว (ด=0 … ท=6 · คู่แปดละ 7) — ใช้เรียงว่าตัวไหนต่ำตัวไหนสูง
export const pitchOf = n => NOTES.indexOf(n.ch) + (n.reg || 0) * 7;

/* ───────── ช่วงกรอทั้งเพลง ─────────
   รับตัวอ่านแบบกลาง ๆ เพื่อให้ใช้ได้ทั้งกระดาน (วรรค+เซลล์) และเครื่องเล่นหน้าเพลง (แถวจากฐาน)
     total       จำนวนตำแหน่งทั้งเพลง
     markOf(s)   'kro' | 'damp' | ''
     notesOf(s)  โน้ตทุกแนวที่ตำแหน่งนั้น [{ch,reg}…]
   คืน [{start, end, low, high, single}]
     start = ตำแหน่งที่ติดเครื่องหมายกรอ
     end   = ตำแหน่งของ "เสียงถัดไป" (ไม่รวม) — Pk: กรอยาวไปจนถึงโน้ตตัวหน้า · ไม่เจอ = จบเพลง
     low/high = สองเสียงที่ตีสลับกัน เรียงตามระดับเสียง ต่ำก่อน สูงทีหลัง
       (กฎของ Pk: เริ่มเสียงต่ำ จบเสียงสูง — ระนาด/ฆ้องจึงขึ้นมือซ้ายจบมือขวา
        ส่วนขิมเสียงต่ำอยู่ทางขวา ก็จะขึ้นมือขวาจบมือซ้ายเองโดยไม่ต้องแยกเงื่อนไขรายเครื่อง)
     single = true เมื่อตำแหน่งนั้นมีเสียงเดียว → กรอเสียงเดียว (ตีสลับมือด้วยเสียงเดิม)      */
export function kroSpans({ total, markOf, notesOf }) {
  const out = [];
  for (let s = 0; s < total; s++) {
    if (markOf(s) !== 'kro') continue;
    const here = notesOf(s) || [];
    if (!here.length) continue;                       // ติดเครื่องหมายไว้บนช่องว่าง — ไม่มีอะไรให้กรอ
    let end = total;
    for (let k = s + 1; k < total; k++) { if ((notesOf(k) || []).length) { end = k; break; } }
    const sorted = [...here].sort((a, b) => pitchOf(a) - pitchOf(b));
    const low = sorted[0], high = sorted[sorted.length - 1];
    out.push({ start: s, end, low, high, single: sorted.length === 1 || pitchOf(low) === pitchOf(high) });
  }
  return out;
}

/* ───────── ตารางการตีของกรอหนึ่งช่วง ─────────
   dur = ความยาวช่วง (วินาที) · gap = ระยะห่างระหว่างไม้ที่อยากได้ (วินาที · ยิ่งน้อยยิ่งถี่)
   กฎ: ไม้แรก = เสียงต่ำ · ไม้สุดท้าย = เสียงสูง → จำนวนไม้ต้องเป็นเลขคู่ อย่างน้อย 2 ไม้
   ระยะห่างจริงถูกยืด/หดให้ลงตัวพอดีกับช่วง (ไม่ล้นไปทับโน้ตตัวถัดไป)
   คืน [{t, note, vel, hand}] · t นับจากต้นช่วง                                              */
export const KRO_GAP_DEFAULT = 0.07;
export function kroStrikes({ dur, gap = KRO_GAP_DEFAULT, low, high, vel = 1 }) {
  if (!(dur > 0) || !low || !high) return [];
  let n = Math.round(dur / Math.max(0.02, gap));
  if (n % 2) n++;                       // ทำให้เป็นเลขคู่ ไม้สุดท้ายจะได้เป็นเสียงสูง
  n = Math.max(2, n);
  const step = dur / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const isLow = i % 2 === 0;
    out.push({ t: i * step, note: isLow ? low : high, vel: i === 0 ? vel : vel * 0.85, hand: isLow ? 'low' : 'high' });
  }
  return out;
}
// ความยาวเสียงประคบ (วินาที) — กด/ประคบให้สั้น ไม่ปล่อยกังวาน
export const DAMP_DUR_DEFAULT = 0.09;



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

/* ───────── วรรค = {sec, nl, cells:[{r:[],l:[],x:[]}]} ─────────
   บรรทัดของกระดาน = "แนว" (hand) มีได้ถึง 3: r · l · x  (ระบบบันทึกกำหนดว่าใช้กี่แนว — lib/notation-systems.js)
     ทำนองรวม 1 บรรทัด  → r
     สองมือ            → r (บน/ขวา) · l (ล่าง/ซ้าย)
     ขิม 3 บรรทัด      → r (สูง หย่องซ้าย) · l (กลาง) · x (ต่ำ หย่องขวา)
   โค้ดเก่าที่อ่าน c.r / c.l ยังทำงานได้เหมือนเดิม — c.x เพิ่งเพิ่ม (2026-08-26) ค่าปริยายเป็น []            */
export const HANDS = ['r', 'l', 'x'];
export const cellNotes = c => [...(c.r || []), ...(c.l || []), ...(c.x || [])];
export const cellFirst = c => (c.r && c.r.length) ? c.r : (c.l && c.l.length) ? c.l : (c.x || []);
export function mkVerse(sec, hong, nl = false) {
  return { sec, nl: !!nl, cells: Array.from({ length: hong * 4 }, () => ({ r: [], l: [], x: [] })) };
}
export const hongOf   = v => v.cells.length / 4;
export const hasSound = v => v.cells.some(c => cellNotes(c).length);
const cellOn = c => cellNotes(c).length ? 'X' : '-';

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
    const c = v.cells[i], src = cellFirst(c);
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
  const LN = (G || []).map(l => l || []);
  const nL = Math.max(1, LN.length);
  const total = Math.max(0, ...LN.map(l => l.length));
  const at = (li, s) => (LN[li] && LN[li][s]) || [];
  const consumed = Array.from({ length: nL }, () => new Array(total).fill(false));
  const runs = new Map();
  for (let s = 0; s < total; s++) {
    for (let li = 0; li < nL; li++) {
      const cell = at(li, s);
      if (cell.length < 2) continue;
      let lead = [], leadStep = -1, leadHand = -1;
      if (s > 0) {
        if (at(li, s - 1).length === 1 && !consumed[li][s - 1]) {
          lead = at(li, s - 1); consumed[li][s - 1] = true; leadStep = s - 1; leadHand = li;
        } else {
          // ไม่มีตัวนำในแนวเดียวกัน → ยืมจากแนวอื่นที่ช่องคู่ว่าง (แนวถัดไปก่อน)
          for (let d = 1; d < nL; d++) {
            const lj = (li + d) % nL;
            if (at(lj, s).length === 0 && at(lj, s - 1).length === 1 && !consumed[lj][s - 1]) {
              lead = at(lj, s - 1); consumed[lj][s - 1] = true; leadStep = s - 1; leadHand = lj; break;
            }
          }
        }
      }
      runs.set(li * total + s, { notes: [...lead, ...cell], leadStep, leadHand, hand: li, step: s });
    }
  }
  return { total, nL, runs, consumed, at };
}
// ตารางเวลาเล่น: คืน [{t, note, vel}] · t สัมพัทธ์จาก 0 · stepDur = วินาทีต่อตำแหน่ง
export function scheduleNotes(G, { fromStep = 0, stepDur = 0.25, gap = SABAT_GAP_DEFAULT } = {}) {
  const { total, nL, runs, consumed, at } = buildVoices(G);
  const out = [];
  for (let s = fromStep; s < total; s++) {
    const t = (s - fromStep) * stepDur;
    for (let li = 0; li < nL; li++) {
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
    const rh = parseHand(r.right_hand), lh = parseHand(r.left_hand), xh = parseHand(r.third_hand), cb = parseHand(r.combined);
    const useHands = rh.length || lh.length || xh.length;
    const len = Math.max(rh.length, lh.length, xh.length, cb.length, 4);
    const v = mkVerse(r.section || 'ท่อน 1', Math.ceil(len / 4));
    for (let i = 0; i < v.cells.length; i++) {
      if (useHands) { v.cells[i].r = rh[i] || []; v.cells[i].l = lh[i] || []; v.cells[i].x = xh[i] || []; }
      else v.cells[i].r = cb[i] || [];
    }
    if (hasLine) { v.nl = r.line_no !== lastLine; lastLine = r.line_no; }
    else { v.nl = count % 2 === 0; }
    count++;
    if (r.level) v.level = r.level;                       // อัตราชั้นของท่อนนี้ (เพลงเถา)
    if (r.ching) v.ching = [...r.ching].map(c => c === 'ฉ' ? 'ฉิ่ง' : c === 'บ' ? 'ฉับ' : '');  // ฉิ่งกำหนดเอง
    if (r.marks) applyMarksText(v, r.marks);                                                   // กรอ / ประคบ
    return v;
  });
}
export function versesToRows(verses, { twoHands = false, lines = null, system = null } = {}) {
  // lines = จำนวนแนวที่บันทึก (1/2/3) — ไม่ส่งมาก็อนุมานจาก twoHands หรือจากโน้ตจริง
  const nL = lines ?? (verses.some(v => v.cells.some(c => (c.x || []).length)) ? 3 : (twoHands ? 2 : 1));
  const rows = [];
  let line = 0;
  verses.forEach((v, i) => {
    if (!hasSound(v)) return;
    if (v.nl || i === 0) line++;
    const R = v.cells.map(c => c.r), L = v.cells.map(c => c.l || []), X = v.cells.map(c => c.x || []);
    const combined = v.cells.map(cellFirst);   // แนวบนก่อน ว่างจึงใช้แนวถัดไป
    rows.push({
      verse_no: rows.length + 1,
      section: v.sec || null,
      line_no: line,
      notation_system: system || null,
      combined: formatHand(combined),
      right_hand: nL >= 2 ? formatHand(R) : null,
      left_hand:  nL >= 2 ? formatHand(L) : null,
      third_hand: nL >= 3 ? formatHand(X) : null,
      krasuan: verseCode(v),
      luktok: (luktokOf(v) || {}).ch || null,
      level: v.level || null,
      ching: (v.ching && v.ching.some(Boolean))
        ? v.ching.map(c => c === 'ฉิ่ง' ? 'ฉ' : c === 'ฉับ' ? 'บ' : '-').join('') : null,
      marks: marksToText(v),
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
    const mh = line.match(/^(?:ว\.?\s*\d+\s*)?([RLX])\s*[:.]\s*/i);
    if (mh) { hand = mh[1].toUpperCase(); line = line.slice(mh[0].length); }
    else line = line.replace(/^ว\.?\s*\d+\s*[:.]?\s*/i, '');
    line = line.replace(/\[[A-Z?]+\]\s*$/, '').replace(/←.*$/, '').trim();
    if (!line || !looksLikeNotation(line)) return;
    const hongs = lineToHongs(line);
    if (!hongs.length) return;
    if ((hand === 'L' || hand === 'X') && pendingR) {
      const key = hand === 'L' ? 'l' : 'x';
      // มือซ้ายของวรรคชุดที่เพิ่งอ่านมือขวาไป
      let at = 0;
      pendingR.forEach(v => {
        for (let h = 0; h < hongOf(v); h++) {
          const src = hongs[at + h];
          if (src) for (let p = 0; p < 4; p++) v.cells[h * 4 + p][key] = src[p] || [];
        }
        at += hongOf(v);
      });
      if (hand === 'X') pendingR = null;   // X มาหลัง L เสมอ — ปิดกลุ่มเมื่อเจอ X
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
export function versesToText(verses, { twoHands = false, lines: nLines = null } = {}) {
  const nL = nLines ?? (verses.some(v => v.cells.some(c => (c.x || []).length)) ? 3 : (twoHands ? 2 : 1));
  const lines = [];
  let lastSec = null;
  verses.forEach((v, i) => {
    if (!hasSound(v)) return;
    if (v.sec !== lastSec) { lines.push('# ' + v.sec); lastSec = v.sec; }
    const n = 'ว.' + (i + 1);
    if (nL >= 2) {
      lines.push(n + ' R: ' + formatHand(v.cells.map(c => c.r)));
      lines.push(' '.repeat(n.length) + ' L: ' + formatHand(v.cells.map(c => c.l || [])));
      if (nL >= 3) lines.push(' '.repeat(n.length) + ' X: ' + formatHand(v.cells.map(c => c.x || [])));
    } else {
      lines.push(n + '  ' + formatHand(v.cells.map(cellFirst)) + '   [' + verseCode(v) + ']');
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
      if (c.r.length > 1 || (c.l || []).length > 1 || (c.x || []).length > 1) sab.push('ว.' + (vi + 1) + '/ห้อง ' + (h + 1));
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
    v.cells.forEach(c => notes += cellNotes(c).length);
  });
  return { verses: used.length, hongs, notes, unique: new Set(used.map(verseCode)).size,
    top: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6) };
}

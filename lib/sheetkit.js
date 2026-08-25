// lib/sheetkit.js — เครื่องเรนเดอร์ Music Sheet ของ THMA
//
// วาดโน้ตลงหน้ากระดาษจริง (A4 / A5 / B5 / Letter · ตั้ง-นอน) บน canvas
// แบ่งหน้าอัตโนมัติ คุมระยะขอบและช่องไฟให้พอดี ไม่มีทางล้นกรอบ
// รองรับ: โน้ตไทยบรรทัดเดียว (ทำนองรวม) · โน้ตไทยสองมือ (ขวา/ซ้าย)
//         · โน้ตสากล 5 เส้น (ผ่าน VexFlow — ตัวเดียวกับที่หน้าเพลงใช้)
// ลายน้ำ: "THMA · thaimusicarchive.com" ทแยงจาง ๆ ทุกหน้า (แอดมินปิดได้ที่ UI)
//
// ใช้จาก components/SheetExport.js — ไฟล์นี้เป็นตรรกะล้วน ทดสอบแยกได้

/* ─── กระดาษ (มม.) ─── */
export const PAPERS = {
  A4:     { name: 'A4',     w: 210, h: 297 },
  A5:     { name: 'A5',     w: 148, h: 210 },
  B5:     { name: 'B5',     w: 176, h: 250 },
  Letter: { name: 'Letter', w: 216, h: 279 },
};
const MM = 96 / 25.4;                       // มม. → พิกเซลตรรกะ (96dpi)

/* ─── โน้ต ─── */
const NOTE_STEP = { 'ด':0,'ร':1,'ม':2,'ฟ':3,'ซ':4,'ล':5,'ท':6 };
const LOW = 'ฺ', HIGH = 'ํ';
const TH_COLS = ['ด','ร','ม','ฟ','ซ','ล','ท'];
const TH_ROWS = { '-1':'zxcvbnm', '0':'asdfghj', '1':'qwertyu' };

export function parseVerseText(str) {       // เหมือน parseVerse ของเครื่องเล่น
  if (!str) return [];
  const out = [];
  for (const hong of str.split('|')) {
    const toks = hong.trim().split(/\s+/).filter(t => t.length);
    if (!toks.length) continue;
    const cells = toks.map(t => {
      if (t === '-') return [];
      const notes = [];
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (NOTE_STEP[ch] == null) continue;
        let reg = 0;
        if (t[i+1] === LOW) { reg = -1; i++; } else if (t[i+1] === HIGH) { reg = 1; i++; }
        notes.push({ ch, register: reg });
      }
      return notes;
    });
    while (cells.length < 4) cells.push([]);
    out.push(...cells.slice(0, 4));
  }
  return out;
}

const noteGlyphKey = n => TH_ROWS[String(n.register ?? 0)]?.[TH_COLS.indexOf(n.ch)] ?? n.ch;
const noteGlyphThai = n => n.ch + (n.register === 1 ? HIGH : n.register === -1 ? LOW : '');
export function cellGlyph(cell, font) {
  if (!cell || !cell.length) return '-';
  return cell.map(font === 'notation' ? noteGlyphKey : noteGlyphThai).join('');
}

/* ─── เตรียมข้อมูล: แถว song_melody → บรรทัดพร้อมแบ่งหน้า ─── */
export function prepare(verses, { hongsPerLine = 8 } = {}) {
  const vs = (verses ?? []).map(v => {
    const cb = parseVerseText(v.combined);
    const rh = parseVerseText(v.right_hand);
    const lh = parseVerseText(v.left_hand);
    const len = Math.max(cb.length, rh.length, lh.length, 4);
    const pad = a => { const o = a.slice(); while (o.length < len) o.push([]); return o; };
    return { v, len, cb: pad(cb), rh: pad(rh), lh: pad(lh),
             twoHands: !!((v.right_hand ?? '').trim() || (v.left_hand ?? '').trim()) };
  });
  // จัดวรรคลงบรรทัดตามจำนวนห้อง · ท่อนใหม่ขึ้นบรรทัดใหม่เสมอ
  const lines = [];
  let cur = null, curHongs = 0, lastSec = undefined;
  vs.forEach((pv, vi) => {
    const sec = pv.v.section ?? null;
    const h = pv.len / 4;
    if (!cur || sec !== lastSec || curHongs + h > hongsPerLine) {
      cur = { sec, secStart: sec !== lastSec, verses: [] , hongs: 0 };
      lines.push(cur); curHongs = 0; lastSec = sec;
    }
    cur.verses.push({ ...pv, vi }); cur.hongs = (curHongs += h);
  });
  return { vs, lines, twoHands: vs.some(x => x.twoHands) };
}

/* ─── เลย์เอาต์หน้า ─── */
export function pageGeometry(opt) {
  const p = PAPERS[opt.paper] ?? PAPERS.A4;
  const wmm = opt.orientation === 'landscape' ? p.h : p.w;
  const hmm = opt.orientation === 'landscape' ? p.w : p.h;
  const W = Math.round(wmm * MM), H = Math.round(hmm * MM);
  const margin = Math.round((opt.marginMm ?? 16) * MM);
  return { W, H, margin, contentW: W - margin * 2, contentH: H - margin * 2, wmm, hmm };
}

export function autoHongs(opt) {
  const { contentW } = pageGeometry(opt);
  // ช่องหนึ่งอย่างน้อย ~7.2มม. จึงอ่านสบาย · เลือก 4/8/16 ที่มากสุดที่ยังพอดี
  for (const h of [16, 8, 4]) if (contentW / (h * 4) >= 5.2 * MM) return h;
  return 4;
}

/* ─── วาดส่วนประกอบร่วม ─── */
const THAI_FONT = "'Noto Sans Thai','TH Sarabun New',sans-serif";
const SERIF = "'Noto Serif Thai','Noto Sans Thai',serif";

export function drawHeader(ctx, g, opt, pageNo, pageCount) {
  const { margin, contentW } = g;
  let y = margin;
  ctx.fillStyle = '#111'; ctx.textBaseline = 'alphabetic';
  if (pageNo === 1) {
    if (opt.header.title) {
      ctx.font = `700 ${Math.round(g.W * 0.032)}px ${SERIF}`; ctx.textAlign = 'center';
      y += g.W * 0.033;
      ctx.fillText(opt.header.title, g.W / 2, y);
    }
    if (opt.header.subtitle) {
      ctx.font = `400 ${Math.round(g.W * 0.019)}px ${THAI_FONT}`; ctx.fillStyle = '#444';
      y += g.W * 0.028;
      ctx.fillText(opt.header.subtitle, g.W / 2, y);
    }
    const meta = Math.round(g.W * 0.0165);
    ctx.font = `400 ${meta}px ${THAI_FONT}`; ctx.fillStyle = '#555';
    y += g.W * 0.030;
    if (opt.header.left)  { ctx.textAlign = 'left';  ctx.fillText(opt.header.left,  margin, y); }
    if (opt.header.right) { ctx.textAlign = 'right'; ctx.fillText(opt.header.right, g.W - margin, y); }
    if (opt.header.left || opt.header.right) y += g.W * 0.010;
    ctx.strokeStyle = '#B08D2F'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(g.W - margin, y); ctx.stroke();
    y += g.W * 0.012;
  } else {
    ctx.font = `400 ${Math.round(g.W * 0.015)}px ${THAI_FONT}`; ctx.fillStyle = '#666';
    ctx.textAlign = 'left'; y += g.W * 0.012;
    ctx.fillText(opt.header.title ?? '', margin, y);
    y += g.W * 0.012;
  }
  return y;    // จุดเริ่มเนื้อหา
}

export function drawFooter(ctx, g, opt, pageNo, pageCount) {
  const y = g.H - g.margin * 0.45;
  ctx.font = `400 ${Math.round(g.W * 0.0135)}px ${THAI_FONT}`;
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.fillText(`หน้า ${pageNo} / ${pageCount}`, g.W / 2, y);
  ctx.textAlign = 'right';
  ctx.fillText('thaimusicarchive.com', g.W - g.margin, y);
  if (opt.footerLeft) { ctx.textAlign = 'left'; ctx.fillText(opt.footerLeft, g.margin, y); }
}

export function drawWatermark(ctx, g) {
  ctx.save();
  ctx.translate(g.W / 2, g.H / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = '#1E3050';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const big = Math.round(g.W * 0.088);
  ctx.font = `700 ${big}px ${SERIF}`;
  ctx.fillText('THMA', 0, -big * 0.42);
  ctx.font = `500 ${Math.round(big * 0.34)}px ${THAI_FONT}`;
  ctx.fillText('thaimusicarchive.com', 0, big * 0.34);
  // วงแหวนโลโก้
  ctx.lineWidth = Math.max(2, g.W * 0.004); ctx.strokeStyle = '#1E3050';
  ctx.beginPath(); ctx.arc(0, 0, g.W * 0.19, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, g.W * 0.145, 0, Math.PI * 2);
  ctx.setLineDash([6, 8]); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

/* ─── โน้ตไทย: วัดและวาด ─── */
export function thaiMetrics(g, opt, hongs) {
  const labelW = opt.handMode === 'hands' ? Math.round(g.W * 0.030) : 0;
  const gridW = g.contentW - labelW;
  const cellW = gridW / (hongs * 4);
  const noteSize = Math.min(cellW * (opt.font === 'notation' ? 0.78 : 0.66), g.W * 0.022);
  const rowH = noteSize * 2.05;                       // สูงพอสำหรับจุดบน-ล่าง
  const lineGap = noteSize * (opt.handMode === 'hands' ? 0.9 : 1.15) * (opt.spacingF ?? 1);
  const secH = noteSize * 1.9;
  return { labelW, gridW, cellW, noteSize, rowH, lineGap, secH };
}

function drawNoteRow(ctx, x0, y, cells, m, opt) {
  const fontName = opt.font === 'notation' ? "'THNotation'" : THAI_FONT;
  ctx.font = `400 ${m.noteSize}px ${fontName}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  cells.forEach((cell, i) => {
    const g = cellGlyph(cell, opt.font);
    const cx = x0 + i * m.cellW + m.cellW / 2;
    ctx.fillStyle = g === '-' ? '#B9B9B9' : '#111';
    if (g.length > (opt.font === 'notation' ? 2 : 3)) {   // สะบัดหลายตัว บีบให้พอดีช่อง
      ctx.save();
      const w = ctx.measureText(g).width;
      if (w > m.cellW * 0.94) { ctx.translate(cx, 0); ctx.scale(m.cellW * 0.94 / w, 1); ctx.translate(-cx, 0); }
      ctx.fillText(g, cx, y); ctx.restore();
    } else ctx.fillText(g, cx, y);
  });
}

function drawBars(ctx, x0, yTop, yBot, nCells, m) {
  // เส้นห้องบาง เฉพาะรอยต่อภายในวรรค (ขอบวรรควาดเส้นหนักแยกใน drawThaiPage)
  ctx.strokeStyle = '#C9CFD8'; ctx.lineWidth = 1;
  for (let i = 4; i < nCells; i += 4) {
    const x = x0 + i * m.cellW;
    ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke();
  }
}
function heavyBar(ctx, x, yTop, yBot) {
  ctx.strokeStyle = '#8A94A6'; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke();
}

/* คำนวณแบ่งหน้า + วาดหนึ่งหน้า (โน้ตไทย) */
export function paginateThai(prep, g, opt) {
  const hongs = opt.hongsPerLine;
  const m = thaiMetrics(g, opt, hongs);
  const two = opt.handMode === 'hands';
  const lineH = (two ? m.rowH * 2 + 2 : m.rowH) + m.lineGap;
  const pages = []; let page = { items: [] };
  // ประเมินความสูงเริ่มเนื้อหาแบบเดียวกับ drawHeader
  const startY1 = g.margin + g.W * (opt.header.subtitle ? 0.115 : 0.095);
  const startYn = g.margin + g.W * 0.03;
  let y = startY1;
  const bottom = g.H - g.margin * 1.25;
  prep.lines.forEach(line => {
    let need = lineH + (line.secStart && line.sec ? m.secH : 0);
    if (y + need > bottom && page.items.length) {
      pages.push(page); page = { items: [] }; y = startYn;
    }
    if (line.secStart && line.sec) { page.items.push({ kind: 'sec', y, sec: line.sec }); y += m.secH; }
    page.items.push({ kind: 'line', y, line });
    y += lineH;
  });
  if (page.items.length) pages.push(page);
  return { pages, m, lineH, two };
}

export function drawThaiPage(ctx, g, opt, layout, pageIdx, pageCount) {
  const { m, two } = layout;
  const page = layout.pages[pageIdx];
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, g.W, g.H);
  if (opt.watermark) drawWatermark(ctx, g);
  drawHeader(ctx, g, opt, pageIdx + 1, pageCount);
  drawFooter(ctx, g, opt, pageIdx + 1, pageCount);
  page.items.forEach(it => {
    if (it.kind === 'sec') {
      ctx.font = `600 ${m.noteSize * 0.92}px ${THAI_FONT}`;
      ctx.fillStyle = '#8A6D1F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const ty = it.y + m.secH * 0.55;
      const tw = ctx.measureText(it.sec).width;
      ctx.fillText(it.sec, g.W / 2, ty);
      ctx.strokeStyle = '#D8C88F'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.margin, ty); ctx.lineTo(g.W/2 - tw/2 - 12, ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.W/2 + tw/2 + 12, ty); ctx.lineTo(g.W - g.margin, ty); ctx.stroke();
      return;
    }
    const line = it.line;
    let x = g.margin + m.labelW;
    const yMid1 = it.y + m.rowH / 2;
    if (two) {
      ctx.font = `500 ${m.noteSize * 0.5}px ${THAI_FONT}`;
      ctx.fillStyle = '#9AA'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('ขวา', g.margin, yMid1);
      ctx.fillText('ซ้าย', g.margin, it.y + m.rowH * 1.5);
    }
    const yTop = two ? it.y + m.rowH * 0.1 : it.y + m.rowH * 0.08;
    const yBot = two ? it.y + m.rowH * 1.9 : it.y + m.rowH * 0.92;
    heavyBar(ctx, x, yTop, yBot);                      // ขอบซ้ายของบรรทัด
    line.verses.forEach(pv => {
      const n = pv.len;
      if (two) {
        drawNoteRow(ctx, x, yMid1, pv.rh.length ? pv.rh : pv.cb, m, opt);
        drawNoteRow(ctx, x, it.y + m.rowH * 1.5, pv.lh, m, opt);
      } else {
        drawNoteRow(ctx, x, yMid1, pv.cb, m, opt);
      }
      drawBars(ctx, x, yTop, yBot, n, m);
      x += n * m.cellW;
      heavyBar(ctx, x, yTop, yBot);                    // ขอบวรรค (เส้นหนักกว่าเส้นห้อง)
    });
  });
}

/* ═══ โน้ตสากล 5 เส้น (VexFlow — ไลบรารีเดียวกับหน้าเพลง) ═══ */
const THAI_TO_WESTERN = { 'ด':'c','ร':'d','ม':'e','ฟ':'f','ซ':'g','ล':'a','ท':'b' };
const PITCH_ORDER = { c:0,d:1,e:2,f:3,g:4,a:5,b:6 };
const wKey = n => `${THAI_TO_WESTERN[n.ch] ?? 'c'}/${4 + (n.register ?? 0)}`;
const wPitch = k => { const [b,o] = k.split('/'); return (+o) * 7 + (PITCH_ORDER[b] ?? 0); };
function mergeHandsW(rh, lh) {
  const keys = [...new Set([...(lh ?? []), ...(rh ?? [])].map(wKey))];
  keys.sort((a, b) => wPitch(a) - wPitch(b));
  return keys.length ? keys : ['b/4'];
}
function makeSlices(len, beat) {          // thai: ตกท้ายห้อง [4,4,..] · western: [3,4,..,1]
  const s = [];
  if (beat === 'western') {
    let start = 0; const first = Math.min(3, len);
    if (first > 0) { s.push({ start: 0, size: first }); start = first; }
    while (start < len) { const size = Math.min(4, len - start); s.push({ start, size }); start += size; }
  } else for (let start = 0; start < len; start += 4) s.push({ start, size: Math.min(4, len - start) });
  return s;
}
function sliceEvents(pos, slice) {
  const ev = []; let p = 0; const S = slice.size;
  const at = i => pos[slice.start + i] ?? [];
  while (p < S) {
    const notes = at(p); let span = 1;
    while (p + span < S && at(p + span).length === 0) span++;
    ev.push(notes.length ? { notes, units: span, pos: slice.start + p } : { rest: true, units: span, pos: slice.start + p });
    p += span;
  }
  return ev;
}
const UNIT_DUR = { 1:'8', 2:'q', 3:'qd', 4:'h' };

export function prepareStaff(verses, { source = 'combined', beat = 'thai', measuresPerLine = 8 } = {}) {
  const prepared = (verses ?? []).map((v, vi) => {
    let positions, handPos = null;
    if (source === 'hands' && ((v.right_hand ?? '').trim() || (v.left_hand ?? '').trim())) {
      const rh = parseVerseText(v.right_hand), lh = parseVerseText(v.left_hand);
      const len = Math.max(rh.length, lh.length);
      handPos = Array.from({ length: len }, (_, i) => ({ rh: rh[i] ?? [], lh: lh[i] ?? [] }));
      positions = handPos.map(hp => [...hp.rh, ...hp.lh]);
    } else positions = parseVerseText(v.combined);
    return { vi, v, positions, handPos, slices: makeSlices(positions.length, beat) };
  });
  // จัดวรรคลงบรรทัด ~measuresPerLine ห้อง · ท่อนใหม่ขึ้นบรรทัดใหม่
  const lines = []; let cur = null, count = 0, lastSec;
  prepared.forEach(pv => {
    const sec = pv.v.section ?? null;
    if (!cur || sec !== lastSec || count + pv.slices.length > measuresPerLine + 1) {
      cur = { sec, secStart: sec !== lastSec, verses: [] };
      lines.push(cur); count = 0; lastSec = sec;
    }
    cur.verses.push(pv); count += pv.slices.length;
  });
  return { lines };
}

export const STAFF = { ROW_H: 112, STAVE_IN: 26, CLEF_PAD: 56, SEC_H: 34 };

export function paginateStaff(prepS, g, opt) {
  // โน้ตต่ำกว่ากลาง (มีเส้นน้อยใต้บรรทัด) ต้องการที่ว่างข้างล่างเพิ่ม ไม่งั้นชนบรรทัดถัดไป
  const hasLow = prepS.lines.some(l => l.verses.some(pv =>
    pv.positions.some(cell => cell.some(n => (n.register ?? 0) < 0))));
  const rowH = (STAFF.ROW_H + (hasLow ? 30 : 8)) * (opt.spacingF ?? 1);
  const startY1 = g.margin + g.W * (opt.header.subtitle ? 0.115 : 0.095);
  const startYn = g.margin + g.W * 0.03;
  const bottom = g.H - g.margin * 1.25;
  const pages = []; let page = { items: [] }; let y = startY1; let gi = 0;
  prepS.lines.forEach(line => {
    const need = rowH + (line.secStart && line.sec ? STAFF.SEC_H : 0);
    if (y + need > bottom && page.items.length) { pages.push(page); page = { items: [] }; y = startYn; }
    if (line.secStart && line.sec) { page.items.push({ kind: 'sec', y, sec: line.sec }); y += STAFF.SEC_H; }
    page.items.push({ kind: 'line', y, line, gi: gi++ });
    y += rowH;
  });
  if (page.items.length) pages.push(page);
  return { pages, rowH };
}

// วาดหนึ่งหน้าโน้ตสากลลง canvas (VF = window.Vex.Flow) · scale = ความคมชัด
export function drawStaffPage(VF, canvas, g, opt, layout, pageIdx, pageCount, scale = 2) {
  const renderer = new VF.Renderer(canvas, VF.Renderer.Backends.CANVAS);
  renderer.resize(g.W * scale, g.H * scale);
  const raw = canvas.getContext('2d');
  raw.save(); raw.scale(scale, scale);
  raw.fillStyle = '#FFFFFF'; raw.fillRect(0, 0, g.W, g.H);
  if (opt.watermark) drawWatermark(raw, g);
  drawHeader(raw, g, opt, pageIdx + 1, pageCount);
  drawFooter(raw, g, opt, pageIdx + 1, pageCount);
  const page = layout.pages[pageIdx];
  page.items.forEach(it => {
    if (it.kind !== 'sec') return;
    raw.font = `600 ${Math.round(g.W * 0.016)}px ${THAI_FONT}`;
    raw.fillStyle = '#8A6D1F'; raw.textAlign = 'center'; raw.textBaseline = 'middle';
    const ty = it.y + STAFF.SEC_H * 0.55;
    const tw = raw.measureText(it.sec).width;
    raw.fillText(it.sec, g.W / 2, ty);
    raw.strokeStyle = '#D8C88F'; raw.lineWidth = 1;
    raw.beginPath(); raw.moveTo(g.margin, ty); raw.lineTo(g.W/2 - tw/2 - 12, ty); raw.stroke();
    raw.beginPath(); raw.moveTo(g.W/2 + tw/2 + 12, ty); raw.lineTo(g.W - g.margin, ty); raw.stroke();
  });
  raw.restore();

  const ctx = renderer.getContext();
  ctx.scale(scale, scale);
  ctx.setFillStyle('#141414'); ctx.setStrokeStyle('#141414');

  page.items.forEach(it => {
    if (it.kind !== 'line') return;
    const line = it.line;
    const total = line.verses.reduce((s, pv) => s + pv.slices.length, 0);
    const mw = (g.contentW - STAFF.CLEF_PAD) / Math.max(total, 1);
    let x = g.margin, first = true;
    const staveY = it.y + STAFF.STAVE_IN;
    line.verses.forEach(pv => {
      pv.slices.forEach(slice => {
        const w = mw + (first ? STAFF.CLEF_PAD : 0);
        const stave = new VF.Stave(x, staveY, w);
        if (first) { stave.addClef('treble'); if (it.gi === 0) stave.addTimeSignature('2/4'); }
        stave.setContext(ctx).draw();
        const events = sliceEvents(pv.positions, slice);
        const vexNotes = [];
        events.forEach(ev => {
          let dur = UNIT_DUR[ev.units] ?? '8';
          const dotted = dur.endsWith('d'); if (dotted) dur = dur[0];
          const mk = (keys, d) => { const n = new VF.StaveNote({ keys, duration: d }); if (dotted && d === dur) VF.Dot.buildAndAttach([n], { all: true }); return n; };
          if (ev.rest) vexNotes.push(mk(['b/4'], dur + 'r'));
          else if (pv.handPos && pv.handPos[ev.pos].rh.length <= 1 && pv.handPos[ev.pos].lh.length <= 1)
            vexNotes.push(mk(mergeHandsW(pv.handPos[ev.pos].rh, pv.handPos[ev.pos].lh), dur));
          else if (ev.notes.length === 1) vexNotes.push(mk([wKey(ev.notes[0])], dur));
          else {                                            // สะบัด: โน้ตเขบ็จสองชั้นนำเข้าโน้ตลง
            ev.notes.slice(0, 2).forEach(n => vexNotes.push(new VF.StaveNote({ keys: [wKey(n)], duration: '16' })));
            if (ev.units >= 2) vexNotes.push(new VF.StaveNote({
              keys: [wKey(ev.notes[ev.notes.length - 1])], duration: ev.units === 2 ? '8' : 'q' }));
          }
        });
        try {
          const voice = new VF.Voice({ num_beats: 2, beat_value: 4 }).setStrict(false);
          voice.addTickables(vexNotes);
          new VF.Formatter().joinVoices([voice]).format([voice], w - (first ? STAFF.CLEF_PAD : 0) - 24);
          const beams = VF.Beam.generateBeams(vexNotes.filter(n => !n.isRest()));
          voice.draw(ctx, stave);
          beams.forEach(b => b.setContext(ctx).draw());
        } catch (e) { /* ห้องที่จัดไม่ได้ ข้าม */ }
        x += w; first = false;
      });
    });
  });
}

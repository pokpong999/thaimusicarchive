// lib/videoexport.js — อัดโน้ตเป็นวิดีโอคาราโอเกะ (Pk 1 ก.ย. 69)
//
//   โน้ตไทยเลื่อนขึ้นทีละบรรทัด มีไฟวิ่งตามตำแหน่งที่กำลังบรรเลง
//   ภาพ 1920×1080 (YouTube / จอคอม) · สีตามธีมเครื่องเล่นที่ผู้ใช้เลือกอยู่
//
//   ★ งานทั้งหมดเกิดในเครื่องของคนกด ไม่แตะเซิร์ฟเวอร์ ไม่มีค่าใช้จ่าย
//   ★ เสียงในวิดีโอ = ไฟล์เสียงที่อัดด้วย OfflineAudioContext ชุดเดียวกับ WAV/MP3
//     (ไม่มีตรรกะโน้ตชุดที่สอง) — วิดีโอแค่ "เล่นเสียงนั้นแล้ววาดภาพตาม"
//   ★ การอัดวิดีโอเร่งไม่ได้ (MediaRecorder เดินตามเวลาจริง) เพลง 5 นาที = รอ 5 นาที
//
//   ส่วนที่เป็นฟังก์ชันล้วน (ทดสอบใน Node ได้): splitLines · layoutSheet · cursorAt · pickVideoMime(list)
//   ส่วนที่ต้องใช้เบราว์เซอร์: makePainter (canvas 2D) · recordVideo (MediaRecorder)

export const VIDEO_W = 1920, VIDEO_H = 1080;
export const MAX_HONGS_PER_LINE = 8;          // บรรทัดยาวกว่านี้ตัวโน้ตเล็กเกินอ่านบนจอ

import { CancelledError } from './audioexport';
export { CancelledError };

// ── เลือกชนิดไฟล์ที่เบราว์เซอร์นี้ทำได้ ─────────────────────────
// ลำดับ: MP4 H.264+AAC (เปิดได้ทุกเครื่อง รวม iPhone/ไลน์) → MP4 อื่น → WebM
// YouTube รับทุกแบบในรายการนี้
export const VIDEO_MIMES = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4', label: 'MP4 (H.264/AAC)', universal: true },
  { mime: 'video/mp4;codecs=avc1.4D401F,mp4a.40.2', ext: 'mp4', label: 'MP4 (H.264/AAC)', universal: true },
  { mime: 'video/mp4;codecs=avc1,mp4a.40.2',        ext: 'mp4', label: 'MP4 (H.264/AAC)', universal: true },
  { mime: 'video/mp4;codecs=avc1,opus',             ext: 'mp4', label: 'MP4 (H.264/Opus)', universal: false },
  { mime: 'video/mp4;codecs=vp9,opus',              ext: 'mp4', label: 'MP4 (VP9/Opus)', universal: false },
  { mime: 'video/mp4',                              ext: 'mp4', label: 'MP4', universal: false },
  { mime: 'video/webm;codecs=vp9,opus',             ext: 'webm', label: 'WebM (VP9/Opus)', universal: false },
  { mime: 'video/webm;codecs=vp8,opus',             ext: 'webm', label: 'WebM (VP8/Opus)', universal: false },
  { mime: 'video/webm',                             ext: 'webm', label: 'WebM', universal: false },
];
export function pickVideoMime(isSupported) {
  const ok = isSupported || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
    ? m => MediaRecorder.isTypeSupported(m) : () => false);
  return VIDEO_MIMES.find(v => { try { return !!ok(v.mime); } catch (e) { return false; } }) || null;
}
export function canRecordVideo() {
  if (typeof window === 'undefined') return false;
  return typeof MediaRecorder !== 'undefined' && !!document.createElement('canvas').captureStream
    && !!pickVideoMime();
}

// ── ตัดบรรทัดที่ยาวเกิน ────────────────────────────────────────
// sheet.lines[i] = { sec, label, hongs, verses:[{vi, hongs}], rows:[{label, cells:[...]}] }
// cell = { vi, p, text, rest, sabat, kro, damp, bar }   (bar = มีเส้นคั่นห้องนำหน้า)
// บรรทัดบนเว็บอาจกว้าง 16 ห้อง แต่บนจอวิดีโอ 8 ห้องคืออ่านออก → ตัดที่ขอบวรรค ไม่ตัดกลางวรรค
export function splitLines(lines, maxHongs = MAX_HONGS_PER_LINE) {
  const out = [];
  for (const ln of lines) {
    if (!(ln.hongs > maxHongs) || !ln.verses || ln.verses.length < 2) { out.push(ln); continue; }
    let cur = [], curH = 0, first = true;
    const flush = () => {
      if (!cur.length) return;
      const vis = new Set(cur.map(v => v.vi));
      out.push({
        ...ln,
        sec: first ? ln.sec : null,
        label: mkLabel(cur),
        hongs: curH, verses: cur,
        // ช่องแรกของบรรทัดใหม่ไม่ต้องมีเส้นคั่นนำหน้า (เส้นนั้นเคยคั่นกับวรรคที่ย้ายไปบรรทัดก่อน)
        rows: ln.rows.map(r => ({ ...r, cells: r.cells.filter(c => vis.has(c.vi)).map((c, i) => (i === 0 && c.bar ? { ...c, bar: false } : c)) })),
      });
      first = false; cur = []; curH = 0;
    };
    for (const v of ln.verses) {
      if (cur.length && curH + v.hongs > maxHongs) flush();
      cur.push(v); curH += v.hongs;
    }
    flush();
  }
  return out;
  // ป้ายแบบเดียวกับบนจอ: "วรรค 3–4 · ลูกตก ซ / ซฺ"
  function mkLabel(vs) {
    const no = v => (v.label != null ? v.label : v.vi + 1);
    const luk = vs.map(v => v.luktok).filter(Boolean).join(' / ');
    return (vs.length > 1 ? `วรรค ${no(vs[0])}–${no(vs[vs.length - 1])}` : `วรรค ${no(vs[0])}`) + (luk ? ` · ลูกตก ${luk}` : '');
  }
}

// ── จัดวางลงกรอบ 1920×1080 ──────────────────────────────────────
export function layoutSheet(sheet, { W = VIDEO_W, H = VIDEO_H, maxHongs = MAX_HONGS_PER_LINE, padX = 72 } = {}) {
  const lines = splitLines(sheet.lines || [], maxHongs);
  let cellsMax = 1, barsMax = 0, hasLabel = false, rowsMax = 1;
  for (const ln of lines) {
    for (const r of ln.rows || []) {
      if (r.label) hasLabel = true;
      const bars = r.cells.filter(c => c.bar).length;
      if (r.cells.length + bars * 0.4 > cellsMax + barsMax * 0.4) { cellsMax = r.cells.length; barsMax = bars; }
    }
    rowsMax = Math.max(rowsMax, (ln.rows || []).length);
  }
  const labelW = hasLabel ? 118 : 0;
  const avail = W - padX * 2 - labelW;
  const cellW = Math.max(26, Math.min(66, Math.floor(avail / (cellsMax + barsMax * 0.4))));
  const barW = Math.round(cellW * 0.4);
  const fontNote = Math.round(cellW * 0.74);
  const rowH = Math.round(fontNote * 1.85);
  const secTitleH = 52, secBitsH = 34, labelH = 30, gap = 26;
  let y = 0;
  const laid = lines.map((ln, li) => {
    const secH = ln.sec ? secTitleH + (ln.sec.bits ? secBitsH : 0) : 0;
    const y0 = y;
    y += secH + labelH;
    const rows = (ln.rows || []).map((r, ri) => {
      let x = padX + labelW;
      const cells = r.cells.map(c => {
        if (c.bar) x += barW;
        const cell = { ...c, x, w: cellW };
        x += cellW;
        return cell;
      });
      const ry = y; y += rowH;
      return { label: r.label || null, y: ry, cells, endX: x };
    });
    const h = y - y0 + gap;
    y += gap;
    return { ...ln, i: li, y: y0, h, secH, rows, notesY: y0 + secH + labelH };
  });
  const index = new Map();
  laid.forEach(ln => ln.rows.forEach(r => r.cells.forEach(c => {
    const k = c.vi + '-' + c.p;
    if (!index.has(k)) index.set(k, ln.i);
  })));
  return { W, H, padX, labelW, cellW, barW, fontNote, rowH, labelH, secTitleH, secBitsH,
           lines: laid, totalH: y, index, rowsMax };
}

// ── หาตำแหน่งเคอร์เซอร์ ณ เวลา t (timeline เรียงตามเวลาแล้ว) ─────
export function cursorAt(timeline, t, hint = 0) {
  if (!timeline?.length || t < timeline[0].time) return { idx: -1, cur: null };
  let i = Math.max(0, Math.min(hint, timeline.length - 1));
  if (timeline[i].time > t) { i = 0; }
  while (i + 1 < timeline.length && timeline[i + 1].time <= t) i++;
  return { idx: i, cur: timeline[i] };
}

// ── เป้าเลื่อนจอ: ให้บรรทัดที่กำลังเล่นอยู่ราว 38% จากขอบบน ────────
export function scrollTarget(L, lineIdx, topPad) {
  if (lineIdx == null || lineIdx < 0) return 0;
  const ln = L.lines[lineIdx]; if (!ln) return 0;
  // บรรทัดที่เล่นอยู่ค้างที่ 38% ของจอเสมอ — รวมบรรทัดท้าย ๆ ด้วย (ยอมให้มีที่ว่างใต้แผ่นโน้ต)
  //   ต้นเพลงยังไม่เลื่อน (บรรทัดแรกอยู่บนสุด) เพราะที่ว่างเหนือโน้ตดูแปลก
  const want = ln.notesY - L.H * 0.38 + topPad;
  return Math.max(0, want);
}

export function formatClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── สีจากธีมเครื่องเล่น (อ่านตัวแปร CSS จริงจากกล่องเครื่องเล่น) ────
export function themePalette(rootEl, theme = 'dark') {
  const cs = (typeof getComputedStyle === 'function' && rootEl) ? getComputedStyle(rootEl) : null;
  const v = (name, fb) => { const x = cs?.getPropertyValue(name)?.trim(); return x || fb; };
  const dark = theme !== 'paper' && theme !== 'hicon';
  return {
    theme,
    bg:    v('--navy3', dark ? '#1E3050' : '#FFFFFF'),
    bg2:   v('--navy2', dark ? '#162336' : '#F3F1E9'),
    bg0:   v('--navy',  dark ? '#0F1B2D' : '#FBFAF6'),
    ink:   v('--cream', dark ? '#F5F0E8' : '#12161C'),
    muted: v('--muted', dark ? '#8A9BB5' : '#5F6670'),
    gold:  v('--gold',  dark ? '#C9A84C' : '#8A6D14'),
    gold2: v('--gold2', dark ? '#E8C96A' : '#6E5510'),
    jade:  v('--jade',  dark ? '#4C9A84' : '#1F6B57'),
    border:v('--border',dark ? '#2A3F5C' : '#C6CBD3'),
    rest:  v('--np-rest', dark ? '#9FB3CE' : '#5F6670'),
    bar:   v('--np-bar',  dark ? '#43597C' : '#8A9199'),
    on:    theme === 'hicon' ? '#FFE08A' : theme === 'paper' ? 'rgba(138,109,20,0.30)' : 'rgba(201,168,76,0.45)',
    onLine: theme === 'hicon' ? 'rgba(0,0,0,0.06)' : theme === 'paper' ? 'rgba(138,109,20,0.07)' : 'rgba(201,168,76,0.08)',
    onOutline: theme === 'hicon' ? '#000' : null,
  };
}

// ── ตัววาดเฟรม ─────────────────────────────────────────────────
// meta = { title, sub, credit, site, info, leadSec, songEnd, totalSec, timeline }
//   timeline = cursorTimeline ที่เลื่อนเวลาให้เป็นวินาทีในไฟล์เสียงสุดท้ายแล้ว
export function makePainter(canvas, L, pal, meta, fonts = {}) {
  const g = canvas.getContext('2d');
  const W = L.W, H = L.H;
  const noteFont = fonts.note || 'THNotation';
  const textFont = fonts.text || "'Noto Sans Thai', 'Noto Sans', 'Segoe UI', Tahoma, sans-serif";
  const serifFont = fonts.serif || "'Noto Serif Thai', 'Noto Serif', Georgia, serif";
  const topPad = 56;
  let scrollY = 0, lastT = null, hint = 0, lastLine = -1;

  function roundRect(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function wave(x, y, w) {
    g.beginPath();
    const step = 7; let cx = x;
    g.moveTo(cx, y);
    while (cx + step <= x + w) { g.quadraticCurveTo(cx + step / 2, y - 5, cx + step, y); cx += step; }
    g.stroke();
  }

  function drawCover(alpha, t) {
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = pal.bg0; g.fillRect(0, 0, W, H);
    // กรอบทอง
    g.strokeStyle = pal.gold; g.lineWidth = 3; g.strokeRect(70, 70, W - 140, H - 140);
    g.strokeStyle = pal.border; g.lineWidth = 1; g.strokeRect(84, 84, W - 168, H - 168);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = pal.gold; g.font = `600 30px ${textFont}`;
    g.fillText('ฐานข้อมูลเพลงไทย · หอจดหมายเหตุดนตรีไทย', W / 2, 250);
    g.fillStyle = pal.ink; g.font = `700 92px ${serifFont}`;
    g.fillText(meta.title || 'เพลงไทย', W / 2, 430);
    if (meta.info) { g.fillStyle = pal.muted; g.font = `400 34px ${textFont}`; g.fillText(meta.info, W / 2, 540); }
    g.fillStyle = pal.gold2; g.font = `500 38px ${textFont}`;
    g.fillText(meta.credit || 'โดย อาจารย์ ดร.ปกป้อง ขำประเสริฐ', W / 2, 680);
    g.fillStyle = pal.muted; g.font = `400 30px ${textFont}`;
    g.fillText(meta.site || 'thaimusicarchive.com', W / 2, 820);
    // จุดวิ่งบอกว่ากำลังจะเริ่ม
    if (meta.leadSec > 0.5) {
      const p = Math.max(0, Math.min(1, t / meta.leadSec));
      g.fillStyle = pal.border; g.fillRect(W / 2 - 160, 900, 320, 4);
      g.fillStyle = pal.gold; g.fillRect(W / 2 - 160, 900, 320 * p, 4);
    }
    g.restore();
  }

  function drawOutro(alpha) {
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = pal.bg0; g.fillRect(0, 0, W, H);
    g.strokeStyle = pal.gold; g.lineWidth = 3; g.strokeRect(70, 70, W - 140, H - 140);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = pal.ink; g.font = `700 64px ${serifFont}`;
    g.fillText(meta.title || '', W / 2, 400);
    g.fillStyle = pal.gold; g.font = `600 40px ${textFont}`;
    g.fillText('หอจดหมายเหตุดนตรีไทย', W / 2, 540);
    g.fillStyle = pal.muted; g.font = `400 32px ${textFont}`;
    g.fillText(meta.site || 'thaimusicarchive.com', W / 2, 620);
    g.restore();
  }

  function drawNotes(cur, t) {
    g.fillStyle = pal.bg; g.fillRect(0, 0, W, H);
    const curKey = cur ? cur.verseIdx + '-' + cur.pos : null;
    const curLine = curKey != null ? (L.index.get(curKey) ?? -1) : -1;
    // เลื่อนจอนุ่ม ๆ ไปหาบรรทัดที่กำลังเล่น
    const target = scrollTarget(L, curLine >= 0 ? curLine : Math.max(0, lastLine), topPad);
    if (curLine >= 0) lastLine = curLine;
    const dt = lastT == null ? 0 : Math.max(0, Math.min(0.2, t - lastT));
    if (lastT == null || t < lastT) scrollY = target;          // เฟรมแรก / ย้อนเวลา → กระโดดไปเลย
    else scrollY += (target - scrollY) * Math.min(1, dt * 5.5);
    if (Math.abs(target - scrollY) < 0.3) scrollY = target;

    g.save();
    g.translate(0, -scrollY + topPad);
    const vis0 = scrollY - topPad - 200, vis1 = scrollY - topPad + H + 200;
    g.textBaseline = 'middle';
    for (const ln of L.lines) {
      if (ln.y + ln.h < vis0 || ln.y > vis1) continue;
      // แถบจาง ๆ ใต้บรรทัดที่กำลังเล่น
      if (ln.i === curLine) {
        g.fillStyle = pal.onLine;
        roundRect(L.padX - 22, ln.notesY - 8, W - L.padX * 2 + 44, ln.rows.length * L.rowH + 16, 12); g.fill();
      }
      if (ln.sec) {
        g.fillStyle = pal.gold; g.fillRect(L.padX, ln.y + 8, 5, L.secTitleH - 12);
        g.textAlign = 'left';
        g.fillStyle = pal.gold2; g.font = `700 34px ${textFont}`;
        g.fillText(ln.sec.name || 'ทั้งเพลง', L.padX + 20, ln.y + L.secTitleH / 2);
        if (ln.sec.bits) {
          g.fillStyle = pal.muted; g.font = `400 22px ${textFont}`;
          g.fillText(ln.sec.bits, L.padX + 20, ln.y + L.secTitleH + L.secBitsH / 2 - 2);
        }
      }
      g.textAlign = 'left'; g.fillStyle = pal.muted; g.font = `400 21px ${textFont}`;
      g.fillText(ln.label || '', L.padX + L.labelW, ln.y + ln.secH + L.labelH / 2);
      for (const r of ln.rows) {
        const cy = r.y + L.rowH / 2;
        if (r.label) {
          g.textAlign = 'right'; g.fillStyle = pal.muted; g.font = `400 22px ${textFont}`;
          g.fillText(r.label, L.padX + L.labelW - 14, cy);
        }
        g.textAlign = 'center';
        for (const c of r.cells) {
          if (c.bar) {   // เส้นคั่นห้อง — วาดเป็นเส้นจริง (ฟอนต์โน้ตไม่มีตัว | )
            g.fillStyle = pal.bar; g.fillRect(Math.round(c.x - L.barW / 2) - 1, r.y + 6, 2, L.rowH - 12);
          }
          const on = curKey === c.vi + '-' + c.p;
          if (on) {
            g.fillStyle = pal.on; roundRect(c.x + 1, r.y + 3, c.w - 2, L.rowH - 6, 6); g.fill();
            if (pal.onOutline) { g.strokeStyle = pal.onOutline; g.lineWidth = 1.5; g.stroke(); }
          }
          if (c.kro) { g.strokeStyle = pal.gold2; g.lineWidth = 2; wave(c.x + 4, r.y + 9, c.w - 8); }
          if (c.sabat) {
            g.strokeStyle = pal.gold2; g.lineWidth = 2; g.beginPath();
            g.moveTo(c.x + 5, r.y + 8); g.quadraticCurveTo(c.x + c.w / 2, r.y - 2, c.x + c.w - 5, r.y + 8); g.stroke();
          }
          g.fillStyle = c.rest ? pal.rest : (c.kro ? pal.gold2 : pal.ink);
          let fs = L.fontNote;
          g.font = `${c.damp ? '900' : (c.rest ? '600' : '400')} ${fs}px ${noteFont}`;
          if (c.sabat) {   // สะบัดหลายตัวในช่องเดียว — ย่อให้พอดีช่อง ไม่ล้นไปทับช่องข้าง
            const tw = g.measureText(c.text).width;
            if (tw > c.w - 4) { fs = Math.max(12, Math.floor(fs * (c.w - 4) / tw)); g.font = `400 ${fs}px ${noteFont}`; }
          }
          g.fillText(c.text, c.x + c.w / 2, cy + (c.kro || c.sabat ? 3 : 0));
        }
      }
    }
    g.restore();

    // แถบล่าง: ชื่อเพลง · เวลา · เส้นความคืบหน้า
    g.fillStyle = pal.bg2; g.fillRect(0, H - 54, W, 54);
    g.fillStyle = pal.border; g.fillRect(0, H - 54, W, 1);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = pal.ink; g.font = `600 24px ${textFont}`;
    g.fillText(meta.title || '', L.padX, H - 27);
    g.textAlign = 'right'; g.fillStyle = pal.muted; g.font = `400 22px ${textFont}`;
    const songT = Math.max(0, Math.min(t - meta.leadSec, meta.songEnd - meta.leadSec));
    g.fillText(`${formatClock(songT)} / ${formatClock(meta.songEnd - meta.leadSec)} · ${meta.site || 'thaimusicarchive.com'}`, W - L.padX, H - 27);
    const prog = (meta.songEnd - meta.leadSec) > 0 ? songT / (meta.songEnd - meta.leadSec) : 0;
    g.fillStyle = pal.gold; g.fillRect(0, H - 4, W * prog, 4);
    lastT = t;
  }

  return function paint(t) {
    const lead = meta.leadSec || 0, end = meta.songEnd || 0, total = meta.totalSec || end;
    let cur = null;
    if (t >= lead && t < end) { const r = cursorAt(meta.timeline, t, hint); hint = Math.max(0, r.idx); cur = r.cur; }
    if (t < lead) {
      const fade = 0.6;
      if (t < lead - fade) { drawCover(1, t); return; }
      drawNotes(null, t);
      drawCover((lead - t) / fade, t);
      return;
    }
    drawNotes(cur, t);
    // ท้ายเพลง: ค้างโน้ตไว้ครู่หนึ่ง แล้วค่อยเฟดเข้าหน้าปิด
    const outroAt = end + 1.0, outroFade = 1.0;
    if (t >= outroAt) drawOutro(Math.min(1, (t - outroAt) / outroFade));
    void total;
  };
}

// ── อัดวิดีโอตามเวลาจริง ────────────────────────────────────────
// paint(t) วาดเฟรม ณ วินาที t ของไฟล์เสียง · audioBuf = เสียงสุดท้าย (พูดนำ + เพลง)
// คืน { blob, mime, ext, seconds }
export async function recordVideo({ canvas, audioBuf, paint, fps = 30, signal, onProgress, choice, tail = 0.3 }) {
  const pick = choice || pickVideoMime();
  if (!pick) throw new Error('เบราว์เซอร์นี้อัดวิดีโอไม่ได้ — ใช้ Chrome หรือ Edge รุ่นใหม่');
  if (signal?.aborted) throw new CancelledError();
  const dur = audioBuf.duration;
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC({ sampleRate: audioBuf.sampleRate });
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const src = ac.createBufferSource(); src.buffer = audioBuf; src.connect(dest);
  const stream = canvas.captureStream(fps);
  dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
  let rec;
  try {
    rec = new MediaRecorder(stream, { mimeType: pick.mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 });
  } catch (e) {
    ac.close().catch(() => {});
    throw new Error('เริ่มตัวอัดวิดีโอไม่ได้: ' + (e.message ?? e));
  }
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = res; });
  let recErr = null;
  rec.onerror = e => { recErr = e.error || new Error('ตัวอัดวิดีโอขัดข้อง'); };

  paint(0);
  rec.start(1000);
  const t0 = ac.currentTime + 0.35;
  src.start(t0);
  const endAt = dur + tail;

  let cancelled = false, raf = 0, iv = 0;
  const cleanup = () => {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (iv) clearInterval(iv); iv = 0;
    try { src.stop(); } catch (e) {}
    stream.getTracks().forEach(tr => { try { tr.stop(); } catch (e) {} });
    ac.close().catch(() => {});
  };
  const onAbort = () => { cancelled = true; };
  signal?.addEventListener('abort', onAbort, { once: true });

  await new Promise((resolve) => {
    let lastPct = -1;
    const frame = () => {
      const t = ac.currentTime - t0;
      if (cancelled || recErr) { resolve(); return; }
      if (t >= 0) paint(Math.min(t, endAt));
      const pct = Math.max(0, Math.min(100, Math.floor(Math.max(0, t) / endAt * 100)));
      if (pct !== lastPct && onProgress) { lastPct = pct; onProgress(pct / 100, Math.max(0, endAt - t)); }
      if (t >= endAt) { resolve(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // ★ สลับแท็บแล้ว requestAnimationFrame หยุด — ให้ setInterval ค้ำไว้ (ภาพจะกระตุกแต่ไม่ค้าง)
    iv = setInterval(() => {
      if (cancelled || recErr) return;
      const t = ac.currentTime - t0;
      if (t >= 0) paint(Math.min(t, endAt));
      if (t >= endAt) resolve();
    }, 1000 / fps);
  });
  if (raf) cancelAnimationFrame(raf); raf = 0;
  if (iv) clearInterval(iv); iv = 0;
  signal?.removeEventListener('abort', onAbort);
  try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {}
  await stopped;
  cleanup();
  if (cancelled) throw new CancelledError();
  if (recErr) throw recErr;
  const blob = new Blob(chunks, { type: pick.mime.split(';')[0] });
  if (!blob.size) throw new Error('ไม่ได้ข้อมูลวิดีโอจากตัวอัด');
  return { blob, mime: pick.mime, ext: pick.ext, label: pick.label, universal: pick.universal, seconds: endAt };
}

// ── รอฟอนต์โน้ตให้พร้อมก่อนวาด (ไม่งั้นเฟรมแรก ๆ เป็นฟอนต์สำรอง) ──
export async function ensureVideoFonts(sizePx = 40) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const want = [`${sizePx}px THNotation`, "34px 'Noto Sans Thai'", "92px 'Noto Serif Thai'"];
  await Promise.all(want.map(f => document.fonts.load(f).catch(() => null)));
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

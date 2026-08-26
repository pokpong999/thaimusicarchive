'use client';
// lib/notation-files.js — อ่านไฟล์โน้ตทุกชนิดในเบราว์เซอร์ (2026-08-25)
//   PDF (ข้อความ → pdf.js · ภาพสแกน → เรนเดอร์เป็นรูปส่ง AI) · DOCX (JSZip อ่าน document.xml · ตาราง = ห้อง) · XLSX/CSV (SheetJS)
//   รูป jpg/png/webp (ย่อแล้วส่ง AI) · MusicXML/.mxl · MIDI · .txt
//   คืน { kind:'text'|'images'|'musicxml'|'midi', text?, images?:[{data(base64), media_type, url}], buffer?, name, fontHint, pages }
import { pdfItemsToLines, detectLayout } from './notation-import';

const CDN = {
  pdfjs: ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', () => window.pdfjsLib],
  jszip: ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', () => window.JSZip],
  xlsx:  ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX],
};
const PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
export function loadLib(name) {
  const [src, get] = CDN[name];
  return new Promise((resolve, reject) => {
    if (get()) { resolve(get()); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(get()); s.onerror = () => reject(new Error('โหลดไลบรารี ' + name + ' ไม่ได้'));
    document.head.appendChild(s);
  });
}

export function extOf(name) { return String(name || '').toLowerCase().split('.').pop(); }
export function kindOf(file) {
  const e = extOf(file.name), t = file.type || '';
  if (e === 'pdf' || t === 'application/pdf') return 'pdf';
  if (e === 'docx') return 'docx';
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(e)) return 'sheet';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e) || t.startsWith('image/')) return 'image';
  if (['musicxml', 'xml'].includes(e)) return 'musicxml';
  if (e === 'mxl') return 'mxl';
  if (['mid', 'midi'].includes(e)) return 'midi';
  if (['txt', 'md'].includes(e) || t.startsWith('text/')) return 'text';
  return 'unknown';
}
export const ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.tsv,.jpg,.jpeg,.png,.webp,.musicxml,.xml,.mxl,.mid,.midi,.txt';

// ย่อรูป → base64 (ด้านยาวสุด maxPx) สำหรับส่ง AI
export async function imageToBase64(blobOrFile, maxPx = 1600, quality = 0.85) {
  const bmp = await createImageBitmap(blobOrFile);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const url = canvas.toDataURL('image/jpeg', quality);
  return { data: url.split(',')[1], media_type: 'image/jpeg', url, w, h };
}

// ── PDF ──
async function readPdf(file, { onProgress, maxPages = 10 } = {}) {
  const pdfjs = await loadLib('pdfjs');
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const lines = []; let notationChars = 0; let fontHint = null; const yLines = [];
  for (let i = 1; i <= n; i++) {
    onProgress?.(`อ่านข้อความหน้า ${i}/${n}`);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items.map(it => ({ str: it.str, x: it.transform?.[4] ?? 0, y: it.transform?.[5] ?? 0, w: it.width, h: it.height, font: it.fontName }));
    const fonts = Object.values(tc.styles || {}).map(s => s.fontFamily || '').join(' ');
    if (/notation/i.test(fonts) || items.some(it => /notation/i.test(String(tc.styles?.[it.font]?.fontFamily || '')))) fontHint = 'thn';
    const plY = pdfItemsToLines(items, { withY: true });
    const pl = plY.map(l => l.text);
    plY.forEach(l => yLines.push({ text: l.text, y: l.y - i * 100000 }));   // หน้าถัดไปอยู่ต่ำกว่าเสมอ
    notationChars += pl.join('').replace(/[^ดรมฟซลทqwertyuasdfghjzxcvbnm\-|]/g, '').length;
    if (pl.length) { if (n > 1) lines.push(`% page ${i}`); lines.push(...pl); }
  }
  // มีข้อความโน้ตพอสมควร → ใช้ข้อความ · ไม่มี (สแกน) → เรนเดอร์เป็นรูป
  if (notationChars >= 12) return { kind: 'text', text: lines.join('\n'), name: file.name, fontHint, pages: n, source: 'pdf-text', layoutHint: detectLayout(yLines) };
  const images = [];
  for (let i = 1; i <= n; i++) {
    onProgress?.(`สร้างภาพหน้า ${i}/${n}`);
    const page = await doc.getPage(i);
    const vp0 = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / Math.max(vp0.width, vp0.height));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas'); canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const url = canvas.toDataURL('image/jpeg', 0.85);
    images.push({ data: url.split(',')[1], media_type: 'image/jpeg', url });
  }
  return { kind: 'images', images, name: file.name, pages: n, source: 'pdf-scan' };
}

// ── DOCX ──
async function readDocx(file) {
  const JSZip = await loadLib('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('ไม่พบ word/document.xml');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const fontHint = /w:rFonts[^>]*"[^"]*Notation/i.test(xml) ? 'thn' : null;
  const textOfP = p => Array.from(p.getElementsByTagName('*')).map(el => el.localName === 't' ? el.textContent : el.localName === 'tab' ? ' ' : el.localName === 'br' ? '\n' : '').join('');
  const lines = [];
  const body = doc.getElementsByTagName('w:body')[0] ?? doc.documentElement;
  const walk = node => {
    for (const el of Array.from(node.children)) {
      if (el.localName === 'p') lines.push(textOfP(el).trim());
      else if (el.localName === 'tbl') {
        for (const tr of Array.from(el.getElementsByTagName('w:tr'))) {
          const cells = Array.from(tr.getElementsByTagName('w:tc')).map(tc => Array.from(tc.getElementsByTagName('w:p')).map(textOfP).join(' ').trim());
          lines.push(cells.filter(Boolean).join(' | '));   // ตาราง: แต่ละช่อง = ห้อง
        }
      } else if (el.localName === 'sdt' || el.localName === 'sdtContent') walk(el);
    }
  };
  walk(body);
  return { kind: 'text', text: lines.join('\n'), name: file.name, fontHint, source: 'docx', layoutHint: detectLayout(lines) };
}

// ── XLSX / CSV ──
async function readSheet(file) {
  const XLSX = await loadLib('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const lines = [];
  wb.SheetNames.forEach((sn, si) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' });
    if (wb.SheetNames.length > 1) lines.push(`% sheet ${sn}`);
    rows.forEach(r => {
      const cells = r.map(c => String(c ?? '').trim()).filter(Boolean);
      if (!cells.length) return;
      // ช่องเดียว = บรรทัดเต็ม · หลายช่อง: ช่องละห้อง (มี '|' อยู่แล้วก็ไม่เติมซ้ำ)
      lines.push(cells.length === 1 ? cells[0] : cells.map(c => c.replace(/^\|+|\|+$/g, '').trim()).filter(Boolean).join(' | '));
    });
  });
  return { kind: 'text', text: lines.join('\n'), name: file.name, source: 'sheet', layoutHint: detectLayout(lines) };
}

// ── MusicXML / MXL ──
async function readMxl(file) {
  const JSZip = await loadLib('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let path = null;
  const cont = await zip.file('META-INF/container.xml')?.async('string');
  if (cont) path = cont.match(/full-path="([^"]+)"/)?.[1] ?? null;
  if (!path || !zip.file(path)) path = Object.keys(zip.files).find(k => /\.(xml|musicxml)$/i.test(k) && !k.startsWith('META-INF'));
  if (!path) throw new Error('ไม่พบไฟล์ XML ใน .mxl');
  return { kind: 'musicxml', text: await zip.file(path).async('string'), name: file.name, source: 'mxl' };
}

export async function readNotationFile(file, opts = {}) {
  const k = kindOf(file);
  if (k === 'pdf') return readPdf(file, opts);
  if (k === 'docx') return readDocx(file);
  if (k === 'sheet') return readSheet(file);
  if (k === 'image') { const im = await imageToBase64(file); return { kind: 'images', images: [im], name: file.name, source: 'image' }; }
  if (k === 'musicxml') return { kind: 'musicxml', text: await file.text(), name: file.name, source: 'musicxml' };
  if (k === 'mxl') return readMxl(file);
  if (k === 'midi') return { kind: 'midi', buffer: await file.arrayBuffer(), name: file.name, source: 'midi' };
  if (k === 'text') return { kind: 'text', text: await file.text(), name: file.name, source: 'text' };
  throw new Error('ไม่รู้จักชนิดไฟล์ ' + file.name);
}

// ── ส่งรูปให้ AI อ่าน (ผ่าน /api/import-image) ──
export async function aiReadImages(images, { mode = 'auto', hint = '', token } = {}) {
  const r = await fetch('/api/import-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ images: images.map(i => ({ data: i.data, media_type: i.media_type })), mode, hint }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('อ่านภาพไม่สำเร็จ (' + r.status + ')'));
  return j;   // {text, format, notes, usage}
}

export function downloadBlob(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

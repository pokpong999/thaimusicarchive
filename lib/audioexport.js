// lib/audioexport.js — อัดโน้ตเป็นไฟล์เสียง (Pk 1 ก.ย. 69)
//
//   ★ งานทั้งหมดเกิดในเครื่องของคนกด ไม่ใช่ที่เซิร์ฟเวอร์
//     ไม่กินโควตา Vercel/Supabase และไม่มีค่าใช้จ่ายต่อครั้ง
//
//   OfflineAudioContext เรนเดอร์เร็วกว่าเวลาจริงราว 25 เท่า
//   (วัดจริงในเบราว์เซอร์: เพลง 30 วินาที ใช้ 1.2 วินาที)

export const WAV = 'wav', MP3 = 'mp3';

// ผู้ใช้กดยกเลิก — ไม่ใช่ความผิดพลาด แค่หยุดกลางคัน
export class CancelledError extends Error {
  constructor(msg = 'ยกเลิกแล้ว') { super(msg); this.name = 'CancelledError'; this.cancelled = true; }
}
export const isCancelled = e => !!(e && (e.cancelled || e.name === 'CancelledError'));
const throwIfAborted = signal => { if (signal?.aborted) throw new CancelledError(); };

// ── เรนเดอร์ OfflineAudioContext พร้อมรายงานความคืบหน้าจริง ───────
// OfflineAudioContext ไม่มี event ความคืบหน้า แต่ "หยุดชั่วคราว ณ เวลา t" ได้ (ctx.suspend)
// จึงนัดหยุดทุก 1/steps ของความยาว → รายงาน % → เดินต่อ  (ยกเลิก = ไม่เดินต่อ)
export async function renderWithProgress(ctx, { signal, onProgress, steps = 40 } = {}) {
  throwIfAborted(signal);
  const dur = ctx.length / ctx.sampleRate;
  const quantum = 128 / ctx.sampleRate;
  let seen = -1;
  for (let k = 1; k < steps; k++) {
    const t = Math.floor((dur * k / steps) / quantum) * quantum;
    if (!(t > 0) || t >= dur - quantum || t <= seen) continue;
    seen = t;
    ctx.suspend(t).then(() => {
      if (signal?.aborted) return;                 // ค้างไว้ตรงนี้ = ยกเลิก
      onProgress?.(t / dur);
      ctx.resume().catch(() => {});
    }).catch(() => {});
  }
  const abortP = new Promise((_, rej) => {
    if (!signal) return;
    signal.addEventListener('abort', () => rej(new CancelledError()), { once: true });
  });
  const buf = await Promise.race([ctx.startRendering(), abortP]);
  onProgress?.(1);
  return buf;
}

// ── บัฟเฟอร์เงียบ (ใช้เป็นช่วงหน้าปกวิดีโอเมื่อไม่ใส่เสียงพูดนำ) ─────
export function silence(ctx, sec, { channels = 2 } = {}) {
  return ctx.createBuffer(channels, Math.max(1, Math.round(sec * ctx.sampleRate)), ctx.sampleRate);
}

// ── เข้ารหัส WAV 16 บิต ─────────────────────────────────────────
// ฟังก์ชันล้วน ไม่พึ่งไลบรารีนอก · เปิดได้ทุกโปรแกรมตัดต่อ
export function encodeWav(buf) {
  const nch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const ab = new ArrayBuffer(44 + n * nch * 2), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF');  v.setUint32(4, 36 + n * nch * 2, true);
  ws(8, 'WAVE');  ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nch * 2, true);
  v.setUint16(32, nch * 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, n * nch * 2, true);
  const ch = []; for (let c = 0; c < nch; c++) ch.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) {
    const s = Math.max(-1, Math.min(1, ch[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2;
  }
  return new Uint8Array(ab);
}

// ── เข้ารหัส MP3 ────────────────────────────────────────────────
// ใช้ lamejs จาก cdnjs (โหลดครั้งเดียวตอนกดปุ่มครั้งแรก ไม่ถ่วงหน้าเว็บ)
const LAME_URL = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
let lamePromise = null;
export function loadLame() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ใช้ได้เฉพาะในเบราว์เซอร์'));
  if (window.lamejs) return Promise.resolve(window.lamejs);
  if (lamePromise) return lamePromise;
  lamePromise = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = LAME_URL; s.async = true;
    s.onload = () => (window.lamejs ? ok(window.lamejs) : no(new Error('โหลดตัวเข้ารหัส MP3 ไม่สำเร็จ')));
    s.onerror = () => { lamePromise = null; no(new Error('โหลดตัวเข้ารหัส MP3 ไม่ได้ — ตรวจอินเทอร์เน็ต')); };
    document.head.appendChild(s);
  });
  return lamePromise;
}

const to16 = f32 => {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
};

export async function encodeMp3(buf, { kbps = 192, onProgress, signal } = {}) {
  throwIfAborted(signal);
  const lame = await loadLame();
  const nch = Math.min(buf.numberOfChannels, 2);
  const enc = new lame.Mp3Encoder(nch, buf.sampleRate, kbps);
  const L = to16(buf.getChannelData(0));
  const R = nch > 1 ? to16(buf.getChannelData(1)) : null;
  const BLOCK = 1152, parts = [];
  for (let i = 0; i < L.length; i += BLOCK) {
    const l = L.subarray(i, i + BLOCK);
    const r = R ? R.subarray(i, i + BLOCK) : null;
    const d = nch > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (d.length) parts.push(new Uint8Array(d));
    if ((i / BLOCK) % 200 === 0) {
      if (onProgress) onProgress(i / L.length);
      if (signal?.aborted) throw new CancelledError();
      await new Promise(r => setTimeout(r, 0));   // คืนคิวให้หน้าจอวาดแถบความคืบหน้า/รับปุ่มยกเลิก
    }
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  if (onProgress) onProgress(1);
  return out;
}

// ── ต่อเสียงพูดนำหน้าเพลง ───────────────────────────────────────
// intro = AudioBuffer (อาจเป็น null) · song = AudioBuffer
// คืน AudioBuffer ใหม่ที่ยาว = intro + ช่องว่าง + เพลง
export function joinBuffers(ctx, parts, { gap = 0.35 } = {}) {
  const list = parts.filter(Boolean);
  if (!list.length) return null;
  const sr = list[0].sampleRate;
  const nch = Math.max(...list.map(b => b.numberOfChannels));
  const gapN = Math.round(gap * sr);
  const total = list.reduce((a, b) => a + b.length, 0) + gapN * (list.length - 1);
  const out = ctx.createBuffer(nch, total, sr);
  for (let c = 0; c < nch; c++) {
    const dst = out.getChannelData(c);
    let o = 0;
    list.forEach((b, i) => {
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
      dst.set(src, o);
      o += src.length + (i < list.length - 1 ? gapN : 0);
    });
  }
  return out;
}

// ── ปรับความดังให้พอดี ไม่แตก ───────────────────────────────────
// เสียงพูดกับเสียงเครื่องดนตรีดังไม่เท่ากัน ถ้าไม่ปรับ ฟังแล้วสะดุด
export function normalize(buf, target = 0.89) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  // ★ ต้องดัน "ขึ้น" ด้วย ไม่ใช่ลดอย่างเดียว
  //   เสียงที่เรนเดอร์ออกมามักอยู่ราว 0.4 ถ้าปล่อยไว้ ไฟล์จะเบากว่าเพลงอื่นครึ่งหนึ่ง
  //   คนฟังจะบ่นว่าเสียงเบา (จับได้ตอนทดสอบ 1 ก.ย. 69 — เดิมลดอย่างเดียว)
  if (!(peak > 0.0005)) return buf;          // เงียบสนิท/แทบไม่มีเสียง อย่าไปขยายเสียงรบกวน
  const k = target / peak;
  if (Math.abs(k - 1) < 0.02) return buf;    // ใกล้พอดีอยู่แล้ว ไม่ต้องแตะ
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}

// ── ชื่อไฟล์ที่ปลอดภัยกับทุกระบบ ────────────────────────────────
export function safeName(s, ext) {
  const base = String(s ?? 'เพลง')
    .replace(/[\/\\?%*:|"<>]/g, '')        // อักขระที่ Windows/macOS ห้าม
    .replace(/\s+/g, ' ').trim().slice(0, 80) || 'เพลง';
  return ext ? `${base}.${ext}` : base;
}

// ── สั่งดาวน์โหลด ───────────────────────────────────────────────
export function download(bytes, name, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob;
}

// ── ประมาณความยาวเพลง เพื่อกันเรนเดอร์ยาวเกินจนเครื่องค้าง ──────
export const MAX_SECONDS = 30 * 60;
export function guardSeconds(sec) {
  if (!(sec > 0)) throw new Error('คำนวณความยาวเพลงไม่ได้');
  if (sec > MAX_SECONDS)
    throw new Error(`เพลงยาว ${Math.round(sec / 60)} นาที เกินเพดาน ${MAX_SECONDS / 60} นาที — ลองปิดการกลับต้นแล้วอัดใหม่`);
  return sec;
}
